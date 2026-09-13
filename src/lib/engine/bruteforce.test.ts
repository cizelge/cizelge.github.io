/**
 * Correctness check: the engine against a slow, independent reference that
 * enumerates the full cartesian product of sections and evaluates every rule
 * minute by minute (no masks, no pruning, no shared scoring code).
 */
import { describe, expect, it } from "vitest";
import type { Course, Meeting, Section } from "../types";
import { generateSchedules } from "./generate";
import { rescore } from "./score";
import { key } from "./test-fixtures";
import type { Constraints, GenerateInput, RelaxedConstraint, Weights } from "./types";

// ---------- seeded PRNG ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function randomInput(rand: () => number): GenerateInput {
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const pick = <T>(xs: readonly T[]) => xs[int(0, xs.length - 1)];

  const courses: Course[] = [];
  const nCourses = int(3, 4);
  for (let c = 0; c < nCourses; c++) {
    const sections: Section[] = [];
    const nSections = int(1, 4);
    for (let s = 0; s < nSections; s++) {
      const meetings: Meeting[] = [];
      // mostly 1–2 meetings; occasionally none (time-less section)
      const nMeetings = rand() < 0.05 ? 0 : int(1, 2);
      for (let k = 0; k < nMeetings; k++) {
        const start = int(8, 18) * 60 + pick([0, 30, 40]);
        const end = start + pick([50, 80, 110, 170]);
        // mostly Mon–Wed so that clashes are common; sometimes the weekend (Sat/Sun)
        const day = (rand() < 0.2 ? int(6, 7) : int(1, 3)) as Meeting["day"];
        meetings.push({ day, start: hhmm(start), end: hhmm(end), room: null });
      }
      sections.push({ id: String.fromCharCode(65 + s), instructors: [], capacity: null, restrictions: null, meetings });
    }
    courses.push({
      code: `C ${c}`,
      slug: `c-${c}`,
      title: "",
      ects: null,
      localCredits: null,
      prerequisites: "",
      corequisites: [],
      sections,
    });
  }

  const freeDays: Meeting["day"][] = [];
  for (const d of [1, 2, 3, 4, 6, 7] as const) if (rand() < 0.15) freeDays.push(d);
  const locked: Record<string, string> = {};
  for (const c of courses) {
    if (rand() < 0.15) locked[c.code] = rand() < 0.1 ? "Z" : pick(c.sections).id;
  }
  const excluded = [];
  for (const c of courses) {
    for (const s of c.sections) if (rand() < 0.15) excluded.push({ courseCode: c.code, sectionId: s.id });
  }
  const w = () => int(0, 3);
  const weights: Weights = { fewDays: w(), fewGaps: w(), lunchBreak: w(), noEarly: w(), noLate: w() };
  return { courses, freeDays, locked, excluded, weights };
}

// ---------- reference implementation ----------
interface RefSchedule {
  key: string;
  score: number;
}

function refSectionAllowed(course: Course, section: Section, c: Constraints): boolean {
  if (course.code in c.locked && c.locked[course.code] !== section.id) return false;
  if (c.excluded.some((e) => e.courseCode === course.code && e.sectionId === section.id)) return false;
  if (section.meetings.some((m) => c.freeDays.includes(m.day))) return false;
  return true;
}

function refScore(meetings: Meeting[], w: Weights): number {
  const early = toMin("09:40");
  const late = toMin("17:40");
  let days = 0;
  let gap = 0;
  let noLunch = 0;
  for (let d = 1; d <= 7; d++) {
    const busy = new Uint8Array(24 * 60);
    const today = meetings.filter((m) => m.day === d);
    if (today.length === 0) continue;
    days++;
    for (const m of today) busy.fill(1, toMin(m.start), toMin(m.end));
    const first = busy.indexOf(1);
    const last = busy.lastIndexOf(1);
    for (let t = first; t <= last; t++) if (!busy[t]) gap++;
    let run = 0;
    let longest = 0;
    for (let t = 12 * 60; t < 14 * 60; t++) {
      run = busy[t] ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    if (longest < 60) noLunch++;
  }
  const earlyCount = meetings.filter((m) => toMin(m.start) < early).length;
  const lateCount = meetings.filter((m) => toMin(m.end) > late).length;
  return w.fewDays * days + w.fewGaps * (gap / 60) + w.lunchBreak * noLunch + w.noEarly * earlyCount + w.noLate * lateCount;
}

function reference(input: Constraints, weights: Weights): RefSchedule[] {
  const out: RefSchedule[] = [];
  const chosen: { course: Course; section: Section }[] = [];
  const walk = (i: number) => {
    if (i === input.courses.length) {
      const all = chosen.flatMap((x) => x.section.meetings);
      // Meetings of different courses must not overlap. Two meetings of the SAME
      // section may (data can list one slot twice); a section never clashes with itself.
      for (let a = 0; a < chosen.length; a++) {
        for (let b = a + 1; b < chosen.length; b++) {
          for (const x of chosen[a].section.meetings) {
            for (const y of chosen[b].section.meetings) {
              if (x.day === y.day && toMin(x.start) < toMin(y.end) && toMin(y.start) < toMin(x.end)) return;
            }
          }
        }
      }
      if (!chosen.every((x) => refSectionAllowed(x.course, x.section, input))) return;
      out.push({
        key: key(chosen.map((x) => ({ courseCode: x.course.code, sectionId: x.section.id }))),
        score: refScore(all, weights),
      });
      return;
    }
    for (const section of input.courses[i].sections) {
      chosen.push({ course: input.courses[i], section });
      walk(i + 1);
      chosen.pop();
    }
  };
  walk(0);
  return out;
}

function relax(input: Constraints, r: RelaxedConstraint): Constraints {
  switch (r.kind) {
    case "freeDay":
      return { ...input, freeDays: input.freeDays.filter((d) => d !== r.day) };
    case "lock": {
      const locked = { ...input.locked };
      delete locked[r.courseCode];
      return { ...input, locked };
    }
    case "exclusion": {
      const i = input.excluded.findIndex((e) => e.courseCode === r.courseCode && e.sectionId === r.sectionId);
      return { ...input, excluded: input.excluded.filter((_, k) => k !== i) };
    }
  }
}

function allRelaxations(input: Constraints): RelaxedConstraint[] {
  return [
    ...input.freeDays.map((day) => ({ kind: "freeDay", day }) as const),
    ...Object.entries(input.locked).map(([courseCode, sectionId]) => ({ kind: "lock", courseCode, sectionId }) as const),
    ...input.excluded.map((e) => ({ kind: "exclusion", ...e }) as const),
  ];
}

// ---------- the comparison ----------
const TRIALS = 400;

describe("engine vs brute-force reference", () => {
  it(`agrees on ${TRIALS} seeded random inputs`, () => {
    let withSolutions = 0;
    let withoutSolutions = 0;
    const reasonKinds = { noEligibleSection: 0, pairConflict: 0, groupConflict: 0 };

    for (let seed = 1; seed <= TRIALS; seed++) {
      const input = randomInput(mulberry32(seed));
      const ctx = `seed ${seed}`;
      const ref = reference(input, input.weights);
      const got = generateSchedules(input);

      // same set of valid schedules, each with the same score
      const refMap = new Map(ref.map((r) => [r.key, r.score]));
      const gotKeys = got.candidates.map((c) => key(c.sections));
      expect(new Set(gotKeys).size, ctx).toBe(gotKeys.length);
      expect([...gotKeys].sort(), ctx).toEqual([...refMap.keys()].sort());
      expect(got.truncated, ctx).toBe(false);

      const allRanked = rescore(got.candidates, input.weights, Infinity);
      for (const s of allRanked) expect(s.score, ctx).toBeCloseTo(refMap.get(key(s.sections))!, 9);

      if (ref.length > 0) {
        withSolutions++;
        const best = Math.min(...ref.map((r) => r.score));
        expect(got.schedules[0].score, ctx).toBeCloseTo(best, 9);
        expect(got.reason, ctx).toBeNull();
        continue;
      }

      // no solution: the reason must be true and the suggestions exact
      withoutSolutions++;
      expect(got.schedules, ctx).toEqual([]);
      const reason = got.reason;
      expect(reason, ctx).not.toBeNull();
      reasonKinds[reason!.kind]++;
      const sub = (codes: string[]) => ({ ...input, courses: input.courses.filter((c) => codes.includes(c.code)) });
      if (reason!.kind === "noEligibleSection") {
        const course = input.courses.find((c) => c.code === reason!.courseCode)!;
        expect(course.sections.some((s) => refSectionAllowed(course, s, input)), ctx).toBe(false);
      } else if (reason!.kind === "pairConflict") {
        expect(reference(sub(reason!.courseCodes), input.weights), ctx).toEqual([]);
        for (const code of reason!.courseCodes) {
          expect(reference(sub([code]), input.weights).length, ctx).toBeGreaterThan(0);
        }
      } else {
        const codes = reason!.courseCodes;
        expect(codes.length, ctx).toBeGreaterThanOrEqual(3);
        expect(reference(sub(codes), input.weights), ctx).toEqual([]);
        for (const drop of codes) {
          expect(reference(sub(codes.filter((c) => c !== drop)), input.weights).length, ctx).toBeGreaterThan(0);
        }
      }

      const expected = allRelaxations(input)
        .map((constraint) => ({ constraint, scheduleCount: reference(relax(input, constraint), input.weights).length }))
        .filter((s) => s.scheduleCount > 0)
        .map((s) => ({ ...s, truncated: false }));
      expect(got.suggestions, ctx).toEqual(expected);
    }

    // make sure the generator exercises both branches meaningfully
    expect(withSolutions).toBeGreaterThan(50);
    expect(withoutSolutions).toBeGreaterThan(50);
    expect(reasonKinds.noEligibleSection).toBeGreaterThan(0);
    expect(reasonKinds.pairConflict).toBeGreaterThan(0);
    expect(reasonKinds.groupConflict).toBeGreaterThan(0);
  });
});

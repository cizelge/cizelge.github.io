import { describe, expect, it } from "vitest";
import { explainNoSolution } from "./explain";
import { generateSchedules } from "./generate";
import { NO_WEIGHTS, crs, mt, sec } from "./test-fixtures";
import type { Constraints, RelaxedConstraint } from "./types";

const base = (over: Partial<Constraints>): Constraints => ({
  courses: [],
  freeDays: [],
  locked: {},
  excluded: [],
  ...over,
});

describe("explainNoSolution — reason", () => {
  it("returns null when a schedule exists", () => {
    const c = crs("A 1", sec("A", mt(1, "10:00", "11:00")));
    expect(explainNoSolution(base({ courses: [c] }))).toEqual({ reason: null, suggestions: [] });
  });

  it("names a course whose every section is on a free day", () => {
    const ok = crs("OK 1", sec("A", mt(3, "10:00", "11:00")));
    const c = crs(
      "HIST 101",
      sec("A", mt(1, "10:40", "12:30"), mt(4, "10:40", "12:30")),
      sec("B", mt(4, "08:40", "10:30"), mt(2, "08:40", "10:30")),
    );
    const { reason } = explainNoSolution(base({ courses: [ok, c], freeDays: [2, 4] }));
    expect(reason).toEqual({
      kind: "noEligibleSection",
      courseCode: "HIST 101",
      blocked: [
        { sectionId: "A", cause: "freeDay", day: 4 },
        { sectionId: "B", cause: "freeDay", day: 4 },
      ],
    });
  });

  it("distinguishes locks, exclusions and courses without sections", () => {
    const c = crs("X 1", sec("A", mt(1, "10:00", "11:00")), sec("B", mt(2, "10:00", "11:00")));
    expect(
      explainNoSolution(
        base({ courses: [c], locked: { "X 1": "B" }, excluded: [{ courseCode: "X 1", sectionId: "B" }] }),
      ).reason,
    ).toEqual({
      kind: "noEligibleSection",
      courseCode: "X 1",
      blocked: [
        { sectionId: "A", cause: "notLocked" },
        { sectionId: "B", cause: "excluded" },
      ],
    });
    expect(explainNoSolution(base({ courses: [crs("EMPTY 1")] })).reason).toEqual({
      kind: "noEligibleSection",
      courseCode: "EMPTY 1",
      blocked: [],
    });
  });

  it("reports a pair of courses whose every section pair overlaps, with one overlap time", () => {
    const free = crs("ART 100", sec("A", mt(5, "15:40", "17:30")));
    const math = crs(
      "MATH 211",
      sec("A", mt(2, "12:40", "14:30")),
      sec("B", mt(2, "12:40", "14:30"), mt(4, "08:40", "10:30")),
    );
    const phys = crs("PHYS 101", sec("A", mt(2, "12:40", "13:30")), sec("B", mt(2, "13:40", "15:30")));
    const { reason } = explainNoSolution(base({ courses: [free, math, phys] }));
    expect(reason).toEqual({
      kind: "pairConflict",
      courseCodes: ["MATH 211", "PHYS 101"],
      overlap: { day: 2, start: "12:40", end: "13:30" },
    });
  });

  it("reports a minimal group when no single course or pair is impossible", () => {
    const at = (code: string) =>
      crs(code, sec("A", mt(1, "09:00", "10:00")), sec("B", mt(1, "10:00", "11:00")));
    const unrelated = crs("U 1", sec("A", mt(3, "09:00", "10:00")));
    const { reason } = explainNoSolution(base({ courses: [unrelated, at("B 1"), at("C 1"), at("D 1")] }));
    expect(reason).toEqual({ kind: "groupConflict", courseCodes: ["B 1", "C 1", "D 1"] });
  });
});

const single = (constraint: RelaxedConstraint, scheduleCount: number, truncated = false) => ({
  constraint,
  constraints: [constraint],
  scheduleCount,
  truncated,
});
const pair = (a: RelaxedConstraint, b: RelaxedConstraint, scheduleCount: number, truncated = false) => ({
  constraint: a,
  constraints: [a, b],
  scheduleCount,
  truncated,
});

describe("explainNoSolution — suggestions", () => {
  const math = crs(
    "MATH 101",
    sec("A", mt(1, "10:40", "12:30")),
    sec("B", mt(2, "10:40", "12:30")),
    sec("C", mt(3, "10:40", "12:30")),
  );
  const cs = crs("CS 101", sec("A", mt(1, "10:40", "12:30")), sec("B", mt(4, "10:40", "12:30")));
  const input = base({
    courses: [math, cs],
    freeDays: [2, 6],
    locked: { "CS 101": "A" },
    excluded: [
      { courseCode: "BIO 100", sectionId: "A" }, // course not selected: never suggested
      { courseCode: "MATH 101", sectionId: "C" },
    ],
  });

  it("lists each single constraint whose removal yields schedules, with the count", () => {
    const { reason, suggestions } = explainNoSolution(input);
    expect(reason).toEqual({
      kind: "pairConflict",
      courseCodes: ["MATH 101", "CS 101"],
      overlap: { day: 1, start: "10:40", end: "12:30" },
    });
    expect(suggestions).toEqual([
      single({ kind: "freeDay", day: 2 }, 1),
      single({ kind: "lock", courseCode: "CS 101", sectionId: "A" }, 1),
      single({ kind: "exclusion", courseCode: "MATH 101", sectionId: "C" }, 1),
    ]);
  });

  it("counts every schedule a relaxation produces", () => {
    const many = crs("MANY 1", ...["A", "B", "C", "D"].map((id) => sec(id, mt(5, "10:00", "11:00"))));
    const { suggestions } = explainNoSolution(base({ courses: [many], freeDays: [5] }));
    expect(suggestions).toEqual([single({ kind: "freeDay", day: 5 }, 4)]);
  });

  it("is what generateSchedules returns when nothing fits", () => {
    const r = generateSchedules({ ...input, weights: NO_WEIGHTS });
    expect(r.schedules).toEqual([]);
    expect(r.reason?.kind).toBe("pairConflict");
    expect(r.suggestions).toHaveLength(3);
    expect(generateSchedules({ ...input, freeDays: [], weights: NO_WEIGHTS }).reason).toBeNull();
  });
});

describe("explainNoSolution — pair suggestions", () => {
  // Every X section is blocked by two constraints at once, so no single removal helps.
  const x = crs("X 1", sec("A", mt(1, "10:00", "11:00")), sec("B", mt(1, "08:00", "09:00"), mt(2, "08:00", "09:00")));
  const y = crs(
    "Y 1",
    sec("P", mt(1, "12:00", "13:00")),
    sec("Q", mt(2, "12:00", "13:00")),
    sec("R", mt(3, "12:00", "13:00")),
  );
  const input = base({
    courses: [x, y],
    freeDays: [1, 2],
    excluded: [
      { courseCode: "X 1", sectionId: "A" },
      { courseCode: "NOT 1", sectionId: "A" }, // course not selected: never suggested
    ],
  });
  const day1 = { kind: "freeDay", day: 1 } as const;
  const day2 = { kind: "freeDay", day: 2 } as const;
  const exA = { kind: "exclusion", courseCode: "X 1", sectionId: "A" } as const;

  it("suggests pairs when no single removal works, most schedules first", () => {
    // day1+day2: X B with P, Q or R (3). day1+exA: X A with P or R (2). day2+exA: X still on Monday (0).
    expect(explainNoSolution(input).suggestions).toEqual([pair(day1, day2, 3), pair(day1, exA, 2)]);
  });

  it("counts pairs up to the candidate cap and ranks truncated counts first", () => {
    expect(explainNoSolution({ ...input, candidateCap: 2 }).suggestions).toEqual([
      pair(day1, day2, 2, true),
      pair(day1, exA, 2, false),
    ]);
  });

  it("does not return pairs when a single removal already works", () => {
    const { suggestions } = explainNoSolution({ ...input, excluded: [] });
    expect(suggestions.every((s) => s.constraints.length === 1)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("returns nothing when even two removals are not enough", () => {
    const onlyWednesday = crs("Y 1", sec("R", mt(3, "12:00", "13:00")));
    const r = explainNoSolution({ ...input, courses: [x, onlyWednesday], freeDays: [1, 2, 3] });
    expect(r.reason).not.toBeNull();
    expect(r.suggestions).toEqual([]);
  });

  // All sections excluded and a lock to a section that does not exist: only lock + one exclusion helps.
  const locked = (n: number) => {
    const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    return base({
      courses: [crs("Z 1", ...ids.map((id) => sec(id, mt(4, "10:00", "11:00"))))],
      locked: { "Z 1": "ZZ" },
      excluded: ids.map((sectionId) => ({ courseCode: "Z 1", sectionId })),
    });
  };
  const lockZ = { kind: "lock", courseCode: "Z 1", sectionId: "ZZ" } as const;
  const ex = (sectionId: string) => ({ kind: "exclusion", courseCode: "Z 1", sectionId }) as const;

  it("returns at most three pairs, free days, exclusions, then locks", () => {
    // 9 exclusions + 1 lock = 10 candidates = 45 pairs, all tried; 9 of them work.
    expect(explainNoSolution(locked(9)).suggestions).toEqual([
      pair(ex("A"), lockZ, 1),
      pair(ex("B"), lockZ, 1),
      pair(ex("C"), lockZ, 1),
    ]);
  });

  it("only tries pairs among the ten highest-priority candidates", () => {
    // 10 exclusions push the lock to 11th place: its pairs are never tried.
    expect(explainNoSolution(locked(10)).suggestions).toEqual([]);
  });
});

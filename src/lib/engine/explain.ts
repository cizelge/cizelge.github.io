import { normalizeCode } from "./corequisites";
import { DEFAULT_CANDIDATE_CAP } from "./constants";
import { countSchedules, hasSchedule, prepareCourses } from "./search";
import type { PreparedCourse, PreparedSection } from "./search";
import { SLOT_MINUTES, firstOverlapSlot, formatTime, masksOverlap } from "./timemask";
import type { Constraints, NoSolutionReason, RelaxedConstraint, Suggestion } from "./types";

export interface Explanation {
  /** null when at least one schedule exists. */
  reason: NoSolutionReason | null;
  suggestions: Suggestion[];
}

/**
 * Why is there no schedule, and which single constraint could be dropped?
 *
 * Reason, smallest first:
 *  1. a course with no eligible section;
 *  2. the first pair of courses (in input order) whose every eligible section
 *     pair overlaps;
 *  3. otherwise a minimal conflicting group, found by deletion: drop each
 *     course in turn and keep it dropped if the rest is still unsolvable.
 *
 * Suggestions: remove exactly one free day, one lock (of a selected course)
 * or one exclusion (of a selected course), re-run the search and report those
 * that give at least one schedule.
 */
export function explainNoSolution(
  input: Constraints & { candidateCap?: number },
): Explanation {
  const prepared = prepareCourses(input);
  if (hasSchedule(prepared)) return { reason: null, suggestions: [] };
  return {
    reason: findReason(prepared),
    suggestions: findSuggestions(input, input.candidateCap ?? DEFAULT_CANDIDATE_CAP),
  };
}

function findReason(prepared: PreparedCourse[]): NoSolutionReason {
  const empty = prepared.find((c) => c.eligible.length === 0);
  if (empty) {
    return { kind: "noEligibleSection", courseCode: empty.course.code, blocked: empty.blocked };
  }

  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      const a = prepared[i];
      const b = prepared[j];
      const allClash = a.eligible.every((sa) => b.eligible.every((sb) => masksOverlap(sa.mask, sb.mask)));
      if (allClash) {
        return {
          kind: "pairConflict",
          courseCodes: [a.course.code, b.course.code],
          overlap: describeOverlap(a.eligible[0], b.eligible[0]),
        };
      }
    }
  }

  let group = prepared.slice();
  for (let i = 0; i < group.length; ) {
    const without = group.filter((_, k) => k !== i);
    if (!hasSchedule(without)) group = without;
    else i++;
  }
  return { kind: "groupConflict", courseCodes: group.map((c) => c.course.code) };
}

function describeOverlap(a: PreparedSection, b: PreparedSection) {
  let best: { day: (typeof a.intervals)[number]["day"]; start: number; end: number } | null = null;
  for (const x of a.intervals) {
    for (const y of b.intervals) {
      if (x.day !== y.day || x.start >= y.end || y.start >= x.end) continue;
      const cand = { day: x.day, start: Math.max(x.start, y.start), end: Math.min(x.end, y.end) };
      if (!best || cand.day < best.day || (cand.day === best.day && cand.start < best.start)) best = cand;
    }
  }
  if (best) return { day: best.day, start: formatTime(best.start), end: formatTime(best.end) };
  // Only reachable when times share a partially-used 5-minute slot.
  const slot = firstOverlapSlot(a.mask, b.mask)!;
  return { day: slot.day, start: formatTime(slot.minute), end: formatTime(slot.minute + SLOT_MINUTES) };
}

function findSuggestions(input: Constraints, cap: number): Suggestion[] {
  const selected = new Set(input.courses.map((c) => normalizeCode(c.code)));
  const trials: { constraint: RelaxedConstraint; relaxed: Constraints }[] = [];

  for (const day of new Set(input.freeDays)) {
    trials.push({
      constraint: { kind: "freeDay", day },
      relaxed: { ...input, freeDays: input.freeDays.filter((d) => d !== day) },
    });
  }
  for (const [courseCode, sectionId] of Object.entries(input.locked)) {
    if (!selected.has(normalizeCode(courseCode))) continue;
    const locked = { ...input.locked };
    delete locked[courseCode];
    trials.push({ constraint: { kind: "lock", courseCode, sectionId }, relaxed: { ...input, locked } });
  }
  input.excluded.forEach((ex, index) => {
    if (!selected.has(normalizeCode(ex.courseCode))) return;
    trials.push({
      constraint: { kind: "exclusion", courseCode: ex.courseCode, sectionId: ex.sectionId },
      relaxed: { ...input, excluded: input.excluded.filter((_, k) => k !== index) },
    });
  });

  const suggestions: Suggestion[] = [];
  for (const { constraint, relaxed } of trials) {
    const { count, truncated } = countSchedules(prepareCourses(relaxed), cap);
    if (count > 0) suggestions.push({ constraint, scheduleCount: count, truncated });
  }
  return suggestions;
}

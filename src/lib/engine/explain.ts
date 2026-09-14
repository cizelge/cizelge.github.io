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
 * Why is there no schedule, and which one or two constraints could be dropped?
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
 * that give at least one schedule. When none does, try pairs of those removals
 * (at most `MAX_PAIR_TRIALS`) and report the `MAX_PAIR_SUGGESTIONS` pairs with
 * the most schedules.
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

/** How many unordered pairs of removals are tried at most (all pairs of the first 10 candidates). */
export const MAX_PAIR_TRIALS = 45;
/** How many pair suggestions are returned at most. */
export const MAX_PAIR_SUGGESTIONS = 3;

interface Removal {
  constraint: RelaxedConstraint;
  /** Set for exclusions: the index in `input.excluded` (duplicates are removed one at a time). */
  excludedIndex?: number;
}

function relaxAll(input: Constraints, removals: readonly Removal[]): Constraints {
  const days = new Set<number>();
  const locks = new Set<string>();
  const excluded = new Set<number>();
  for (const r of removals) {
    if (r.constraint.kind === "freeDay") days.add(r.constraint.day);
    else if (r.constraint.kind === "lock") locks.add(r.constraint.courseCode);
    else excluded.add(r.excludedIndex!);
  }
  const locked = { ...input.locked };
  for (const code of locks) delete locked[code];
  return {
    ...input,
    freeDays: input.freeDays.filter((d) => !days.has(d)),
    locked,
    excluded: input.excluded.filter((_, k) => !excluded.has(k)),
  };
}

function findSuggestions(input: Constraints, cap: number): Suggestion[] {
  const selected = new Set(input.courses.map((c) => normalizeCode(c.code)));
  const freeDays: Removal[] = [...new Set(input.freeDays)].map((day) => ({ constraint: { kind: "freeDay", day } }));
  const locks: Removal[] = Object.entries(input.locked)
    .filter(([courseCode]) => selected.has(normalizeCode(courseCode)))
    .map(([courseCode, sectionId]) => ({ constraint: { kind: "lock", courseCode, sectionId } }));
  const exclusions: Removal[] = [];
  input.excluded.forEach((ex, index) => {
    if (!selected.has(normalizeCode(ex.courseCode))) return;
    exclusions.push({
      constraint: { kind: "exclusion", courseCode: ex.courseCode, sectionId: ex.sectionId },
      excludedIndex: index,
    });
  });

  const trial = (removals: Removal[]): Suggestion | null => {
    const { count, truncated } = countSchedules(prepareCourses(relaxAll(input, removals)), cap);
    if (count === 0) return null;
    const constraints = removals.map((r) => r.constraint);
    return { constraint: constraints[0], constraints, scheduleCount: count, truncated };
  };

  const singles = [...freeDays, ...locks, ...exclusions]
    .map((r) => trial([r]))
    .filter((s): s is Suggestion => s !== null);
  if (singles.length > 0) return singles;

  // Pairs, by priority: free days first, then exclusions, then locks. Pairs are
  // enumerated in colex order ((0,1), (0,2), (1,2), (0,3), …), so the first 45
  // are exactly the pairs among the ten highest-priority candidates.
  const ranked = [...freeDays, ...exclusions, ...locks];
  const pairs: Suggestion[] = [];
  let tried = 0;
  outer: for (let j = 1; j < ranked.length; j++) {
    for (let i = 0; i < j; i++) {
      if (tried++ === MAX_PAIR_TRIALS) break outer;
      const s = trial([ranked[i], ranked[j]]);
      if (s) pairs.push(s);
    }
  }
  // Array.prototype.sort is stable: ties keep the trial order.
  pairs.sort((a, b) => b.scheduleCount - a.scheduleCount || Number(b.truncated) - Number(a.truncated));
  return pairs.slice(0, MAX_PAIR_SUGGESTIONS);
}

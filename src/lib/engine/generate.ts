import { DEFAULT_CANDIDATE_CAP } from "./constants";
import { explainNoSolution } from "./explain";
import {
  DEFAULT_EARLY_THRESHOLD,
  DEFAULT_LATE_THRESHOLD,
  DEFAULT_TOP_N,
  computeMetrics,
  rankTop,
} from "./score";
import type { TimeInterval } from "./score";
import { prepareCourses, searchSchedules } from "./search";
import { parseTime } from "./timemask";
import type { Candidate, GenerateInput, GenerateResult } from "./types";

export { DEFAULT_CANDIDATE_CAP };

/**
 * Finds valid schedules, keeps up to `candidateCap` of them and ranks the best
 * `topN`. When the cap is hit (`truncated`), the candidates are only the first
 * `candidateCap` found in search order, so after a weight change the caller
 * should run the search again instead of calling `rescore`.
 *
 * When nothing fits, `reason` and `suggestions` come from `explainNoSolution`.
 */
export function generateSchedules(input: GenerateInput): GenerateResult {
  const cap = input.candidateCap ?? DEFAULT_CANDIDATE_CAP;
  const thresholds = {
    early: parseTime(input.earlyThreshold ?? DEFAULT_EARLY_THRESHOLD),
    late: parseTime(input.lateThreshold ?? DEFAULT_LATE_THRESHOLD),
  };

  const prepared = prepareCourses(input);
  const candidates: Candidate[] = [];
  let truncated = false;
  const intervals: TimeInterval[] = [];

  searchSchedules(prepared, (picks) => {
    if (candidates.length === cap) {
      truncated = true;
      return false;
    }
    intervals.length = 0;
    for (const p of picks) for (const iv of p.intervals) intervals.push(iv);
    candidates.push({
      sections: picks.map((p) => p.ref), // refs are shared, not copied per schedule
      metrics: computeMetrics(intervals, thresholds),
    });
    return true;
  });

  const explanation =
    candidates.length === 0
      ? explainNoSolution({ ...input, candidateCap: cap })
      : { reason: null, suggestions: [] };

  return {
    schedules: rankTop(candidates, input.weights, input.topN ?? DEFAULT_TOP_N),
    candidates,
    truncated,
    reason: explanation.reason,
    suggestions: explanation.suggestions,
  };
}

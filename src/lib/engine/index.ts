// Public API of the schedule engine. Pure TypeScript: no React, no DOM, so it
// can run unchanged inside a Web Worker.

export { generateSchedules, DEFAULT_CANDIDATE_CAP } from "./generate";
export { rescore, computeMetrics, scoreMetrics, summarize, DEFAULT_EARLY_THRESHOLD, DEFAULT_LATE_THRESHOLD, DEFAULT_TOP_N } from "./score";
export type { TimeInterval, Thresholds } from "./score";
export { expandCorequisites, normalizeCode } from "./corequisites";
export { explainNoSolution } from "./explain";
export type { Explanation } from "./explain";
export { parseTime, formatTime } from "./timemask";
export type {
  BlockCause,
  BlockedSection,
  Candidate,
  Constraints,
  Day,
  GenerateInput,
  GenerateResult,
  NoSolutionReason,
  RankedSchedule,
  RelaxedConstraint,
  ScheduleMetrics,
  ScheduleSummary,
  SectionRef,
  Suggestion,
  Weights,
} from "./types";

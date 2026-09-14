import type { Course } from "../types";
import type { Day } from "./timemask";

export type { Day };

/** Preference weights, each 0–3 (slider). 0 = don't care. */
export interface Weights {
  fewDays: number;
  fewGaps: number;
  lunchBreak: number;
  noEarly: number;
  noLate: number;
}

export interface SectionRef {
  courseCode: string;
  sectionId: string;
}

/** Hard constraints: these eliminate schedules. */
export interface Constraints {
  /** Selected courses. Duplicate codes are ignored after the first. */
  courses: Course[];
  /** Days (1 = Monday … 7 = Sunday) on which no meeting may take place. */
  freeDays: Day[];
  /** course code -> the only section id allowed for that course. */
  locked: Record<string, string>;
  /** Sections that must never be used. */
  excluded: SectionRef[];
}

export interface GenerateInput extends Constraints {
  weights: Weights;
  /** Meetings starting strictly before this count as early. Default "09:40". */
  earlyThreshold?: string;
  /** Meetings ending strictly after this count as late. Default "17:40". */
  lateThreshold?: string;
  /** Max complete schedules kept as candidates. Default 50 000. */
  candidateCap?: number;
  /** How many ranked schedules to return. Default 50. */
  topN?: number;
}

/** Raw, weight-independent measurements of one schedule. */
export interface ScheduleMetrics {
  /** Days with at least one meeting. */
  days: number;
  /** Sum over days of free minutes between consecutive meetings. */
  gapMinutes: number;
  /** Days with meetings that have no free window >= 60 min inside 12:00–14:00. */
  noLunchDays: number;
  /** Meetings starting before the early threshold. */
  earlyCount: number;
  /** Meetings ending after the late threshold. */
  lateCount: number;
  /** Minutes since midnight; null when the schedule has no meetings at all. */
  earliestStart: number | null;
  latestEnd: number | null;
}

export interface ScheduleSummary {
  days: number;
  gapMinutes: number;
  /** "10:40", or null when the schedule has no meetings. */
  earliestStart: string | null;
  latestEnd: string | null;
}

/** A valid schedule found by the search, kept so it can be re-ranked cheaply. */
export interface Candidate {
  /** One chosen section per selected course, in the order the courses were given. */
  sections: SectionRef[];
  metrics: ScheduleMetrics;
}

export interface RankedSchedule {
  sections: SectionRef[];
  /** Lower is better. */
  score: number;
  summary: ScheduleSummary;
}

export type BlockCause = "notLocked" | "excluded" | "freeDay";

export interface BlockedSection {
  sectionId: string;
  cause: BlockCause;
  /** Set when cause is "freeDay": the first free day the section meets on. */
  day?: Day;
}

export type NoSolutionReason =
  | {
      /** The course has no section that survives the hard rules (or no sections at all). */
      kind: "noEligibleSection";
      courseCode: string;
      blocked: BlockedSection[];
    }
  | {
      /** Every eligible section of A overlaps every eligible section of B. */
      kind: "pairConflict";
      courseCodes: [string, string];
      /** One concrete overlap (of the first eligible section pair). */
      overlap: { day: Day; start: string; end: string };
    }
  | {
      /** No pair is impossible on its own, but this (minimal) group of courses is. */
      kind: "groupConflict";
      courseCodes: string[];
    };

export type RelaxedConstraint =
  | { kind: "freeDay"; day: Day }
  | { kind: "lock"; courseCode: string; sectionId: string }
  | { kind: "exclusion"; courseCode: string; sectionId: string };

export interface Suggestion {
  /** The first entry of `constraints`; for a single-removal suggestion, the only one. */
  constraint: RelaxedConstraint;
  /** Every constraint to remove together: one, or two when no single removal is enough. */
  constraints: RelaxedConstraint[];
  /** Schedules found with those constraints removed (capped at candidateCap). */
  scheduleCount: number;
  truncated: boolean;
}

export interface GenerateResult {
  /** Best `topN` schedules, best first. */
  schedules: RankedSchedule[];
  /** Every schedule found (up to the cap); feed to `rescore` when weights change. */
  candidates: Candidate[];
  /** True when more valid schedules exist than the cap allowed us to keep. */
  truncated: boolean;
  /** Only set when no schedule exists. */
  reason: NoSolutionReason | null;
  /** Only filled when no schedule exists. */
  suggestions: Suggestion[];
}

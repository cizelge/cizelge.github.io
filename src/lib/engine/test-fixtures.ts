// Builders shared by engine tests. Not imported by production code.
import type { Course, Meeting, Section } from "../types";
import type { Weights } from "./types";

export const mt = (day: Meeting["day"], start: string, end: string): Meeting => ({
  day,
  start,
  end,
  room: null,
});

export const sec = (id: string, ...meetings: Meeting[]): Section => ({
  id,
  instructors: [],
  capacity: null,
  restrictions: null,
  meetings,
});

export const crs = (code: string, ...sections: Section[]): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: code,
  ects: null,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections,
});

export const NO_WEIGHTS: Weights = { fewDays: 0, fewGaps: 0, lunchBreak: 0, noEarly: 0, noLate: 0 };

/** Canonical string for a schedule, e.g. "CS 101:A|MATH 101:B". */
export const key = (sections: { courseCode: string; sectionId: string }[]) =>
  sections.map((s) => `${s.courseCode}:${s.sectionId}`).join("|");

import { describe, expect, it } from "vitest";
import type { Candidate, ScheduleMetrics, Weights } from "../engine";
import type { Course } from "../types";
import { buildLayouts } from "./layouts";

const course = (code: string, sections: Record<string, [number, string, string][]>): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: code,
  ects: null,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections: Object.entries(sections).map(([id, slots]) => ({
    id,
    instructors: [],
    capacity: null,
    restrictions: null,
    meetings: slots.map(([day, start, end]) => ({ day: day as 1, start, end, room: null })),
  })),
});

const courses = [
  course("CS 201", { A: [[3, "16:40", "18:30"]], B: [[3, "16:40", "18:30"]], C: [[1, "08:40", "10:30"]] }),
  course("MATH 211", { A: [[2, "08:40", "10:30"]], B: [[2, "08:40", "10:30"]] }),
];

const metrics = (days: number): ScheduleMetrics => ({
  days,
  gapMinutes: 0,
  noLunchDays: 0,
  earlyCount: 0,
  lateCount: 0,
  earliestStart: null,
  latestEnd: null,
});

const candidate = (cs: string, math: string, days: number): Candidate => ({
  sections: [
    { courseCode: "CS 201", sectionId: cs },
    { courseCode: "MATH 211", sectionId: math },
  ],
  metrics: metrics(days),
});

const weights: Weights = { fewDays: 1, fewGaps: 0, lunchBreak: 0, noEarly: 0, noLate: 0 };

describe("buildLayouts", () => {
  it("keeps every schedule and groups same-time sections of any course into one layout", () => {
    const candidates = [candidate("C", "A", 3), candidate("A", "A", 2), candidate("B", "B", 2), candidate("A", "B", 2), candidate("C", "B", 3)];
    const { groups } = buildLayouts(candidates, courses, weights);
    expect(groups).toEqual([
      [1, 2, 3],
      [0, 4],
    ]);
    expect(groups.flat().sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("orders layouts by their best schedule and schedules inside a layout by score", () => {
    const candidates = [candidate("A", "A", 4), candidate("C", "A", 2), candidate("B", "A", 1)];
    const { groups, scores } = buildLayouts(candidates, courses, weights);
    expect(groups).toEqual([[2, 0], [1]]);
    expect(Array.from(scores)).toEqual([4, 2, 1]);
  });
});

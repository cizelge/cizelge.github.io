import { describe, expect, it } from "vitest";
import type { Course } from "@/lib/types";
import type { RankedSchedule } from "@/lib/engine";
import { groupSchedules } from "./ScheduleStrip";

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

const courses = new Map(
  [
    course("CS 201", { A: [[3, "16:40", "18:30"]], B: [[3, "16:40", "18:30"]], C: [[1, "08:40", "10:30"]] }),
    course("MATH 211", { A: [[2, "08:40", "10:30"]] }),
  ].map((c) => [c.code, c]),
);

const schedule = (cs: string): RankedSchedule => ({
  sections: [
    { courseCode: "CS 201", sectionId: cs },
    { courseCode: "MATH 211", sectionId: "A" },
  ],
  score: 0,
  summary: { days: 2, gapMinutes: 0, earliestStart: null, latestEnd: null },
});

describe("groupSchedules", () => {
  it("merges schedules whose weekly layout is identical and keeps rank order", () => {
    const groups = groupSchedules([schedule("A"), schedule("C"), schedule("B")], courses);
    expect(groups).toEqual([
      { first: 0, members: [0, 2] },
      { first: 1, members: [1] },
    ]);
  });
});

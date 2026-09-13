import { describe, expect, it } from "vitest";
import type { Course } from "../types";
import { buildIcs } from "./ics";

const course: Course = {
  code: "MGMT 503",
  slug: "mgmt-503",
  title: "Yönetim",
  ects: 7.5,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections: [
    {
      id: "A",
      instructors: ["X"],
      capacity: null,
      restrictions: null,
      meetings: [
        { day: 6, start: "09:00", end: "12:50", room: null },
        { day: 7, start: "13:00", end: "16:50", room: null },
      ],
    },
  ],
};

describe("buildIcs", () => {
  it("places Saturday and Sunday meetings on the right date and weekday code", () => {
    // 2026-09-21 is a Monday
    const ics = buildIcs([{ courseCode: "MGMT 503", sectionId: "A" }], new Map([["MGMT 503", course]]), new Date(2026, 8, 21));
    expect(ics).toContain("DTSTART;TZID=Europe/Istanbul:20260926T090000");
    expect(ics).toContain("BYDAY=SA");
    expect(ics).toContain("DTSTART;TZID=Europe/Istanbul:20260927T130000");
    expect(ics).toContain("BYDAY=SU");
    expect(ics).not.toContain("BYDAY=undefined");
  });
});

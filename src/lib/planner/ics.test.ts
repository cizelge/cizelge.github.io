import { describe, expect, it } from "vitest";
import type { Course } from "../types";
import { OZYEGIN_CALENDAR } from "../calendar";
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

const cs201: Course = {
  ...course,
  code: "CS 201",
  slug: "cs-201",
  title: "Veri Yapıları",
  sections: [{ id: "A", instructors: ["EMRE SEFER"], capacity: null, restrictions: null, meetings: [{ day: 3, start: "16:40", end: "18:30", room: "AB1 233" }] }],
};

describe("buildIcs", () => {
  it("places Saturday and Sunday meetings on the right date and weekday code (no calendar)", () => {
    // 2026-09-21 is a Monday
    const ics = buildIcs([{ courseCode: "MGMT 503", sectionId: "A" }], new Map([["MGMT 503", course]]), new Date(2026, 8, 21));
    expect(ics).toContain("DTSTART;TZID=Europe/Istanbul:20260926T090000");
    expect(ics).toContain("BYDAY=SA");
    expect(ics).toContain("DTSTART;TZID=Europe/Istanbul:20260927T130000");
    expect(ics).toContain("BYDAY=SU");
    expect(ics).toContain("COUNT=14");
    expect(ics).not.toContain("BYDAY=undefined");
  });

  it("uses the academic calendar: real start, until the last class day, holidays skipped, makeups added", () => {
    const ics = buildIcs([{ courseCode: "CS 201", sectionId: "A" }], new Map([["CS 201", cs201]]), {
      kind: "calendar",
      calendar: OZYEGIN_CALENDAR["2026-2027-guz"],
    });
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("DTSTART;TZID=Europe/Istanbul:20260923T164000");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=20261225T205959Z;BYDAY=WE");
    expect(ics).toContain("EXDATE;TZID=Europe/Istanbul:20261028T164000");
    expect(ics).toContain("DTSTART;TZID=Europe/Istanbul:20261107T164000");
    expect(ics).toContain("LOCATION:AB1 233");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });
});

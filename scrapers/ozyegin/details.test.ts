import { describe, expect, it } from "vitest";
import type { TermData } from "../../src/lib/types";
import { applySectionDetails, displayRoom, type RawDetailsExport } from "./details";

const term: TermData = {
  schoolId: "ozyegin",
  termId: "2026-2027-guz",
  termLabel: "2026 - 2027 Güz",
  fetchedAt: "2026-09-13T00:00:00.000Z",
  courses: [
    {
      code: "CE 112",
      slug: "ce-112",
      title: "Statik",
      ects: 6,
      localCredits: null,
      prerequisites: "",
      corequisites: [],
      sections: [
        {
          id: "A",
          instructors: [],
          capacity: null,
          restrictions: null,
          meetings: [
            { day: 2, start: "10:40", end: "12:30", room: null },
            { day: 4, start: "10:40", end: "11:30", room: null },
          ],
        },
        { id: "B", instructors: [], capacity: null, restrictions: null, meetings: [{ day: 1, start: "08:40", end: "10:30", room: null }] },
      ],
    },
    {
      code: "SEC 201L",
      slug: "sec-201l",
      title: "Lab",
      ects: 0,
      localCredits: null,
      prerequisites: "",
      corequisites: [],
      sections: [{ id: "A", instructors: [], capacity: null, restrictions: null, meetings: [{ day: 2, start: "15:40", end: "16:30", room: null }] }],
    },
  ],
};

const details: RawDetailsExport = {
  source: "ozyegin-sis-section-detail",
  termLabel: "2026 - 2027 Güz",
  exportedAt: "2026-09-14T06:00:00.000Z",
  sections: {
    "CE 112.A": {
      kota: "55",
      kayitli: "12",
      rooms: [
        { day: 2, start: "10:40", room: "CK.EF_AB1.245" },
        { day: 4, start: "10:40", room: "CK.EF_AB1.201" },
      ],
    },
    "CE 112.B": { error: "pencere açılmadı" },
    "SEC 201L.A": {
      kota: "125",
      rooms: [
        { day: 2, start: "15:40", room: "CK.SCOLA.129" },
        { day: 2, start: "15:40", room: "CK.SCOLA.127" },
        { day: 2, start: "15:40", room: "CK.SCOLA.127" },
      ],
    },
    "XYZ 999.A": { kota: "10", rooms: [] },
  },
};

describe("applySectionDetails", () => {
  const { term: out, report } = applySectionDetails(term, details);

  it("sets capacity and matches rooms by day and start time", () => {
    const a = out.courses[0].sections[0];
    expect(a.capacity).toBe(55);
    expect(a.meetings.map((m) => m.room)).toEqual(["EF_AB1.245", "EF_AB1.201"]);
  });

  it("joins split rooms for the same meeting once each, sorted", () => {
    expect(out.courses[1].sections[0].meetings[0].room).toBe("SCOLA.127, SCOLA.129");
  });

  it("leaves sections without detail untouched and reports them", () => {
    expect(out.courses[0].sections[1]).toEqual(term.courses[0].sections[1]);
    expect(report.sectionsWithoutDetail).toEqual(["CE 112.B"]);
    expect(report.unknownKeys).toEqual(["XYZ 999.A"]);
    expect(report.sectionsUpdated).toBe(2);
    expect(report.meetingsWithRoom).toBe(3);
    expect(report.meetingsWithoutRoom).toBe(1);
  });

  it("does not store the enrolment count", () => {
    expect(JSON.stringify(out)).not.toContain("kayitli");
  });
});

describe("displayRoom", () => {
  it("drops the campus prefix", () => {
    expect(displayRoom("CK.EF_AB1.245")).toBe("EF_AB1.245");
    expect(displayRoom("AB1 233")).toBe("AB1 233");
  });
});

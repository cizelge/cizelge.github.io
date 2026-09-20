import { describe, expect, it } from "vitest";
import type { Course, Meeting } from "../types";
import { busyMask } from "./free-time";
import { sharedLabel, sharedSections, type OtherMeeting } from "./shared-sections";

const m = (day: Meeting["day"], start: string, end: string): Meeting => ({ day, start, end, room: null });

const course: Course = {
  code: "CS 201",
  slug: "cs-201",
  title: "Veri Yapıları",
  ects: 6,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections: [
    { id: "A", instructors: ["HASAN SÖZER"], capacity: null, restrictions: null, meetings: [m(1, "08:40", "10:30")] },
    { id: "B", instructors: ["EMRE SEFER"], capacity: null, restrictions: null, meetings: [m(3, "13:40", "15:30")] },
    { id: "C", instructors: [], capacity: null, restrictions: null, meetings: [m(5, "16:40", "18:30")] },
    { id: "D", instructors: [], capacity: null, restrictions: null, meetings: [] },
  ],
};

const mine: OtherMeeting[] = [
  { courseCode: "MATH 211", day: 1, start: "08:40", end: "10:30" },
  { courseCode: "CS 201", day: 3, start: "13:40", end: "15:30" },
];

describe("sharedSections", () => {
  it("kendi çakışmanı ve arkadaşının dolu saatini ayrı ayrı görür", () => {
    const friend = busyMask([{ day: 5, start: "16:40", end: "18:30" }]);
    const rows = sharedSections(course, mine, friend);
    const by = Object.fromEntries(rows.map((r) => [r.sectionId, r]));

    expect(by.A).toMatchObject({ myClash: ["MATH 211"], friendBusy: false, bothFree: false });
    expect(by.B).toMatchObject({ myClash: [], friendBusy: false, bothFree: true });
    expect(by.C).toMatchObject({ myClash: [], friendBusy: true, bothFree: false });
  });

  it("dersin kendi oturumları çakışma sayılmaz", () => {
    // B şubesi, programdaki CS 201 oturumuyla aynı saatte ama aynı ders olduğu için çakışma yok.
    const rows = sharedSections(course, mine, busyMask([]));
    expect(rows.find((r) => r.sectionId === "B")?.myClash).toEqual([]);
  });

  it("saatsiz şube ikisine de uyar", () => {
    const rows = sharedSections(course, mine, busyMask([{ day: 1, start: "08:40", end: "18:30" }]));
    expect(rows.find((r) => r.sectionId === "D")?.bothFree).toBe(true);
  });

  it("iki taraf da doluysa ikisini de bildirir", () => {
    const friend = busyMask([{ day: 1, start: "09:00", end: "10:00" }]);
    const a = sharedSections(course, mine, friend).find((r) => r.sectionId === "A")!;
    expect(a).toMatchObject({ friendBusy: true, bothFree: false });
    expect(a.myClash).toEqual(["MATH 211"]);
  });
});

describe("sharedLabel", () => {
  const base = { sectionId: "A", instructors: [], meetings: [] };

  it("uygun şubeyi olumlu yazar", () => {
    expect(sharedLabel({ ...base, myClash: [], friendBusy: false, bothFree: true })).toBe("İkiniz de alabilirsiniz");
  });

  it("kendi çakışmanı ders adıyla söyler", () => {
    expect(sharedLabel({ ...base, myClash: ["MATH 211"], friendBusy: false, bothFree: false })).toContain("MATH 211");
  });

  it("arkadaşın doluysa onu söyler", () => {
    expect(sharedLabel({ ...base, myClash: [], friendBusy: true, bothFree: false })).toBe("Arkadaşının o saatte dersi var");
  });

  it("ikisi de doluysa ikisini de söyler", () => {
    const text = sharedLabel({ ...base, myClash: ["CS 101"], friendBusy: true, bothFree: false });
    expect(text).toContain("CS 101");
    expect(text).toContain("arkadaşında da ders var");
  });
});

import { describe, expect, it } from "vitest";
import type { Course, Meeting } from "../types";
import { detectChanges, prereqWarnings, snapshotOf, type SectionSnapshot } from "./warnings";

const m = (day: Meeting["day"], start: string, end: string): Meeting => ({ day, start, end, room: null });

const course = (code: string, sections: Record<string, { times: Meeting[]; who: string[] }>, prerequisites = ""): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: `${code} adı`,
  ects: 6,
  localCredits: null,
  prerequisites,
  corequisites: [],
  sections: Object.entries(sections).map(([id, s]) => ({ id, instructors: s.who, capacity: null, restrictions: null, meetings: s.times })),
});

const courses = new Map<string, Course>([
  ["CS 201", course("CS 201", { A: { times: [m(3, "16:40", "18:30")], who: ["EMRE SEFER"] } }, "CS 102 and CS 112")],
  ["MATH 211", course("MATH 211", { A: { times: [m(1, "08:40", "10:30")], who: ["AYŞE KAYA"] } })],
]);

describe("snapshotOf / detectChanges", () => {
  const saved = snapshotOf(
    [
      { courseCode: "CS 201", sectionId: "A" },
      { courseCode: "MATH 211", sectionId: "A" },
    ],
    courses,
  );

  it("değişiklik yoksa boş liste", () => {
    expect(detectChanges(saved, courses, ["CS 201", "MATH 211"])).toEqual([]);
  });

  it("saat ve hoca değişikliğini yakalar", () => {
    const yeni = new Map(courses);
    yeni.set("CS 201", course("CS 201", { A: { times: [m(2, "13:40", "15:30")], who: ["HASAN SÖZER"] } }));
    const changes = detectChanges(saved, yeni, ["CS 201", "MATH 211"]);
    expect(changes).toEqual([
      { kind: "time", code: "CS 201", sectionId: "A", before: ["3 16:40-18:30"], after: ["2 13:40-15:30"] },
      { kind: "instructor", code: "CS 201", sectionId: "A", before: ["EMRE SEFER"], after: ["HASAN SÖZER"] },
    ]);
  });

  it("kapanan şubeyi ve kalkan dersi ayırır", () => {
    const yeni = new Map(courses);
    yeni.set("CS 201", course("CS 201", { B: { times: [m(4, "09:40", "11:30")], who: [] } }));
    yeni.delete("MATH 211");
    expect(detectChanges(saved, yeni, ["CS 201", "MATH 211"])).toEqual([
      { kind: "sectionGone", code: "CS 201", sectionId: "A", left: 1 },
      { kind: "courseGone", code: "MATH 211" },
    ]);
  });

  it("sepetten çıkarılan ders için uyarı üretmez", () => {
    const yeni = new Map(courses);
    yeni.delete("MATH 211");
    expect(detectChanges(saved, yeni, ["CS 201"])).toEqual([]);
  });
});

describe("prereqWarnings", () => {
  it("yol haritası boşsa hiç uyarı yok", () => {
    expect(prereqWarnings(["CS 201"], courses, new Set())).toEqual([]);
  });

  it("hepsi gerekliyse eksik dersleri sayar", () => {
    const [uyari] = prereqWarnings(["MATH 211"], new Map([["MATH 211", { ...courses.get("MATH 211")!, prerequisites: "MATH 103 and MATH 104" }]]), new Set(["MATH 103"]));
    expect(uyari).toMatchObject({ code: "MATH 211", state: "missing", missing: ["MATH 104"] });
  });

  it("\"veya\" içeren koşulda ders saymaz, yalnızca metni gösterir", () => {
    const veya = new Map([["CS 350", course("CS 350", { A: { times: [], who: [] } }, "CS 102 or CS 105")]]);
    const [uyari] = prereqWarnings(["CS 350"], veya, new Set(["MATH 112"]));
    expect(uyari).toMatchObject({ code: "CS 350", state: "missing", missing: [] });
  });

  it("ön şart sağlanıyorsa susar", () => {
    expect(prereqWarnings(["CS 201"], courses, new Set(["CS 102", "CS 112"]))).toEqual([]);
  });

  it("eksik ders aynı dönem sepette ise uyarmaz", () => {
    expect(prereqWarnings(["CS 201", "CS 112"], courses, new Set(["CS 102"]))).toEqual([]);
  });

  it("okunamayan ön şartı 'bilinmiyor' sayar", () => {
    const belirsiz = new Map(courses);
    belirsiz.set("XX 400", course("XX 400", { A: { times: [], who: [] } }, "Bölüm onayı ve en az iki proje dersi"));
    const [uyari] = prereqWarnings(["XX 400"], belirsiz, new Set(["CS 102"]));
    expect(uyari).toMatchObject({ code: "XX 400", state: "unknown" });
  });

  it("ön şart metni olmayan dersi atlar", () => {
    expect(prereqWarnings(["MATH 211"], courses, new Set(["CS 102"]))).toEqual([]);
  });
});

describe("kayıt biçimi", () => {
  it("snapshot saat ve hocaları sıralı tutar", () => {
    const saved: SectionSnapshot[] = snapshotOf([{ courseCode: "CS 201", sectionId: "A" }], courses);
    expect(saved).toEqual([{ code: "CS 201", sectionId: "A", times: ["3 16:40-18:30"], instructors: ["EMRE SEFER"] }]);
  });
});

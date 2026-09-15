import { describe, expect, it } from "vitest";
import type { Course, Section, TermData } from "../../src/lib/types";
import { countParts, inScope, mergeOfferings, sameContent } from "./merge-offerings";

const sec = (id: string, instructors: string[], meetings: Section["meetings"], capacity: number | null = null): Section => ({
  id,
  instructors,
  capacity,
  restrictions: null,
  meetings,
});

const course = (code: string, sections: Section[], extra: Partial<Course> = {}): Course => ({
  code,
  slug: code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  title: `${code} adı`,
  ects: null,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections,
  ...extra,
});

const existing: TermData = {
  schoolId: "ozyegin",
  termId: "2026-2027-guz",
  termLabel: "2026 - 2027 Güz",
  fetchedAt: "2026-09-13T00:00:00.000Z",
  courses: [
    course(
      "CS 201",
      [
        sec("A", ["EMRE SEFER"], [{ day: 3, start: "16:40", end: "18:30", room: "AB1.245" }], 60),
        sec("B", ["HASAN SÖZER"], [{ day: 3, start: "16:40", end: "18:30", room: "AB1.246" }], 40),
      ],
      { title: "Veri Yapıları", ects: 6, prerequisites: "CS 102", corequisites: ["CS 201L"] },
    ),
    course("CS 201L", [sec("A", [], [{ day: 5, start: "10:40", end: "12:30", room: "LAB" }], 30)]),
    course("CS 350", [
      sec("A", ["İSMAİL ARI"], [
        { day: 1, start: "10:40", end: "12:30", room: "R1" },
        { day: 3, start: "10:40", end: "11:30", room: "R2" },
      ], 50),
    ]),
    course("FIN 421", [sec("A", ["LEVENT GÜNTAY"], [{ day: 4, start: "10:40", end: "13:30", room: "G12" }])]),
    course("MGMT 501", [sec("A", ["X"], [], 20)]),
  ],
};

const page = (): Course[] => [
  course("CS 201", [
    // A değişmedi, B'nin hocası değişti, C yeni.
    sec("A", ["EMRE SEFER"], [{ day: 3, start: "16:40", end: "18:30", room: null }]),
    sec("B", ["YENİ HOCA"], [{ day: 3, start: "16:40", end: "18:30", room: null }]),
    sec("C", ["HASAN SÖZER"], [{ day: 4, start: "08:40", end: "10:30", room: null }]),
  ], { title: "Veri Yapıları" }),
  // Pazartesi oturumunun bitişi değişti, Çarşamba kaldırıldı, Cuma eklendi.
  course("CS 350", [
    sec("A", ["İSMAİL ARI"], [
      { day: 1, start: "10:40", end: "13:30", room: null },
      { day: 5, start: "09:40", end: "10:30", room: null },
    ]),
  ]),
  course("CS 999", [sec("A", ["YENİ"], [{ day: 2, start: "12:40", end: "14:30", room: null }])]),
];

const fetchedAt = "2026-09-15T04:17:00.000Z";

describe("inScope", () => {
  it("yalnızca 100-499 arası eksiz dersler", () => {
    expect(["CS 201", "FIN 421"].every(inScope)).toBe(true);
    expect(["CS 201L", "MATH 101R", "SAS 405_U", "PSY 481-03", "MGMT 501", "CS 999"].some(inScope)).toBe(false);
  });
});

describe("mergeOfferings", () => {
  const { term, report } = mergeOfferings(existing, page(), { fetchedAt });
  const get = (code: string) => term.courses.find((c) => c.code === code);

  it("değişmeyen şubenin kapasitesini, dersliğini ve dersin AKTS/koşullarını korur", () => {
    expect(get("CS 201")).toMatchObject({ ects: 6, prerequisites: "CS 102", corequisites: ["CS 201L"] });
    expect(get("CS 201")!.sections[0]).toEqual(existing.courses[0].sections[0]);
  });

  it("hoca değişince kapasiteyi ve dersliği korur", () => {
    expect(get("CS 201")!.sections[1]).toEqual({
      ...existing.courses[0].sections[1],
      instructors: ["YENİ HOCA"],
    });
    expect(report.instructorChanges).toEqual([{ key: "CS 201.B", before: ["HASAN SÖZER"], after: ["YENİ HOCA"] }]);
  });

  it("saat değişince aynı gün+başlangıçtaki dersliği korur, diğerlerini boşaltır", () => {
    expect(get("CS 350")!.sections[0]).toMatchObject({
      capacity: 50,
      meetings: [
        { day: 1, start: "10:40", end: "13:30", room: "R1" },
        { day: 5, start: "09:40", end: "10:30", room: null },
      ],
    });
    expect(report.timeChanges).toEqual([
      { key: "CS 350.A", before: "Pzt 10:40-12:30, Çar 10:40-11:30", after: "Pzt 10:40-13:30, Cum 09:40-10:30" },
    ]);
  });

  it("ders ve şube ekler; kapsam içi kayıp dersi siler, kapsam dışını korur", () => {
    expect(report.addedCourses).toEqual(["CS 999"]);
    expect(report.addedSections).toEqual(["CS 201.C", "CS 999.A"]);
    expect(get("CS 201")!.sections.map((s) => s.id)).toEqual(["A", "B", "C"]);
    expect(get("CS 201")!.sections[2].capacity).toBeNull();
    expect(report.removedCourses).toEqual(["FIN 421"]);
    expect(get("FIN 421")).toBeUndefined();
    expect(get("CS 201L")).toEqual(existing.courses[1]);
    expect(get("MGMT 501")).toEqual(existing.courses[4]);
    expect(report.keptOutOfScope).toBe(2);
    expect(term.courses.map((c) => c.code)).toEqual(["CS 201", "CS 201L", "CS 350", "CS 999", "MGMT 501"]);
    expect(term.fetchedAt).toBe(fetchedAt);
    expect(report.refusal).toBeNull();
  });

  it("sayfada olmayan ama SIS kotası doğrulanmış dersi silmez, raporlar", () => {
    const withCapacity: TermData = {
      ...existing,
      courses: existing.courses.map((c) => (c.code === "FIN 421" ? { ...c, sections: c.sections.map((s) => ({ ...s, capacity: 50 })) } : c)),
    };
    const { term: t, report: r } = mergeOfferings(withCapacity, page(), { fetchedAt });
    expect(r.removedCourses).toEqual([]);
    expect(r.keptVerified).toEqual(["FIN 421"]);
    expect(t.courses.some((c) => c.code === "FIN 421")).toBe(true);
  });

  it("dersi kalan ama sayfada olmayan şubeyi siler", () => {
    const p = page();
    p[0].sections = p[0].sections.filter((s) => s.id !== "B");
    const r = mergeOfferings(existing, p, { fetchedAt }).report;
    expect(r.removedSections).toEqual(["CS 201.B"]);
  });

  it("girdileri değiştirmez", () => {
    const snapshot = JSON.stringify(existing);
    mergeOfferings(existing, page(), { fetchedAt });
    expect(JSON.stringify(existing)).toBe(snapshot);
  });

  it("aynı içerikte yalnızca fetchedAt değişir", () => {
    const same = existing.courses.map((c) => ({
      ...c,
      sections: c.sections.map((s) => ({ ...s, capacity: null, meetings: s.meetings.map((m) => ({ ...m, room: null })) })),
    }));
    const r = mergeOfferings(existing, same, { fetchedAt });
    expect(sameContent(r.term, existing)).toBe(true);
    expect(countParts(r.report)).toEqual([]);
  });

  it("sayım: yeni dersin şubeleri ayrıca sayılmaz", () => {
    expect(countParts(report)).toEqual(["+1 ders", "-1 ders", "+1 şube", "1 saat", "1 hoca"]);
  });
});

describe("güvenlik eşiği", () => {
  it("kapsam içi şubelerin yarısından azı bulunursa reddeder", () => {
    // Kapsam içi mevcut şubeler: CS 201.A, CS 201.B, CS 350.A, FIN 421.A. Yalnızca biri bulunuyor.
    const r = mergeOfferings(existing, [course("CS 201", [sec("A", [], [])])], { fetchedAt }).report;
    expect(r.foundRatio).toBe(0.25);
    expect(r.refusal).toMatch(/%25/);
  });

  it("tam yarı bulunursa kabul eder", () => {
    const r = mergeOfferings(existing, [course("CS 201", [sec("A", [], []), sec("B", [], [])])], { fetchedAt }).report;
    expect(r.foundRatio).toBe(0.5);
    expect(r.refusal).toBeNull();
  });

  it("boş sayfayı reddeder", () => {
    expect(mergeOfferings(existing, [], { fetchedAt }).report.refusal).toMatch(/hiç ders/);
  });
});

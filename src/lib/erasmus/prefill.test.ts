import { describe, expect, it } from "vitest";
import { computeGpa, gradeEntries } from "../roadmap/gpa";
import { passedEcts } from "../roadmap/progress";
import { programRequirements } from "../roadmap/requirements";
import { EMPTY_STATE, type RoadmapState } from "../roadmap/storage";
import type { Program } from "../types";
import {
  buildCodeCredits,
  EMPTY_ERASMUS_PROFILE,
  EMPTY_PREFILL,
  erasmusPrefill,
  parseErasmusProfile,
  serializeErasmusProfile,
  slimPrograms,
  validateErasmusProfile,
  type ErasmusProfile,
} from "./prefill";

const programs: Program[] = [
  {
    id: "BSCS",
    slug: "bscs",
    name: "Bilgisayar Mühendisliği",
    faculty: "Mühendislik",
    semesters: [
      {
        year: 0,
        season: "guz",
        label: "Hazırlık",
        credits: null,
        items: [{ kind: "course", code: "ENG 001", title: "English", credits: 0, prerequisites: "", corequisites: [] }],
      },
      {
        year: 1,
        season: "guz",
        label: "1. Yıl - Güz",
        credits: 30,
        items: [
          { kind: "course", code: "CS 101", title: "Programlamaya giriş", credits: 7.5, prerequisites: "", corequisites: [] },
          { kind: "course", code: "MATH 103", title: "Kalkülüs I", credits: 6, prerequisites: "", corequisites: [] },
          { kind: "elective", label: "Serbest seçmeli", credits: 5, pool: null },
        ],
      },
      {
        year: 2,
        season: "bahar",
        label: "2. Yıl - Bahar",
        credits: 30,
        items: [
          { kind: "course", code: "CS 201", title: "Veri yapıları", credits: 7.5, prerequisites: "CS 101", corequisites: [] },
          {
            kind: "elective",
            label: "Program içi seçmeli",
            credits: 6,
            pool: [
              { code: "CS 321", title: "Yapay zekâ", credits: 6 },
              { code: "CS 333", title: "Veritabanı", credits: 5 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "BSMATH",
    slug: "bsmath",
    name: "Matematik",
    faculty: "Mühendislik",
    semesters: [
      {
        year: 1,
        season: "guz",
        label: "1. Yıl - Güz",
        credits: 12,
        items: [
          { kind: "course", code: "MATH 103", title: "Kalkülüs I", credits: 6, prerequisites: "", corequisites: [] },
          { kind: "course", code: "MATH 201", title: "Doğrusal cebir", credits: 6, prerequisites: "", corequisites: [] },
        ],
      },
    ],
  },
];

const state: RoadmapState = {
  ...EMPTY_STATE,
  anadal: "BSCS",
  completion: { "BSCS:y1-guz:0": true, "BSCS:y1-guz:1": true },
  grades: { "BSCS:y1-guz:0": "A", "BSCS:y1-guz:1": "B" },
};

describe("erasmusPrefill", () => {
  it("yol haritası hesaplarıyla aynı ortalama ve AKTS", () => {
    const list = [programRequirements(programs[0], "anadal")];
    const p = erasmusPrefill(state, programs);
    expect(p.hasRoadmap).toBe(true);
    expect(p.programName).toBe("Bilgisayar Mühendisliği");
    expect(p.gpa).toBe(computeGpa(gradeEntries(list, state.completion, state.grades)).gpa);
    expect(p.ects).toBe(passedEcts(list, state.completion));
    expect(p.ects).toBe(13.5);
  });

  it("kalan gereksinimler müfredat sırasıyla, hazırlık ve geçilenler hariç", () => {
    const p = erasmusPrefill(state, programs);
    expect(p.remainingRequirements.map((r) => r.id)).toEqual(["BSCS:y1-guz:2", "BSCS:y2-bahar:0", "BSCS:y2-bahar:1"]);
    expect(p.remainingRequirements[1]).toEqual({
      id: "BSCS:y2-bahar:0",
      code: "CS 201",
      title: "Veri yapıları",
      credits: 7.5,
      programName: "Bilgisayar Mühendisliği",
      slotLabel: "2. yıl Bahar",
    });
  });

  it("çift anadalda geçilen ya da tekrarlanan ders bir kez", () => {
    const p = erasmusPrefill({ ...state, cap: "BSMATH" }, programs);
    expect(p.programName).toBe("Bilgisayar Mühendisliği ve Matematik (ÇAP)");
    const math = p.remainingRequirements.filter((r) => r.programName === "Matematik");
    // MATH 103 anadalda geçildi: ÇAP'ta da tamamlanmış sayılır.
    expect(math.map((r) => r.code)).toEqual(["MATH 201"]);
  });

  it("anadal yoksa boş", () => {
    expect(erasmusPrefill(EMPTY_STATE, programs)).toEqual(EMPTY_PREFILL);
    expect(erasmusPrefill({ ...state, anadal: "YOK" }, programs)).toEqual(EMPTY_PREFILL);
  });

  it("not ve işaret yoksa ortalama ve AKTS bilinmez, bütün dersler kalır", () => {
    const p = erasmusPrefill({ ...EMPTY_STATE, anadal: "BSCS" }, programs);
    expect(p.gpa).toBeNull();
    expect(p.ects).toBeNull();
    expect(p.remainingRequirements).toHaveLength(5);
  });

  it("hafif müfredatla aynı sonuç", () => {
    expect(erasmusPrefill({ ...state, cap: "BSMATH" }, slimPrograms(programs))).toEqual(
      erasmusPrefill({ ...state, cap: "BSMATH" }, programs),
    );
  });
});

describe("slimPrograms", () => {
  it("ön koşul ve havuz adlarını çıkarır, kod ve AKTS kalır", () => {
    const slim = slimPrograms(programs);
    const item = slim[0].semesters[2].items[0];
    expect(item).toMatchObject({ kind: "course", code: "CS 201", prerequisites: "" });
    const pool = slim[0].semesters[2].items[1];
    expect(pool.kind === "elective" && pool.pool).toEqual([
      { code: "CS 321", title: "", credits: 6 },
      { code: "CS 333", title: "", credits: 5 },
    ]);
  });
});

describe("buildCodeCredits", () => {
  it("müfredat ve havuz derslerinin AKTS'si, yazımdan bağımsız anahtarla", () => {
    const m = buildCodeCredits(programs);
    expect(m.get("CS 201")).toBe(7.5);
    expect(m.get("CS 333")).toBe(5);
    expect(m.has("ENG 001")).toBe(false); // 0 AKTS sayılmaz
  });
});

describe("Erasmus bilgileri kaydı", () => {
  const full: ErasmusProfile = {
    gpa: 3.1,
    ects: 84,
    ele: 72,
    criteria: { previous: 2, disability: 1 },
    target: 80,
    grant: { group: "Grup 3", months: 5, km: 1500, green: true, disadvantaged: false },
  };

  it("yazıp okuyunca aynı", () => {
    expect(parseErasmusProfile(serializeErasmusProfile(full))).toEqual(full);
  });

  it("bozuk kayıt boş bilgiye döner, geçersiz alanlar ayıklanır", () => {
    expect(parseErasmusProfile("{")).toEqual(EMPTY_ERASMUS_PROFILE);
    expect(parseErasmusProfile(null)).toEqual(EMPTY_ERASMUS_PROFILE);
    expect(
      validateErasmusProfile({ version: 1, ...full, gpa: 5, ele: -1, criteria: { a: 0, b: 1.5, c: "x", d: 3 }, grant: { months: 0 } }),
    ).toEqual({
      ...full,
      gpa: null,
      ele: null,
      criteria: { d: 3 },
      grant: { group: null, months: null, km: null, green: false, disadvantaged: false },
    });
  });
});

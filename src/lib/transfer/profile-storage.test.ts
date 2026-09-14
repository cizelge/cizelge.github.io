import { describe, expect, it } from "vitest";
import { computeGpa, gradeEntries } from "../roadmap/gpa";
import { passedEcts } from "../roadmap/progress";
import { programRequirements } from "../roadmap/requirements";
import { EMPTY_STATE, type RoadmapState } from "../roadmap/storage";
import type { Program } from "../types";
import {
  buildPrefillIndex,
  EMPTY_PROFILE,
  mergeProfile,
  parseDecimalInput,
  parseIntegerInput,
  parseProfile,
  prefillFromRoadmap,
  serializeProfile,
  validateProfile,
} from "./profile-storage";
import type { StudentProfile } from "./types";

const full: StudentProfile = {
  programId: "BSCS",
  gpa: 2.72,
  completedSemesters: 3,
  completedCredits: 84,
  hasFailedCourse: false,
  entryYear: 2024,
  scoreType: "SAY",
  score: 412.5,
  rank: 125000,
  top20: null,
};

describe("validateProfile", () => {
  it("geçerli bilgiyi olduğu gibi döndürür", () => {
    expect(validateProfile({ version: 1, ...full })).toEqual(full);
  });

  it("biçim ya da sürüm yanlışsa boş bilgi", () => {
    for (const raw of [null, 3, "x", [], {}, { ...full, version: 2 }]) {
      expect(validateProfile(raw)).toEqual(EMPTY_PROFILE);
    }
  });

  it("bozuk alanları tek tek boşaltır", () => {
    const p = validateProfile({
      version: 1,
      programId: "",
      gpa: 4.2,
      completedSemesters: 2.5,
      completedCredits: -1,
      hasFailedCourse: "evet",
      entryYear: 1990,
      scoreType: "TYT",
      score: Number.NaN,
      rank: 0,
      top20: true,
    });
    expect(p).toEqual({ ...EMPTY_PROFILE, top20: true });
  });
});

describe("parseProfile / serializeProfile", () => {
  it("gidiş dönüş aynı", () => {
    expect(parseProfile(serializeProfile(full))).toEqual(full);
  });
  it("boş ya da bozuk metin boş bilgi verir", () => {
    expect(parseProfile(null)).toEqual(EMPTY_PROFILE);
    expect(parseProfile("{bozuk")).toEqual(EMPTY_PROFILE);
  });
});

describe("girdi okuma", () => {
  it("ondalık: virgül ya da nokta", () => {
    expect(parseDecimalInput("2,72")).toBe(2.72);
    expect(parseDecimalInput(" 3.1 ")).toBe(3.1);
    expect(parseDecimalInput("3,")).toBe(3);
    expect(parseDecimalInput("")).toBeNull();
    expect(parseDecimalInput("abc")).toBeNull();
    expect(parseDecimalInput("-1")).toBeNull();
  });
  it("tam sayı: binlik ayıracı atılır", () => {
    expect(parseIntegerInput("125.000")).toBe(125000);
    expect(parseIntegerInput("125 000")).toBe(125000);
    expect(parseIntegerInput("84")).toBe(84);
    expect(parseIntegerInput("")).toBeNull();
    expect(parseIntegerInput("1e5")).toBeNull();
  });
});

const programs: Program[] = [
  {
    id: "BSCS",
    slug: "bscs",
    name: "Bilgisayar Mühendisliği",
    faculty: "Mühendislik Fakültesi",
    semesters: [
      {
        year: 1,
        season: "guz",
        label: "1. Yıl - Güz",
        credits: 30,
        items: [
          { kind: "course", code: "CS 101", title: "Programlama", credits: 6, prerequisites: "", corequisites: [] },
          { kind: "course", code: "MATH 103", title: "Kalkülüs", credits: 8, prerequisites: "", corequisites: [] },
          { kind: "course", code: "ENG 101", title: "İngilizce", credits: 4, prerequisites: "", corequisites: [] },
          {
            kind: "elective",
            label: "Program-İçi Seçmeli",
            credits: 6,
            pool: [
              { code: "CS 350", title: "Yapay zeka", credits: 7 },
              { code: "CS 351", title: "Veri", credits: 6 },
            ],
          },
          { kind: "elective", label: "Serbest Seçmeli", credits: 5, pool: null },
        ],
      },
    ],
  },
  {
    id: "BSEE",
    slug: "bsee",
    name: "Elektrik-Elektronik Mühendisliği",
    faculty: "Mühendislik Fakültesi",
    semesters: [
      {
        year: 1,
        season: "guz",
        label: "1. Yıl - Güz",
        credits: 30,
        items: [
          { kind: "course", code: "MATH 103", title: "Kalkülüs", credits: 8, prerequisites: "", corequisites: [] },
          { kind: "course", code: "EE 201", title: "Devreler", credits: 7, prerequisites: "", corequisites: [] },
        ],
      },
    ],
  },
];

const state: RoadmapState = {
  ...EMPTY_STATE,
  anadal: "BSCS",
  cap: "BSEE",
  completion: {
    "BSCS:y1-guz:0": true,
    "BSCS:y1-guz:1": true,
    "BSCS:y1-guz:3": "CS 350",
    "BSCS:y1-guz:4": true,
    "BSEE:y1-guz:1": true,
  },
  grades: {
    "BSCS:y1-guz:0": "A",
    "BSCS:y1-guz:1": "B-",
    "BSCS:y1-guz:3": "C+",
    "BSCS:y1-guz:4": "B",
    "BSEE:y1-guz:1": "A-",
  },
};

describe("prefillFromRoadmap", () => {
  const index = buildPrefillIndex(programs);

  it("yol haritası hesaplarıyla aynı ortalama ve AKTS", () => {
    const roadmap = [programRequirements(programs[0], "anadal"), programRequirements(programs[1], "cap")];
    const expectedGpa = computeGpa(gradeEntries(roadmap, state.completion, state.grades)).gpa;
    const expectedEcts = passedEcts(roadmap, state.completion);

    const p = prefillFromRoadmap(state, index);
    expect(p.programId).toBe("BSCS");
    expect(p.gpa).toBe(expectedGpa);
    expect(p.completedCredits).toBe(expectedEcts);
    // 6 + 8 + 7 (havuzdan CS 350) + 5 + 7 (EE 201)
    expect(p.completedCredits).toBe(33);
    expect(p.hasFailedCourse).toBeUndefined();
  });

  it("F notu varsa kaldığın ders var", () => {
    const p = prefillFromRoadmap({ ...state, grades: { ...state.grades, "BSCS:y1-guz:2": "F" } }, index);
    expect(p.hasFailedCourse).toBe(true);
  });

  it("anadal yoksa ya da bilinmiyorsa hiçbir şey doldurmaz", () => {
    expect(prefillFromRoadmap(EMPTY_STATE, index)).toEqual({});
    expect(prefillFromRoadmap({ ...state, anadal: "YOK" }, index)).toEqual({});
  });

  it("not ve işaret yoksa yalnızca bölüm", () => {
    expect(prefillFromRoadmap({ ...EMPTY_STATE, anadal: "BSEE" }, index)).toEqual({ programId: "BSEE" });
  });
});

describe("mergeProfile", () => {
  it("yalnızca boş alanları doldurur ve hangilerini doldurduğunu söyler", () => {
    const own = { ...EMPTY_PROFILE, gpa: 3.1 };
    const { profile, prefilled } = mergeProfile(own, { programId: "BSCS", gpa: 2.5, completedCredits: 60 });
    expect(profile).toEqual({ ...EMPTY_PROFILE, programId: "BSCS", gpa: 3.1, completedCredits: 60 });
    expect(prefilled).toEqual(["programId", "completedCredits"]);
  });

  it("kullanıcının boşalttığı alana dokunmaz", () => {
    const { profile, prefilled } = mergeProfile(EMPTY_PROFILE, { gpa: 2.5 }, new Set(["gpa"]));
    expect(profile.gpa).toBeNull();
    expect(prefilled).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import fixture from "./fixtures/programs-sample.json";
import { buildProgramsData, parsePlanCode, parseSemesterHeader, type RawProgramsExport } from "./programs";
import { validateProgramsData } from "../validate";

const raw = fixture as RawProgramsExport;

describe("parsePlanCode", () => {
  it("normalises to SUBJECT NUMBER with one space", () => {
    expect(parsePlanCode("SEC201L")).toBe("SEC 201L");
    expect(parsePlanCode("MATH103")).toBe("MATH 103");
    expect(parsePlanCode("  CS   101 ")).toBe("CS 101");
    expect(parsePlanCode("MİM105L")).toBe("MİM 105L");
    expect(parsePlanCode("cs 101l")).toBe("CS 101L");
  });

  it("returns null for anything that is not a course code", () => {
    expect(parsePlanCode("")).toBeNull();
    expect(parsePlanCode("Seçmeli")).toBeNull();
    expect(parsePlanCode("CS")).toBeNull();
  });
});

describe("parseSemesterHeader", () => {
  it("reads year, season and credits", () => {
    expect(parseSemesterHeader("1. Yıl - Güz (30 Kredi)", 0)).toEqual({ year: 1, season: "guz", credits: 30 });
    expect(parseSemesterHeader("3. Yıl - Bahar (29,5 Kredi)", 2)).toEqual({ year: 3, season: "bahar", credits: 29.5 });
    expect(parseSemesterHeader("2. Yıl - Yaz Stajı", 2)).toEqual({ year: 2, season: "yaz", credits: null });
  });

  it("treats Hazırlık as year 0 and unknown headers as season other in the previous year", () => {
    expect(parseSemesterHeader("Hazırlık Programı", 0)).toEqual({ year: 0, season: "other", credits: null });
    expect(parseSemesterHeader("Hazırlık - Güz", 0)).toEqual({ year: 0, season: "guz", credits: null });
    expect(parseSemesterHeader("Program Notları", 3)).toEqual({ year: 3, season: "other", credits: null });
  });
});

describe("buildProgramsData", () => {
  const { data, warnings } = buildProgramsData(raw);
  const [bscs, arch, bsee] = data.programs;

  it("fills metadata and keeps program order, id and ASCII slug", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(data.fetchedAt).toBe("2026-09-13T18:00:00.000Z");
    expect(data.programs.map((p) => [p.id, p.slug])).toEqual([
      ["BSCS", "bscs"],
      ["BSARCH (TR)", "bsarch-tr"],
      ["BSEE", "bsee"],
    ]);
    expect(arch.name).toBe("Mimarlık (Türkçe)");
    expect(arch.faculty).toBe("Mimarlık ve Tasarım Fakültesi");
  });

  it("splits rows into semesters at header rows", () => {
    expect(bscs.semesters.map((s) => [s.year, s.season, s.credits, s.items.length])).toEqual([
      [1, "guz", 30, 7],
      [1, "bahar", 30, 3],
      [2, "guz", 30, 5],
      [2, "bahar", 30, 2],
      [2, "yaz", null, 1],
    ]);
    expect(bscs.semesters[0].label).toBe("1. Yıl - Güz (30 Kredi)");
  });

  it("parses course rows with normalised codes, credits, prerequisites and corequisites", () => {
    expect(bscs.semesters[0].items[0]).toEqual({
      kind: "course",
      code: "CS 101",
      title: "Bilgisayar Programlama",
      credits: 6,
      prerequisites: "",
      corequisites: ["CS 101L"],
    });
    expect(bscs.semesters[1].items[1]).toMatchObject({ code: "MATH 104", prerequisites: "MATH103", corequisites: ["MATH 104R"] });
    expect(bscs.semesters[2].items[1]).toMatchObject({ kind: "course", code: "SEC 201L", credits: 2 });
    expect(arch.semesters[1].items[1]).toMatchObject({ code: "MİM 105L", corequisites: ["MİM 105"] });
  });

  it("parses elective placeholders and attaches their pools", () => {
    const electives = bscs.semesters[0].items.filter((i) => i.kind === "elective");
    expect(electives).toEqual([
      {
        kind: "elective",
        label: "BSCS Program-İçi Seçmeli",
        credits: 6,
        pool: [
          { code: "CS 110", title: "Mühendislik İçin Hesaplama", credits: 6 },
          { code: "EE 201", title: "Devre Teorisi", credits: 6 },
          { code: "HIST 201", title: "Atatürk İlkeleri ve İnkılap Tarihi I", credits: 2 },
        ],
      },
      { kind: "elective", label: "FE Serbest Seçmeli", credits: 4, pool: null },
    ]);
    // Havuzu toplanmamış etiket: null.
    expect(bsee.semesters[0].items[2]).toEqual({ kind: "elective", label: "Bilinmeyen Seçmeli", credits: 3, pool: null });
  });

  it("keeps Hazırlık as year 0 and unknown headers as season other", () => {
    expect(arch.semesters.map((s) => [s.year, s.season])).toEqual([
      [0, "other"],
      [1, "guz"],
      [1, "other"],
    ]);
  });

  it("warns about rows it skips instead of crashing", () => {
    expect(warnings).toEqual([
      'BSCS "BSCS Program-İçi Seçmeli": boş havuz satırı atlandı',
      'BSARCH (TR): "Açıklama satırı" için havuz yok',
      'BSEE: "Bilinmeyen Seçmeli" için havuz yok',
    ]);
    const odd = buildProgramsData({
      ...raw,
      programs: [
        {
          code: "X",
          name: "X",
          faculty: "F",
          rows: [["CS 101", "Önce başlık yok", "6", "", "", ""], ["1. Yıl - Güz"], ["", "", "", "", "", ""], ["CS 102"]],
          pools: {},
        },
      ],
    });
    expect(odd.data.programs[0].semesters).toEqual([
      {
        year: 0,
        season: "other",
        label: "",
        credits: null,
        items: [{ kind: "course", code: "CS 101", title: "Önce başlık yok", credits: 6, prerequisites: "", corequisites: [] }],
      },
      {
        year: 1,
        season: "guz",
        label: "1. Yıl - Güz",
        credits: null,
        items: [{ kind: "course", code: "CS 102", title: "", credits: null, prerequisites: "", corequisites: [] }],
      },
    ]);
  });

  it("rejects unknown format versions and sources", () => {
    expect(() => buildProgramsData({ ...raw, formatVersion: 2 as 1 })).toThrow(/formatVersion/);
    expect(() => buildProgramsData({ ...raw, programs: undefined as never })).toThrow();
  });

  it("produces data that passes validation", () => {
    expect(validateProgramsData(data)).toEqual([]);
  });
});

describe("validateProgramsData", () => {
  const { data } = buildProgramsData(raw);

  it("reports empty programs, duplicate ids and slugs", () => {
    const bad = {
      ...data,
      programs: [
        data.programs[0],
        { ...data.programs[0], name: "Kopya" },
        data.programs[1],
        { ...data.programs[1], id: "BSARCH-TR" },
        { ...data.programs[2], id: "BOS", slug: "bos", semesters: [{ ...data.programs[2].semesters[0], items: [] }] },
        { ...data.programs[2], id: "BOS2", slug: "bos2", semesters: [] },
      ],
    };
    const errors = validateProgramsData(bad);
    expect(errors).toEqual([
      "Tekrar eden program kodu: BSCS",
      "Tekrar eden program slug: bscs (BSCS)",
      "Tekrar eden program slug: bsarch-tr (BSARCH-TR)",
      "BOS: hiç ders satırı yok",
      "BOS2: hiç ders satırı yok",
    ]);
  });

  it("reports an empty file", () => {
    expect(validateProgramsData({ ...data, programs: [] })).toEqual(["Hiç program yok"]);
  });
});

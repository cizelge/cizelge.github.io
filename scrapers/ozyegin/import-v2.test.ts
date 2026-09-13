// Bilgi hücreleri (koşullar + hoca), dışa aktarma biçimi v2, Türkçe harfli kodlar ve tekrar denetimi.
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/cs101-export.json";
import { buildTermData, courseSlug, parseInfoCells, type RawExport, type RawRowV2 } from "./import";
import { validateTermData } from "../validate";

const raw = fixture as RawExport;

describe("parseInfoCells", () => {
  it("reads an empty conditions cell and an instructor cell", () => {
    expect(parseInfoCells(["", "ALİ ERKAN"])).toEqual({
      corequisites: [],
      prerequisites: "",
      instructors: ["ALİ ERKAN"],
    });
  });

  it("reads corequisites alone", () => {
    expect(parseInfoCells(["Yan koşul: CS 101L", "ALİ ERKAN"])).toEqual({
      corequisites: ["CS 101L"],
      prerequisites: "",
      instructors: ["ALİ ERKAN"],
    });
  });

  it("reads prerequisites alone and splits several instructors on , and /", () => {
    expect(parseInfoCells(["Ön koşul: CS 201 ve MATH 217", "AYŞE YILMAZ, MEHMET ÖZ / CAN KAYA"])).toEqual({
      corequisites: [],
      prerequisites: "CS 201 ve MATH 217",
      instructors: ["AYŞE YILMAZ", "MEHMET ÖZ", "CAN KAYA"],
    });
  });

  it("splits a combined conditions cell into corequisites and prerequisites", () => {
    expect(
      parseInfoCells(["Yan koşul: CS 201L Ön koşul: (CS 102 or CS 105) and (CS112 or MATH 112)", "HASAN SÖZER"]),
    ).toEqual({
      corequisites: ["CS 201L"],
      prerequisites: "(CS 102 or CS 105) and (CS112 or MATH 112)",
      instructors: ["HASAN SÖZER"],
    });
  });

  it("reads a corequisite list before the prerequisites", () => {
    expect(parseInfoCells(["Yan koşul: EE 201, EE 341L Ön koşul: MATH 217 ve MATH 211", ""])).toEqual({
      corequisites: ["EE 201", "EE 341L"],
      prerequisites: "MATH 217 ve MATH 211",
      instructors: [],
    });
  });

  it("keeps dashed topic and internship codes", () => {
    expect(parseInfoCells(["Yan koşul: PSY 481-03, BUS301-11"]).corequisites).toEqual(["PSY 481-03", "BUS 301-11"]);
  });

  it("normalises codes to SUBJECT NUMBER and drops tokens that are not course codes", () => {
    expect(
      parseInfoCells(["Yan koşul: MATH107R; IE  203R and MİM 105 ve SAS 405_U, bölüm onayı"]).corequisites,
    ).toEqual(["MATH 107R", "IE 203R", "MİM 105", "SAS 405_U"]);
  });

  it("handles prerequisites written before corequisites", () => {
    expect(parseInfoCells(["Ön koşul: MATH 101 Yan koşul: MATH 102R"])).toEqual({
      corequisites: ["MATH 102R"],
      prerequisites: "MATH 101",
      instructors: [],
    });
  });
});

const v2Row = (section: string, infoCells: string[], extra: Partial<RawRowV2> = {}): RawRowV2 => ({
  subject: "CS",
  number: "201",
  section,
  title: "Bilgisayar Programlama II",
  creditsText: "6 credits",
  infoCells,
  meetings: [{ dayText: "Pazartesi", timeText: "10:40 - 12:30" }],
  ...extra,
});

describe("buildTermData with a v2 export", () => {
  const v2: RawExport = {
    formatVersion: 2,
    source: "ozyegin-sis-offer-ui",
    termLabel: "2026 - 2027 Güz",
    exportedAt: "2026-09-14T10:00:00.000Z",
    expected: 3,
    collected: 3,
    rows: [
      v2Row("B", [
        "Yan koşul: CS 201L Ön koşul: (CS 102 or CS 105) and (CS112 or MATH 112)",
        "HASAN SÖZER, REYHAN AYDOĞAN",
      ]),
      v2Row("A", ["", "HASAN SÖZER"]),
      v2Row("A", ["Yan koşul: MİM 102", "SELİN ÇAKIR"], { subject: "MİM", number: "105", title: "Temel Tasarım" }),
    ],
  };
  const term = buildTermData([v2], { fetchedAt: "x" });
  const cs201 = term.courses.find((c) => c.code === "CS 201")!;

  it("takes course prerequisites and corequisites from the sections that have them", () => {
    expect(cs201.prerequisites).toBe("(CS 102 or CS 105) and (CS112 or MATH 112)");
    expect(cs201.corequisites).toEqual(["CS 201L"]);
  });

  it("keeps each section's instructors", () => {
    expect(cs201.sections.map((s) => [s.id, s.instructors])).toEqual([
      ["A", ["HASAN SÖZER"]],
      ["B", ["HASAN SÖZER", "REYHAN AYDOĞAN"]],
    ]);
  });

  it("gives codes with Turkish letters an ASCII slug", () => {
    const mim = term.courses.find((c) => c.code === "MİM 105")!;
    expect(mim.slug).toBe("mim-105");
    expect(mim.corequisites).toEqual(["MİM 102"]);
    expect(mim.sections[0].instructors).toEqual(["SELİN ÇAKIR"]);
  });

  it("drops repeated identical meetings of one section (the source lists some slots once per week)", () => {
    const repeated: RawExport = {
      ...v2,
      rows: [
        v2Row("A", ["", "X"], {
          meetings: [
            { dayText: "Cumartesi", timeText: "13:30 - 16:45" },
            { dayText: "Cumartesi", timeText: "13:30 - 16:45" },
            { dayText: "Pazar", timeText: "13:30 - 16:45" },
            { dayText: "Cumartesi", timeText: "13:30 - 16:45" },
          ],
        }),
      ],
    };
    const [course] = buildTermData([repeated], { fetchedAt: "x" }).courses;
    expect(course.sections[0].meetings.map((m) => [m.day, m.start])).toEqual([
      [6, "13:30"],
      [7, "13:30"],
    ]);
  });

  it("produces data that passes validation", () => {
    expect(validateTermData(term)).toEqual([]);
  });

  it("rejects a v2 export whose rows lack infoCells, and unknown format versions", () => {
    const broken = { ...v2, rows: [{ ...raw.rows[0] }] } as RawExport;
    expect(() => buildTermData([broken], { fetchedAt: "x" })).toThrow(/infoCells/);
    const future = { ...v2, formatVersion: 3 } as unknown as RawExport;
    expect(() => buildTermData([future], { fetchedAt: "x" })).toThrow(/3/);
  });
});

describe("buildTermData with v1 rows", () => {
  const base = raw.rows[0];
  const v1: RawExport = {
    ...raw,
    rows: [
      { ...base, subject: "AI", number: "300", coreqText: "", instructorText: "Ön koşul: SEC 201" },
      {
        ...base,
        subject: "CE",
        number: "302",
        coreqText: "Yan koşul: CE 302L Ön koşul: CE 203",
        instructorText: "GÜRKAN ŞENSOY",
      },
    ],
  };
  const term = buildTermData([v1], { fetchedAt: "x" });

  it("treats an instructor cell that holds prerequisites as prerequisites, not an instructor", () => {
    const ai = term.courses.find((c) => c.code === "AI 300")!;
    expect(ai.prerequisites).toBe("SEC 201");
    expect(ai.sections[0].instructors).toEqual([]);
  });

  it("splits a combined coreqText", () => {
    const ce = term.courses.find((c) => c.code === "CE 302")!;
    expect(ce.corequisites).toEqual(["CE 302L"]);
    expect(ce.prerequisites).toBe("CE 203");
    expect(ce.sections[0].instructors).toEqual(["GÜRKAN ŞENSOY"]);
  });
});

describe("courseSlug", () => {
  it("folds Turkish letters to ASCII and turns spaces and underscores into dashes", () => {
    expect(courseSlug("CS 101L")).toBe("cs-101l");
    expect(courseSlug("MİM 105")).toBe("mim-105");
    expect(courseSlug("SAS 405_U")).toBe("sas-405-u");
    expect(courseSlug("PSY 481-03")).toBe("psy-481-03");
    expect(courseSlug("ÇĞÖŞÜ İI 1")).toBe("cgosu-ii-1");
    expect(courseSlug("çğöşü ıi 2")).toBe("cgosu-ii-2");
  });
});

describe("validateTermData duplicates", () => {
  const good = buildTermData([raw], { fetchedAt: "x" });

  it("reports duplicate course codes", () => {
    const bad = structuredClone(good);
    bad.courses.push({ ...structuredClone(bad.courses[0]), slug: "baska" });
    expect(validateTermData(bad).join("\n")).toMatch(/tekrar eden ders kodu.*CS 101/i);
  });

  it("reports duplicate slugs", () => {
    const bad = structuredClone(good);
    bad.courses[1].slug = bad.courses[0].slug;
    expect(validateTermData(bad).join("\n")).toMatch(/tekrar eden slug.*cs-101/i);
  });

  it("reports a day outside 1–7", () => {
    const bad = structuredClone(good);
    (bad.courses[0].sections[0].meetings[0] as { day: number }).day = 8;
    expect(validateTermData(bad).join("\n")).toMatch(/geçersiz gün/);
  });
});

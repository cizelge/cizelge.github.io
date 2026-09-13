import { describe, expect, it } from "vitest";
import fixture from "../../../scrapers/ozyegin/fixtures/programs-sample.json";
import { buildProgramsData, type RawProgramsExport } from "../../../scrapers/ozyegin/programs";
import type { Course, PlanPoolCourse, Program } from "../types";
import {
  curriculumFor,
  describeAddition,
  groupByFaculty,
  MAX_POOL_SIZE,
  planAddition,
  programYears,
  seasonOfTerm,
  slimProgramsForClient,
  yearLabel,
} from "./curriculum";

const { data } = buildProgramsData(fixture as RawProgramsExport);
const [bscs, arch, bsee] = data.programs;

const course = (code: string, corequisites: string[] = []): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: `${code} başlığı`,
  ects: 6,
  localCredits: null,
  prerequisites: "",
  corequisites,
  sections: [{ id: "A", instructors: [], capacity: null, restrictions: null, meetings: [] }],
});

// Bu dönem açılanlar: GEN 101 ve CS 110 yok; CS 101 ile lab arasındaki bağ yalnızca lab tarafında yazılı.
const offered: Course[] = [
  course("CS 101"),
  course("CS 101L", ["CS 101"]),
  course("MATH 103", ["MATH 103R"]),
  course("MATH 103R"),
  course("ENG 101"),
  course("EE 201"),
  course("HIST 201"),
  course("SEC 201L"),
  course("MİM 105", ["MİM 105L"]),
  course("MİM 105L"),
];

const bigPool = (): PlanPoolCourse[] =>
  Array.from({ length: MAX_POOL_SIZE + 1 }, (_, i) => ({ code: `CS ${100 + i}`, title: "x", credits: 3 }));

describe("seasonOfTerm", () => {
  it("reads the season from the term label", () => {
    expect(seasonOfTerm("2026 - 2027 Güz")).toBe("guz");
    expect(seasonOfTerm("2026 - 2027 Bahar")).toBe("bahar");
    expect(seasonOfTerm("2026 - 2027 Yaz")).toBe("yaz");
    expect(seasonOfTerm("2026 - 2027 GÜZ")).toBe("guz");
    expect(seasonOfTerm("Örnek veri, Güz")).toBe("guz");
  });

  it("returns null when the label names no season", () => {
    expect(seasonOfTerm("Örnek veri")).toBeNull();
    expect(seasonOfTerm("Yazılım dönemi")).toBeNull();
  });
});

describe("programYears / yearLabel", () => {
  it("lists only years present in the program, Hazırlık first when it exists", () => {
    expect(programYears(bscs)).toEqual([1, 2]);
    expect(programYears(arch)).toEqual([0, 1]);
    expect(programYears(bsee)).toEqual([1]);
  });

  it("ignores semesters without any items", () => {
    const p: Program = {
      ...bsee,
      semesters: [...bsee.semesters, { year: 4, season: "guz", label: "", credits: null, items: [] }],
    };
    expect(programYears(p)).toEqual([1]);
  });

  it("labels years", () => {
    expect(yearLabel(0)).toBe("Hazırlık");
    expect(yearLabel(3)).toBe("3. sınıf");
  });
});

describe("groupByFaculty", () => {
  it("groups programs under faculties, both sorted with Turkish collation", () => {
    const programs: Program[] = [
      { ...bsee, id: "Z", name: "Zeka" },
      { ...bsee, id: "C", name: "Çevre" },
      { ...bsee, id: "I", name: "İnşaat" },
      { ...bscs, faculty: "Ekonomi Fakültesi", id: "E", name: "Ekonomi" },
      { ...bsee, id: "B", name: "Bilgisayar" },
      { ...arch, id: "M", name: "Mimarlık" },
    ];
    expect(groupByFaculty(programs).map((g) => [g.faculty, g.programs.map((p) => p.name)])).toEqual([
      ["Ekonomi Fakültesi", ["Ekonomi"]],
      ["Mimarlık ve Tasarım Fakültesi", ["Mimarlık"]],
      ["Mühendislik Fakültesi", ["Bilgisayar", "Çevre", "İnşaat", "Zeka"]],
    ]);
  });
});

describe("curriculumFor", () => {
  it("lists required courses of the year and season with offered status", () => {
    const view = curriculumFor(bscs, 1, "guz", offered);
    expect(view.required).toEqual([
      { code: "CS 101", title: "Bilgisayar Programlama", offered: true },
      { code: "CS 101L", title: "Bilgisayar Programlama Laboratuvarı", offered: true },
      { code: "MATH 103", title: "Mühendislik için Yüksek Matematik I", offered: true },
      { code: "ENG 101", title: "Akademik İngilizce I", offered: true },
      { code: "GEN 101", title: "Üniversite Hayatına Giriş", offered: false },
    ]);
  });

  it("uses the offered course's own code spelling and matches Turkish letters", () => {
    const view = curriculumFor(bscs, 2, "guz", [course("SEC201L"), course("EE 201")]);
    expect(view.required.map((r) => [r.code, r.offered])).toEqual([
      ["CS 201", false],
      ["SEC201L", true],
      ["EE 201", true],
    ]);
    expect(curriculumFor(arch, 1, "guz", offered).required.map((r) => [r.code, r.offered])).toEqual([
      ["MİM 105", true],
      ["MİM 105L", true],
    ]);
  });

  it("groups repeated elective labels with counts, strips the program code prefix and filters pools", () => {
    const pool = [
      { code: "EE 201", title: "Devre Teorisi", credits: 6 },
      { code: "HIST 201", title: "Atatürk İlkeleri ve İnkılap Tarihi I", credits: 2 },
    ];
    expect(curriculumFor(bscs, 2, "guz", offered).electives).toEqual([
      { key: "BSCS Program-İçi Seçmeli", label: "Program-İçi Seçmeli", count: 2, pool },
    ]);
    expect(curriculumFor(bscs, 1, "guz", offered).electives).toEqual([
      { key: "BSCS Program-İçi Seçmeli", label: "Program-İçi Seçmeli", count: 1, pool },
      { key: "FE Serbest Seçmeli", label: "FE Serbest Seçmeli", count: 1, pool: null },
    ]);
  });

  it("gives no list for pools larger than the limit", () => {
    const p: Program = {
      ...bsee,
      semesters: [
        { year: 1, season: "guz", label: "", credits: null, items: [{ kind: "elective", label: "Büyük", credits: 3, pool: bigPool() }] },
      ],
    };
    expect(curriculumFor(p, 1, "guz", [course("CS 101")]).electives[0].pool).toBeNull();
  });

  it("returns an empty view for a year and season without items", () => {
    expect(curriculumFor(arch, 0, "guz", offered)).toEqual({ required: [], electives: [] });
    expect(curriculumFor(bscs, 4, "bahar", offered)).toEqual({ required: [], electives: [] });
  });
});

describe("planAddition / describeAddition", () => {
  it("adds offered required courses with corequisites, skipping the cart, and reports the rest", () => {
    const view = curriculumFor(bscs, 1, "guz", offered);
    const plan = planAddition(view, ["ENG 101"], offered);
    expect(plan).toEqual({
      added: ["CS 101", "CS 101L", "MATH 103", "MATH 103R"],
      notOffered: ["GEN 101"],
      offeredCount: 4,
    });
    expect(describeAddition(plan)).toBe("CS 101, CS 101L, MATH 103, MATH 103R eklendi. Bu dönem açılmayan: GEN 101.");
  });

  it("says so when everything is already in the cart or nothing is offered", () => {
    const view = curriculumFor(bscs, 1, "guz", offered);
    const all = planAddition(view, ["CS 101", "CS 101L", "MATH 103", "MATH 103R", "ENG 101"], offered);
    expect(all.added).toEqual([]);
    expect(describeAddition(all)).toBe(
      "Bu dönem açılan zorunlu derslerin zaten sepette. Bu dönem açılmayan: GEN 101.",
    );
    const none = planAddition(curriculumFor(bscs, 2, "bahar", []), [], []);
    expect(describeAddition(none)).toBe("Bu dönem açılan zorunlu ders yok. Bu dönem açılmayan: CS 202, HIST 201.");
  });
});

describe("slimProgramsForClient", () => {
  it("drops oversized pools and prerequisite text without touching the input", () => {
    const big = bigPool();
    const input = {
      ...data,
      programs: [
        {
          ...bscs,
          semesters: [
            ...bscs.semesters,
            { year: 3, season: "guz" as const, label: "", credits: null, items: [{ kind: "elective" as const, label: "Büyük", credits: 3, pool: big }] },
          ],
        },
      ],
    };
    const slim = slimProgramsForClient(input);
    expect(slim.programs[0].semesters.at(-1)!.items[0]).toEqual({ kind: "elective", label: "Büyük", credits: 3, pool: null });
    expect(input.programs[0].semesters.at(-1)!.items[0]).toMatchObject({ pool: big });
    expect(slim.programs[0].semesters[1].items[1]).toMatchObject({ code: "MATH 104", prerequisites: "" });
    expect(bscs.semesters[1].items[1]).toMatchObject({ prerequisites: "MATH103" });
    expect(slim.programs[0].semesters[0].items[5]).toMatchObject({ pool: bscs.semesters[0].items[5].kind === "elective" ? bscs.semesters[0].items[5].pool : null });
  });
});

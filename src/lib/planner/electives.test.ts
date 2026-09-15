import { describe, expect, it } from "vitest";
import type { Course, Meeting, Program } from "../types";
import { electivePools, fittingElectives, meetsOn } from "./electives";

const m = (day: Meeting["day"], start: string, end: string): Meeting => ({ day, start, end, room: null });

const course = (code: string, sections: Record<string, Meeting[]>, corequisites: string[] = []): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: `${code} başlığı`,
  ects: 5,
  localCredits: null,
  prerequisites: "",
  corequisites,
  sections: Object.entries(sections).map(([id, meetings]) => ({ id, instructors: [], capacity: null, restrictions: null, meetings })),
});

const program: Program = {
  id: "BSCS",
  slug: "bscs",
  name: "Bilgisayar Mühendisliği",
  faculty: "Mühendislik",
  semesters: [
    {
      year: 3,
      season: "guz",
      label: "3. Yıl - Güz",
      credits: 30,
      items: [
        { kind: "course", code: "CS 301", title: "", credits: 6, prerequisites: "", corequisites: [] },
        { kind: "elective", label: "BSCS Program-İçi Seçmeli", credits: 5, pool: [{ code: "CS 350", title: "", credits: 5 }] },
        { kind: "elective", label: "BSCS Serbest Seçmeli", credits: 5, pool: null },
      ],
    },
    {
      year: 4,
      season: "bahar",
      label: "4. Yıl - Bahar",
      credits: 30,
      items: [
        {
          kind: "elective",
          label: "BSCS Program-İçi Seçmeli",
          credits: 5,
          pool: [
            { code: "CS 350", title: "", credits: 5 },
            { code: "CS 360", title: "", credits: 5 },
            { code: "CS 370", title: "", credits: 5 },
            { code: "CS 380", title: "", credits: 5 },
            { code: "CS 390", title: "", credits: 5 },
          ],
        },
      ],
    },
  ],
};

// Seçili program: Salı 09:40-12:30 dolu.
const busy = [m(2, "09:40", "12:30")];

const courses: Course[] = [
  course("CS 350", { A: [m(2, "10:40", "12:30")], B: [m(2, "13:40", "15:30")] }),
  course("CS 360", { A: [m(2, "11:40", "13:30")] }),
  course("CS 370", { A: [m(3, "13:40", "15:30")] }, ["CS 370L"]),
  course("CS 370L", { A: [m(2, "10:40", "12:30")], B: [m(3, "13:40", "15:30")] }),
  course("CS 380", { A: [] }),
  // CS 390 bu dönem açılmıyor.
];

describe("electivePools", () => {
  it("aynı etiketin havuzlarını birleştirir ve program kodunu atar", () => {
    const pools = electivePools(program);
    expect(pools.map((p) => p.label)).toEqual(["Program-İçi Seçmeli", "Serbest Seçmeli"]);
    expect(pools[0].pool!.map((p) => p.code)).toEqual(["CS 350", "CS 360", "CS 370", "CS 380", "CS 390"]);
    expect(pools[1].pool).toBeNull();
  });
});

describe("fittingElectives", () => {
  it("yalnızca boş saate sığan şubeleri listeler", () => {
    const { groups, openLabels } = fittingElectives(program, courses, busy, []);
    expect(openLabels).toEqual(["Serbest Seçmeli"]);
    const [g] = groups;
    expect(g.offered).toBe(4);
    const cs350 = g.fits.find((f) => f.code === "CS 350")!;
    expect(cs350.sections.map((s) => s.id)).toEqual(["B"]);
    expect(g.fits.some((f) => f.code === "CS 360")).toBe(false);
    // Saatsiz şube sığıyor sayılmaz.
    expect(g.fits.some((f) => f.code === "CS 380")).toBe(false);
  });

  it("yan koşullu dersin de ana şubeyle çakışmadan sığması gerekir", () => {
    const { groups } = fittingElectives(program, courses, busy, []);
    // Lab A dolu saatle, lab B ana dersle aynı saatte: sığmaz.
    expect(groups[0].fits.some((f) => f.code === "CS 370")).toBe(false);
    const freed = courses.map((c) =>
      c.code === "CS 370L" ? { ...c, sections: [...c.sections, { id: "C", instructors: [], capacity: null, restrictions: null, meetings: [m(4, "08:40", "10:30")] }] } : c,
    );
    const cs370 = fittingElectives(program, freed, busy, []).groups[0].fits.find((f) => f.code === "CS 370")!;
    expect(cs370.corequisites).toEqual(["CS 370L"]);
  });

  it("sepetteki dersleri ve boş bırakılacak günleri dışarıda tutar", () => {
    expect(fittingElectives(program, courses, busy, ["CS 350"]).groups[0].fits.some((f) => f.code === "CS 350")).toBe(false);
    expect(fittingElectives(program, courses, busy, [], [2]).groups[0].fits).toEqual([]);
  });

  it("meetsOn güne göre süzer", () => {
    const cs350 = fittingElectives(program, courses, busy, []).groups[0].fits[0];
    expect(meetsOn(cs350, 2)).toBe(true);
    expect(meetsOn(cs350, 3)).toBe(false);
  });
});

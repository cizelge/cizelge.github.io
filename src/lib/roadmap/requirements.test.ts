import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import type { Program, ProgramsData } from "../types";
import { programRequirements } from "./requirements";

const program: Program = {
  id: "BSX",
  slug: "bsx",
  name: "Deneme",
  faculty: "F",
  semesters: [
    {
      year: 1,
      season: "guz",
      label: "1. Yıl - Güz (10 Kredi)",
      credits: 10,
      items: [
        { kind: "course", code: "CS 101", title: "Prog", credits: 6, prerequisites: "", corequisites: ["CS 101L"] },
        { kind: "elective", label: "BSX Seçmeli", credits: 4, pool: [{ code: "A 1", title: "A", credits: 4 }] },
      ],
    },
    {
      year: 1,
      season: "other",
      label: "Diğer",
      credits: 5,
      items: [{ kind: "course", code: "CS 102", title: "OOP", credits: 6, prerequisites: "CS 101", corequisites: [] }],
    },
  ],
};

describe("programRequirements", () => {
  it("dönem satırlarını kalıcı kimlikli gereksinimlere çevirir", () => {
    const rp = programRequirements(program, "cap");
    expect(rp).toMatchObject({ id: "BSX", kind: "cap", name: "Deneme", totalCredits: 15 });
    expect(rp.requirements.map((r) => r.id)).toEqual(["BSX:y1-guz:0", "BSX:y1-guz:1", "BSX:y1-other:0"]);
    expect(rp.requirements[0]).toMatchObject({
      kind: "course",
      code: "CS 101",
      corequisites: ["CS 101L"],
      pool: null,
      slot: { year: 1, season: "guz" },
    });
    expect(rp.requirements[1]).toMatchObject({ kind: "elective", code: null, title: "BSX Seçmeli", prerequisites: "" });
    expect(rp.requirements[2].slot).toEqual({ year: 1, season: "other" });
  });

  it("başlık kredisi eksikse satırların toplamı alınır", () => {
    const p = { ...program, semesters: program.semesters.map((s, i) => (i === 1 ? { ...s, credits: null } : s)) };
    expect(programRequirements(p, "anadal").totalCredits).toBe(16);
  });

  it("gerçek BSCS: 240 AKTS", () => {
    const bscs = (programsData as ProgramsData).programs.find((p) => p.id === "BSCS")!;
    const rp = programRequirements(bscs, "anadal");
    expect(rp.totalCredits).toBe(240);
    expect(rp.requirements.length).toBe(46);
  });
});

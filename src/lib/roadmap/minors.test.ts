import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { TermData } from "../types";
import { averagePoolCredits, minorRequirements } from "./minors";
import type { Minor, MinorsData } from "./types";

const CODE_RE = /^\p{Lu}+ \d{3}[\p{Lu}\d]*$/u;
const data = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data", "ozyegin", "minors.json"), "utf8"),
) as MinorsData;

describe("data/ozyegin/minors.json", () => {
  it("üst alanlar", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(Number.isNaN(Date.parse(data.fetchedAt))).toBe(false);
    expect(data.minors.length).toBeGreaterThan(0);
  });

  it("kimlikler tekil", () => {
    const ids = data.minors.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(data.minors.map((m) => [m.id, m] as const))("%s biçimi", (_id, m) => {
    expect(m.id).toMatch(/^yandal-[a-z0-9-]+$/);
    expect(m.name).not.toBe("");
    expect(m.department).not.toBe("");
    expect(m.sourceUrl).toMatch(/^https:\/\//);
    expect(m.sourceUrl).not.toContain("sis.ozyegin.edu.tr");
    expect(["listed", "unlisted"]).toContain(m.status);
    expect(Array.isArray(m.notes)).toBe(true);
    const courses = [...m.required, ...m.electiveGroups.flatMap((g) => g.pool)];
    if (m.status === "listed") expect(courses.length).toBeGreaterThanOrEqual(1);
    else {
      expect(m.required).toEqual([]);
      expect(m.electiveGroups).toEqual([]);
      expect(m.notes.length).toBeGreaterThan(0);
    }
    for (const c of courses) {
      expect(c.code).toMatch(CODE_RE);
      expect(c.title).not.toBe("");
      expect(c.credits === null || (typeof c.credits === "number" && c.credits > 0)).toBe(true);
    }
    // Zorunlu dersler kendi içinde tekrar etmez; gruplar geçerli sayıda ders ister.
    const req = m.required.map((c) => c.code);
    expect(new Set(req).size).toBe(req.length);
    for (const g of m.electiveGroups) {
      expect(Number.isInteger(g.min) && g.min >= 0).toBe(true);
      expect(g.min).toBeLessThanOrEqual(g.pool.length);
    }
  });

  it("her yandal gereksinime çevrilebilir", () => {
    for (const m of data.minors) {
      const p = minorRequirements(m);
      const ids = p.requirements.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      if (m.status === "unlisted") expect(p.requirements).toEqual([]);
    }
  });
});

const fixture: Minor = {
  id: "yandal-test",
  name: "Test Yandal",
  department: "Test",
  sourceUrl: "https://example.edu/yandal",
  status: "listed",
  required: [
    { code: "EE 201", title: "Sinyaller", credits: 6 },
    { code: "EE 202", title: "Devre", credits: null },
  ],
  electiveGroups: [
    { min: 2, pool: [{ code: "EE 301", title: "A", credits: 6 }, { code: "EE 302", title: "B", credits: 5 }, { code: "EE 303", title: "C", credits: null }] },
    { min: 1, pool: [{ code: "EE 401", title: "D", credits: null }] },
    { min: 0, pool: [{ code: "EE 402", title: "E", credits: 5 }] },
  ],
  notes: [],
};

const term = (termId: string, prereq: string): TermData => ({
  schoolId: "test",
  termId,
  termLabel: termId,
  fetchedAt: "2026-01-01T00:00:00Z",
  courses: [
    { code: "EE 201", slug: "ee-201", title: "Sinyaller", ects: 6, localCredits: null, prerequisites: prereq, corequisites: ["EE 201L"], sections: [] },
  ] as unknown as TermData["courses"],
});

describe("averagePoolCredits", () => {
  it("bilinenlerin yuvarlanmış ortalaması", () => {
    expect(averagePoolCredits(fixture.electiveGroups[0].pool)).toBe(6);
    expect(averagePoolCredits(fixture.electiveGroups[1].pool)).toBeNull();
    expect(averagePoolCredits([])).toBeNull();
  });
});

describe("minorRequirements", () => {
  it("zorunlu ve seçmeli gereksinimleri üretir", () => {
    const p = minorRequirements(fixture);
    expect(p).toMatchObject({ id: "yandal-test", kind: "yandal", name: "Test Yandal" });
    expect(p.requirements.map((r) => r.id)).toEqual([
      "yandal-test:req:0",
      "yandal-test:req:1",
      "yandal-test:sec:0:0",
      "yandal-test:sec:0:1",
      "yandal-test:sec:1:0",
    ]);
    const [r0, r1, s0, , s2] = p.requirements;
    expect(r0).toEqual({
      id: "yandal-test:req:0", programId: "yandal-test", kind: "course", code: "EE 201", title: "Sinyaller",
      credits: 6, prerequisites: "", corequisites: [], pool: null, slot: null,
    });
    expect(r1.credits).toBeNull();
    expect(s0).toMatchObject({ kind: "elective", code: null, credits: 6, prerequisites: "", corequisites: [], slot: null, programId: "yandal-test" });
    expect(s0.pool?.map((c) => c.code)).toEqual(["EE 301", "EE 302", "EE 303"]);
    expect(s2.credits).toBeNull();
    // 6 + 0 + 6 + 6 + 0
    expect(p.totalCredits).toBe(18);
  });

  it("havuz kopyalanır, kaynak değişmez", () => {
    const p = minorRequirements(fixture);
    p.requirements[2].pool!.push({ code: "X 100", title: "x", credits: 1 });
    expect(fixture.electiveGroups[0].pool).toHaveLength(3);
  });

  it("ön koşulu dönem verisinden, en yeni dönemden alır", () => {
    const p = minorRequirements(fixture, [term("eski", "MATH 101"), term("yeni", "MATH 102")]);
    expect(p.requirements[0].prerequisites).toBe("MATH 102");
    expect(p.requirements[0].corequisites).toEqual(["EE 201L"]);
    expect(p.requirements[1].prerequisites).toBe("");
  });

  it("unlisted yandal boş döner", () => {
    const p = minorRequirements({ ...fixture, status: "unlisted" });
    expect(p.requirements).toEqual([]);
    expect(p.totalCredits).toBe(0);
  });
});

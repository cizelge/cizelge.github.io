import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import termGuz from "../../../data/ozyegin/2026-2027-guz.json";
import { programRequirements } from "../roadmap/requirements";
import type { PlanItem, PlanSeason, Program, ProgramsData, TermData } from "../types";
import { buildRowsModel, layoutRows } from "./rows-layout";

const c = (code: string, prerequisites = "", credits: number | null = 6): PlanItem => ({
  kind: "course", code, title: `${code} adı`, credits, prerequisites, corequisites: [],
});
const el = (label: string, pool: string[] | null): PlanItem => ({
  kind: "elective", label, credits: 6, pool: pool ? pool.map((code) => ({ code, title: `${code} havuz`, credits: 5 })) : null,
});

const program = (id: string, sems: { year: number; season: PlanSeason; items: PlanItem[] }[]): Program => ({
  id, slug: id.toLowerCase(), name: id, faculty: "F",
  semesters: sems.map((s) => ({ ...s, label: "x", credits: null })),
});

const term = (...courses: { code: string; title?: string; ects?: number | null; prerequisites?: string }[]): TermData => ({
  schoolId: "x", termId: "t", termLabel: "t", fetchedAt: "",
  courses: courses.map((k) => ({
    code: k.code, slug: "", title: k.title ?? "", ects: k.ects ?? null, localCredits: null,
    prerequisites: k.prerequisites ?? "", corequisites: [], sections: [],
  })),
});

const edgeList = (m: ReturnType<typeof buildRowsModel>) =>
  m.edges.map((e) => `${e.from}>${e.to}:${e.kind}:${e.group}`).sort();

describe("buildRowsModel", () => {
  const p = program("P", [
    { year: 0, season: "guz", items: [c("ENG 100")] },
    { year: 1, season: "guz", items: [c("AA 101"), c("BB 101")] },
    { year: 1, season: "bahar", items: [c("AA 102", "AA 101"), c("AA 101")] }, // tekrar eden kod
    { year: 1, season: "yaz", items: [c("CC 200", "(AA101 or BB 101) and AA 102")] },
    { year: 2, season: "other", items: [el("Seçmeli", ["XX 300", "YY 300"]), el("Serbest", null)] },
  ]);

  it("satırlar müfredat sırasıyla, etiketler, tekrar eden kod ilk yerde", () => {
    const m = buildRowsModel(p, [], {});
    expect(m.rows.map((r) => r.label)).toEqual(["Hazırlık", "1. yıl Güz", "1. yıl Bahar", "1. yıl Yaz", "2. yıl Diğer"]);
    expect(m.rows.map((r) => r.key)).toEqual(["y0-guz", "y1-guz", "y1-bahar", "y1-yaz", "y2-other"]);
    expect(m.nodes.filter((n) => n.id === "AA 101").map((n) => n.row)).toEqual(["y1-guz"]);
    expect(m.nodes.find((n) => n.id === "P:y2-other:0")).toMatchObject({ kind: "elective", code: null, title: "Seçmeli" });
  });

  it("kind/group graph.ts gibi", () => {
    const m = buildRowsModel(p, [], {});
    expect(edgeList(m)).toEqual([
      "AA 101>AA 102:and:null",
      "AA 101>CC 200:or:0",
      "AA 102>CC 200:and:null",
      "BB 101>CC 200:or:0",
    ]);
  });

  it("boş satır yok", () => {
    const q = program("Q", [
      { year: 1, season: "guz", items: [c("AA 101")] },
      { year: 1, season: "bahar", items: [c("AA 101")] },
      { year: 2, season: "guz", items: [] },
    ]);
    expect(buildRowsModel(q, [], {}).rows.map((r) => r.key)).toEqual(["y1-guz"]);
  });

  it("başlık/AKTS/ön koşul: program önce, dönem verisi yedek", () => {
    const q = program("Q", [{ year: 1, season: "guz", items: [
      { kind: "course", code: "AA 101", title: "", credits: null, prerequisites: "", corequisites: [] },
      c("BB 101", "AA 101"),
    ] }]);
    const m = buildRowsModel(q, [term({ code: "AA 101", title: "Dönem adı", ects: 7, prerequisites: "ZZ 100" },
      { code: "BB 101", title: "Başka", prerequisites: "ZZ 999" })], {});
    expect(m.nodes[0]).toMatchObject({ title: "Dönem adı", credits: 7, prerequisiteText: "ZZ 100" });
    expect(m.nodes[1]).toMatchObject({ title: "BB 101 adı", prerequisiteText: "AA 101" });
  });

  it("seçmeli seçimi kenar oluşturur; havuz dışı seçim yok sayılır", () => {
    const t = [term({ code: "XX 300", title: "X dönem", prerequisites: "AA 102 or BB 101" }, { code: "ZZ 100", prerequisites: "CC 200" })];
    const m = buildRowsModel(p, t, { "P:y2-other:0": "XX300", "P:y2-other:1": "ZZ 100" });
    const e = m.nodes.find((n) => n.id === "P:y2-other:0")!;
    expect(e).toMatchObject({ code: "XX 300", title: "XX 300 havuz", credits: 5, prerequisiteText: "AA 102 or BB 101" });
    expect(edgeList(m)).toContain("AA 102>P:y2-other:0:or:0");
    expect(edgeList(m)).toContain("BB 101>P:y2-other:0:or:0");
    // Serbest seçmeli (havuz null) her kodu kabul eder.
    expect(edgeList(m)).toContain("CC 200>P:y2-other:1:and:null");

    const bad = buildRowsModel(p, t, { "P:y2-other:0": "QQ 999" });
    expect(bad.nodes.find((n) => n.id === "P:y2-other:0")!.code).toBeNull();
    expect(bad.edges.some((x) => x.to === "P:y2-other:0")).toBe(false);
  });

  it("seçilen seçmeli başka düğümün ön koşulu olabilir", () => {
    const q = program("Q", [
      { year: 1, season: "guz", items: [el("S", ["XX 300"])] },
      { year: 1, season: "bahar", items: [c("DD 400", "XX 300")] },
    ]);
    const m = buildRowsModel(q, [], { "Q:y1-guz:0": "XX 300" });
    expect(edgeList(m)).toEqual(["Q:y1-guz:0>DD 400:and:null"]);
    expect(buildRowsModel(q, [], {}).edges).toEqual([]);
  });

  it("deterministik", () => {
    expect(JSON.stringify(buildRowsModel(p, [], {}))).toBe(JSON.stringify(buildRowsModel(p, [], {})));
  });
});

describe("layoutRows", () => {
  const p = program("P", [
    { year: 1, season: "guz", items: [c("AA 101"), c("BB 101"), c("CC 101")] },
    { year: 1, season: "bahar", items: [c("AA 102", "CC 101"), c("BB 102", "AA 101")] },
    { year: 2, season: "guz", items: [c("ZZ 201", "AA 102 and BB 102"), c("YY 201", "ZZ 201")] },
  ]);
  const m = buildRowsModel(p, [], {});

  it("varsayılanlar, ortalama, çakışma yok, satırlar üst üste binmez", () => {
    const L = layoutRows(m);
    const nodeW = 112, gapX = 14, labelW = 96;
    expect(L.width).toBe(labelW + 3 * nodeW + 2 * gapX);
    expect(L.rows.map((r) => r.key)).toEqual(["y1-guz", "y1-bahar", "y2-guz"]);
    for (let i = 1; i < L.rows.length; i++) {
      expect(L.rows[i].y).toBeGreaterThanOrEqual(L.rows[i - 1].y + L.rows[i - 1].h);
    }
    const last = L.rows[L.rows.length - 1];
    expect(L.height).toBe(last.y + last.h);
    for (const r of L.rows) {
      const inRow = L.nodes.filter((n) => m.nodes.find((k) => k.id === n.id)!.row === r.key).sort((a, b) => a.x - b.x);
      for (let i = 1; i < inRow.length; i++) expect(inRow[i].x).toBeGreaterThanOrEqual(inRow[i - 1].x + inRow[i - 1].w);
      const left = inRow[0].x - labelW;
      const right = L.width - (inRow[inRow.length - 1].x + inRow[inRow.length - 1].w);
      expect(Math.abs(left - right)).toBeLessThan(0.2);
      for (const n of inRow) {
        expect(n.y).toBeGreaterThanOrEqual(r.y);
        expect(n.y + n.h).toBeLessThanOrEqual(r.y + r.h);
      }
    }
    expect(L.edges).toHaveLength(m.edges.length);
    for (const e of L.edges) expect(e.path.startsWith("M")).toBe(true);
  });

  it("barycenter: çapraz kenarlar düzelir", () => {
    const L = layoutRows(m);
    const x = (id: string) => L.nodes.find((n) => n.id === id)!.x;
    // AA 102 <- CC 101 (sağ), BB 102 <- AA 101 (sol): ikinci satırda BB 102 solda olmalı.
    expect(x("BB 102")).toBeLessThan(x("AA 102"));
  });

  it("opts.width geniş ise kullanılır; aynı satır kenarı yandan", () => {
    const q = program("Q", [{ year: 1, season: "guz", items: [c("AA 101"), c("BB 101", "AA 101")] }]);
    const L = layoutRows(buildRowsModel(q, [], {}), { width: 1000 });
    expect(L.width).toBe(1000);
    expect(L.edges[0].path).toMatch(/^M[\d.]+,[\d.]+ C/);
    expect(JSON.stringify(layoutRows(m))).toBe(JSON.stringify(layoutRows(m)));
  });

  it("boş model", () => {
    expect(layoutRows({ rows: [], nodes: [], edges: [] })).toEqual({ width: 96, height: 0, rows: [], nodes: [], edges: [] });
  });
});

describe("gerçek veri: BSCS", () => {
  const data = programsData as ProgramsData;
  const bscs = data.programs.find((x) => x.id === "BSCS")!;
  const terms = [termGuz as TermData];

  it("seçmeli id'leri programRequirements ile aynı", () => {
    const m = buildRowsModel(bscs, terms, {});
    const reqIds = programRequirements(bscs, "anadal").requirements.filter((r) => r.kind === "elective").map((r) => r.id);
    expect(m.nodes.filter((n) => n.kind === "elective").map((n) => n.id)).toEqual(reqIds);
  });

  it("CS 201: CS 102 ve CS 112 farklı or gruplarında", () => {
    const m = buildRowsModel(bscs, terms, {});
    expect(m.nodes.find((n) => n.id === "CS 201")!.prerequisiteText).toBe("(CS 102 or CS 105) and (CS112 or MATH 112)");
    const into = m.edges.filter((e) => e.to === "CS 201");
    const a = into.find((e) => e.from === "CS 102")!;
    const b = into.find((e) => e.from === "CS 112")!;
    expect(a.kind).toBe("or");
    expect(b.kind).toBe("or");
    expect(a.group).not.toBeNull();
    expect(b.group).not.toBeNull();
    expect(a.group).not.toBe(b.group);
  });

  it("seçmeli seçimi gerçek havuzdan kenar üretir ve yerleşim tutarlı", () => {
    const elective = bscs.semesters.find((s) => s.year === 4 && s.season === "guz")!;
    const index = elective.items.findIndex((i) => i.kind === "elective" && i.pool?.some((p) => p.code === "CS 413"));
    const id = `BSCS:y4-guz:${index}`;
    const m = buildRowsModel(bscs, terms, { [id]: "CS 413" });
    expect(m.edges).toContainEqual({ from: "CS 201", to: id, kind: "and", group: null });
    const L = layoutRows(m);
    expect(L.nodes).toHaveLength(m.nodes.length);
    expect(L.rows).toHaveLength(m.rows.length);
  });
});

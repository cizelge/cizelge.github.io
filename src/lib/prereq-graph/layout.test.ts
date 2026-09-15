import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import termGuz from "../../../data/ozyegin/2026-2027-guz.json";
import type { ProgramsData, TermData } from "../types";
import { buildProgramGraph } from "./graph";
import { layoutProgramGraph } from "./layout";
import type { EdgeKind, GraphNode, PrereqGraph } from "./types";

const node = (code: string, slot: GraphNode["slot"]): GraphNode => ({
  code, title: code, credits: 6, slot, unreadable: false, prerequisiteText: "", minEcts: null,
});

function graph(nodes: GraphNode[], edges: [string, string, EdgeKind?][]): PrereqGraph {
  return {
    nodes: new Map(nodes.map((n) => [n.code, n])),
    edges: edges.map(([from, to, kind]) => ({ from, to, kind: kind ?? "and", group: kind === "or" ? 0 : null })),
  };
}

const fixture = () =>
  graph(
    [
      node("Z 9", null),
      node("B 2", { year: 2, season: "guz" }),
      node("A 1", { year: 1, season: "guz" }),
      node("C 1", { year: 1, season: "guz" }),
      node("D 1", { year: 1, season: "bahar" }),
      node("E 1", { year: 1, season: "bahar" }),
      node("H 0", { year: 0, season: "guz" }),
      node("Y 1", { year: 1, season: "yaz" }),
    ],
    [["C 1", "E 1"], ["A 1", "D 1", "or"], ["A 1", "C 1"], ["B 2", "A 1"], ["H 0", "Z 9"]],
  );

describe("layoutProgramGraph", () => {
  it("sütunlar slot sırasıyla, Diğer en sonda", () => {
    const l = layoutProgramGraph(fixture());
    expect(l.columns.map((c) => c.label)).toEqual(["Hazırlık Güz", "1. yıl Güz", "1. yıl Bahar", "1. yıl Yaz", "2. yıl Güz", "Diğer"]);
    expect(l.columns.map((c) => c.x)).toEqual([0, 188, 376, 564, 752, 940]);
    const xs = l.columns.map((c) => c.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("deterministik", () => {
    expect(JSON.stringify(layoutProgramGraph(fixture()))).toBe(JSON.stringify(layoutProgramGraph(fixture())));
  });

  it("sütun içinde çakışma yok, başlık boşluğu bırakılır", () => {
    const l = layoutProgramGraph(fixture(), { rowGap: 10 });
    const byX = new Map<number, typeof l.nodes>();
    for (const n of l.nodes) byX.set(n.x, [...(byX.get(n.x) ?? []), n]);
    for (const col of byX.values()) {
      const ys = col.map((n) => n.y).sort((a, b) => a - b);
      expect(ys[0]).toBe(32);
      for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(44 + 10);
    }
    expect(l.nodes).toHaveLength(8);
  });

  it("barycenter: D 1 ve E 1 ön koşullarının sırasını izler", () => {
    const l = layoutProgramGraph(fixture());
    const y = (code: string) => l.nodes.find((n) => n.code === code)!.y;
    expect(Math.sign(y("D 1") - y("E 1"))).toBe(Math.sign(y("A 1") - y("C 1")));
  });

  it("kenar yolları M ile başlar; aynı sütun ve geriye kenar kavisli", () => {
    const l = layoutProgramGraph(fixture());
    expect(l.edges).toHaveLength(5);
    for (const e of l.edges) expect(e.path).toMatch(/^M-?\d/);
    const same = l.edges.find((e) => e.from === "A 1" && e.to === "C 1")!;
    expect(same.path).toMatch(/^M320,\d+(\.\d)? C/);
    const back = l.edges.find((e) => e.from === "B 2")!;
    expect(back.path.match(/C/g)).toHaveLength(2);
    expect(l.edges.find((e) => e.from === "A 1" && e.to === "D 1")!.kind).toBe("or");
  });

  it("boş graf", () => {
    expect(layoutProgramGraph({ nodes: new Map(), edges: [] })).toEqual({ width: 0, height: 0, columns: [], nodes: [], edges: [] });
  });

  it("gerçek veri: BSCS", () => {
    const bscs = (programsData as ProgramsData).programs.find((p) => p.id === "BSCS")!;
    const g = buildProgramGraph(bscs, [termGuz as TermData]);
    const l = layoutProgramGraph(g);
    expect(l.width).toBeGreaterThan(0);
    expect(l.height).toBeGreaterThan(0);
    expect(l.nodes).toHaveLength(g.nodes.size);
    expect(l.edges).toHaveLength(g.edges.length);
    for (const n of l.nodes) {
      expect(n.x + n.w).toBeLessThanOrEqual(l.width);
      expect(n.y + n.h).toBeLessThanOrEqual(l.height);
    }
  });
});

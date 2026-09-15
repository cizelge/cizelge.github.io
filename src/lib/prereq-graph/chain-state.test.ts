import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import termGuz from "../../../data/ozyegin/2026-2027-guz.json";
import type { ProgramsData, TermData } from "../types";
import { chainOf, closePrereqs, dependents, takeable, toggleRow, toggleTaken } from "./chain-state";
import type { RowEdge, RowNode, RowsModel } from "./rows";
import { buildRowsModel } from "./rows-layout";

const node = (id: string, row: string): RowNode => ({
  id, kind: "course", row, code: id, title: id, credits: 6, pool: null, prerequisiteText: "", unreadable: false, minEcts: null,
});
const and = (from: string, to: string): RowEdge => ({ from, to, kind: "and", group: null });
const or = (from: string, to: string, group: number): RowEdge => ({ from, to, kind: "or", group });

// r1: A, B, C   r2: D (A and B), E (A or C), S   r3: F (D and (E or S))
// Aynı satır: S -> G (r2)
const model: RowsModel = {
  rows: [
    { key: "r1", label: "1", year: 1, season: "guz" },
    { key: "r2", label: "2", year: 1, season: "bahar" },
    { key: "r3", label: "3", year: 2, season: "guz" },
  ],
  nodes: [node("A", "r1"), node("B", "r1"), node("C", "r1"), node("D", "r2"), node("E", "r2"), node("S", "r2"), node("G", "r2"), node("F", "r3")],
  edges: [
    and("A", "D"), and("B", "D"),
    or("A", "E", 0), or("C", "E", 0),
    and("D", "F"), or("E", "F", 0), or("S", "F", 0),
    and("S", "G"),
  ],
};
const sorted = (s: Set<string>) => [...s].sort();

describe("closePrereqs / dependents", () => {
  it("dolaylı ön koşullar; or grubundan ilk düğüm", () => {
    expect(sorted(closePrereqs(model, "F"))).toEqual(["A", "B", "D", "E"]);
    expect(sorted(closePrereqs(model, "E"))).toEqual(["A"]);
  });
  it("or grubunda alınmış varsa ek yok", () => {
    expect(sorted(closePrereqs(model, "E", new Set(["C"])))).toEqual([]);
    expect(sorted(closePrereqs(model, "F", new Set(["S"])))).toEqual(["A", "B", "D"]);
  });
  it("dependents", () => {
    expect(sorted(dependents(model, "A"))).toEqual(["D", "E", "F"]);
    expect(sorted(dependents(model, "F"))).toEqual([]);
  });
});

describe("toggleTaken", () => {
  it("eklerken ön koşulları ekler, girdiyi değiştirmez", () => {
    const taken = new Set<string>();
    const next = toggleTaken(model, taken, "F");
    expect(taken.size).toBe(0);
    expect(sorted(next)).toEqual(["A", "B", "D", "E", "F"]);
  });

  it("aynı satırdaki ön koşul eklenmez", () => {
    expect(sorted(toggleTaken(model, new Set(), "G"))).toEqual(["G"]);
  });

  it("or grubunda alınmış seçenek varsa ilki eklenmez", () => {
    expect(sorted(toggleTaken(model, new Set(["C"]), "E"))).toEqual(["C", "E"]);
  });

  it("çıkarırken bağımlıları da çıkarır", () => {
    const taken = new Set(["A", "B", "D", "E", "F"]);
    const next = toggleTaken(model, taken, "A");
    expect(taken.size).toBe(5);
    expect(sorted(next)).toEqual(["B"]);
  });

  it("başka or seçeneğiyle karşılanan bağımlı kalır", () => {
    const next = toggleTaken(model, new Set(["A", "C", "E"]), "A");
    expect(sorted(next)).toEqual(["C", "E"]);
    const n2 = toggleTaken(model, new Set(["A", "B", "D", "E", "S", "F"]), "E");
    expect(sorted(n2)).toEqual(["A", "B", "D", "F", "S"]);
  });

  it("bağımlı olmayan karşılanmamış düğüm çıkarmada dokunulmaz", () => {
    expect(sorted(toggleTaken(model, new Set(["G", "A"]), "A"))).toEqual(["G"]);
  });
});

describe("toggleRow", () => {
  it("ekler (ön koşullarıyla), hepsi alınmışsa çıkarır", () => {
    const added = toggleRow(model, new Set(), "r3");
    expect(sorted(added)).toEqual(["A", "B", "D", "E", "F"]);
    const r2 = toggleRow(model, new Set(), "r2");
    expect(sorted(r2)).toEqual(["A", "B", "D", "E", "G", "S"]);
    const removed = toggleRow(model, new Set([...r2, "F"]), "r2");
    expect(sorted(removed)).toEqual(["A", "B"]);
    expect(sorted(toggleRow(model, new Set(["A"]), "yok"))).toEqual(["A"]);
  });
});

describe("takeable / chainOf", () => {
  it("takeable", () => {
    expect(sorted(takeable(model, new Set()))).toEqual(["A", "B", "C", "S"]);
    expect(sorted(takeable(model, new Set(["C", "S"])))).toEqual(["A", "B", "E", "G"]);
    expect(sorted(takeable(model, new Set(["A", "B", "S"])))).toEqual(["C", "D", "E", "G"]);
    expect(sorted(takeable(model, new Set(["A", "B", "D", "S"])))).toEqual(["C", "E", "F", "G"]);
  });

  it("chainOf", () => {
    const ch = chainOf(model, "D");
    expect(sorted(ch.ancestors)).toEqual(["A", "B"]);
    expect(sorted(ch.descendants)).toEqual(["F"]);
    expect(sorted(ch.edges)).toEqual(["A>D", "B>D", "D>F"]);
  });

  it("döngüler takılmaz", () => {
    const cyc: RowsModel = {
      rows: [{ key: "r1", label: "1", year: 1, season: "guz" }, { key: "r2", label: "2", year: 1, season: "bahar" }],
      nodes: [node("X", "r1"), node("Y", "r2"), node("Z", "r2")],
      edges: [and("X", "Y"), and("Y", "X"), or("Y", "Z", 0), or("Z", "Y", 0)],
    };
    expect(sorted(closePrereqs(cyc, "Y"))).toEqual(["X", "Z"]);
    expect(sorted(dependents(cyc, "X"))).toEqual(["Y", "Z"]);
    expect(sorted(toggleTaken(cyc, new Set(), "Y"))).toEqual(["X", "Y"]);
    expect(sorted(toggleTaken(cyc, new Set(["X", "Y", "Z"]), "X"))).toEqual([]);
    const ch = chainOf(cyc, "X");
    expect(ch.ancestors.has("X")).toBe(false);
    expect(sorted(takeable(cyc, new Set()))).toEqual([]);
  });
});

describe("gerçek veri: BSCS", () => {
  const bscs = (programsData as ProgramsData).programs.find((x) => x.id === "BSCS")!;
  const m = buildRowsModel(bscs, [termGuz as TermData], {});

  it("CS 201 eklenince iki or grubundan birer ders eklenir", () => {
    const next = toggleTaken(m, new Set(), "CS 201");
    for (const id of ["CS 101", "CS 102", "CS 112", "CS 201"]) expect(next.has(id)).toBe(true);
    expect(takeable(m, next).has("CS 202")).toBe(true);
    const after = toggleTaken(m, next, "CS 112");
    expect(after.has("CS 201")).toBe(false);
    expect(after.has("CS 102")).toBe(true);
  });
});

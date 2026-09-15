import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import termGuz from "../../../data/ozyegin/2026-2027-guz.json";
import type { PlanItem, Program, ProgramsData, TermData } from "../types";
import { ancestors, buildCourseChain, buildProgramGraph, descendants } from "./graph";

const c = (code: string, prerequisites = "", credits: number | null = 6): PlanItem => ({
  kind: "course", code, title: `${code} adı`, credits, prerequisites, corequisites: [],
});

const program = (id: string, ...semesters: PlanItem[][]): Program => ({
  id, slug: id.toLowerCase(), name: id, faculty: "F",
  semesters: semesters.map((items, i) => ({
    year: Math.floor(i / 2) + 1, season: i % 2 === 0 ? "guz" : "bahar", label: `s${i}`, credits: null, items,
  })),
});

const term = (...courses: { code: string; title?: string; ects?: number | null; prerequisites?: string }[]): TermData => ({
  schoolId: "x", termId: "t", termLabel: "t", fetchedAt: "",
  courses: courses.map((k) => ({
    code: k.code, slug: "", title: k.title ?? "", ects: k.ects ?? null, localCredits: null,
    prerequisites: k.prerequisites ?? "", corequisites: [], sections: [],
  })),
});

const kinds = (g: ReturnType<typeof buildProgramGraph>) =>
  g.edges.map((e) => `${e.from}>${e.to}:${e.kind}`).sort();

describe("buildProgramGraph", () => {
  it("and/or kenarları, iç içe or içindeki and 'or' olur", () => {
    const p = program("P",
      [c("CS 101"), c("MATH 101"), c("MATH 102")],
      [c("CS 102", "CS 101 and MATH 101"), c("CS 103", "CS 101 or (MATH 101 and MATH 102)")],
    );
    expect(kinds(buildProgramGraph(p, []))).toEqual([
      "CS 101>CS 102:and", "CS 101>CS 103:or", "MATH 101>CS 102:and", "MATH 101>CS 103:or", "MATH 102>CS 103:or",
    ]);
  });

  it("and altındaki or grubu 'or', dışındaki 'and'", () => {
    const p = program("P", [c("AA 101"), c("BB 101"), c("CC 101")], [c("D 201", "AA 101 and (BB 101 or CC 101)")]);
    expect(kinds(buildProgramGraph(p, []))).toEqual(["AA 101>D 201:and", "BB 101>D 201:or", "CC 101>D 201:or"]);
  });

  it("ayrı seçenek grupları ayrı numara alır: (A or B) and (C or D)", () => {
    const p = program("P", [c("AA 101"), c("BB 101"), c("CC 101"), c("DD 101")], [c("E 201", "(AA 101 or BB 101) and (CC 101 or DD 101)")]);
    const groups = Object.fromEntries(buildProgramGraph(p, []).edges.map((e) => [e.from, e.group]));
    expect(groups["AA 101"]).toBe(groups["BB 101"]);
    expect(groups["CC 101"]).toBe(groups["DD 101"]);
    expect(groups["AA 101"]).not.toBe(groups["CC 101"]);
  });

  it("program dışı kodlar düğüm/kenar olmaz, metin korunur; seçmeliler atlanır", () => {
    const p = program("P", [c("CS 101"), { kind: "elective", label: "Seçmeli", credits: 6, pool: null }],
      [c("CS 102", "CS 101 or CS 999")]);
    const g = buildProgramGraph(p, []);
    expect([...g.nodes.keys()]).toEqual(["CS 101", "CS 102"]);
    expect(kinds(g)).toEqual(["CS 101>CS 102:or"]);
    expect(g.nodes.get("CS 102")!.prerequisiteText).toBe("CS 101 or CS 999");
    expect(g.nodes.get("CS 102")!.slot).toEqual({ year: 1, season: "bahar" });
  });

  it("tekrar eden kenar tek, kendine kenar yok, kodlar kanonik", () => {
    const p = program("P", [c("cs101"), c("CS 102", "CS 102 and CS101 and CS 101")]);
    const g = buildProgramGraph(p, []);
    expect([...g.nodes.keys()]).toEqual(["CS 101", "CS 102"]);
    expect(kinds(g)).toEqual(["CS 101>CS 102:and"]);
  });

  it("boş metin ve eksik alanlar dönem verisinden; minEcts ve unreadable", () => {
    const p = program("P", [c("AA 101", "", null), c("BB 101", "AA 101 and en az 90 AKTS"), c("CC 101", "abrakadabra")]);
    const g = buildProgramGraph(p, [term({ code: "AA 101", title: "T", ects: 5, prerequisites: "BB 101" })]);
    const a = g.nodes.get("AA 101")!;
    expect(a.credits).toBe(5);
    expect(a.prerequisiteText).toBe("BB 101");
    expect(g.nodes.get("BB 101")!.minEcts).toBe(90);
    expect(g.nodes.get("BB 101")!.unreadable).toBe(false);
    expect(g.nodes.get("CC 101")!.unreadable).toBe(true);
    expect(g.nodes.get("CC 101")!.minEcts).toBeNull();
    // döngü: A <-> B
    expect(kinds(g)).toEqual(["AA 101>BB 101:and", "BB 101>AA 101:and"]);
  });
});

describe("ancestors / descendants", () => {
  const p = program("P", [c("AA 101"), c("BB 101", "AA 101")], [c("CC 101", "BB 101"), c("DD 101", "CC 101 or AA 101")]);
  const g = buildProgramGraph(p, []);

  it("dolaylı dahil", () => {
    expect([...ancestors(g, "DD 101")].sort()).toEqual(["AA 101", "BB 101", "CC 101"]);
    expect([...descendants(g, "AA 101")].sort()).toEqual(["BB 101", "CC 101", "DD 101"]);
    expect(ancestors(g, "AA 101").size).toBe(0);
  });

  it("döngüde sonsuza gitmez, kendisi dahil edilmez", () => {
    const cyc = buildProgramGraph(program("P", [c("XX 101", "YY 101"), c("YY 101", "ZZ 101"), c("ZZ 101", "XX 101")]), []);
    expect([...ancestors(cyc, "XX 101")].sort()).toEqual(["YY 101", "ZZ 101"]);
    expect([...descendants(cyc, "XX 101")].sort()).toEqual(["YY 101", "ZZ 101"]);
  });
});

describe("buildCourseChain", () => {
  const p1 = program("P1", [c("AA 101"), c("BB 101", "AA 101")], [c("CC 101", "BB 101 or AA 101"), c("DD 101", "CC 101 and BB 101")]);
  const p2 = program("P2", [c("EE 101", "DD 101")]);
  const t = term({ code: "FF 101", title: "Dönem dersi", ects: 4, prerequisites: "DD 101 or EE 101" }, { code: "AA 101", prerequisites: "DD 101" });

  it("requires seviye seviye, tekrar ve döngü yok", () => {
    const ch = buildCourseChain("dd101", [p1, p2], [t]);
    expect(ch.node.code).toBe("DD 101");
    const levels = ch.requires.map((l) => l.items.map((i) => `${i.node.code}:${i.kind}<${i.via}`));
    // AA 101'in program metni boş, dönem verisinde "DD 101" (döngü) var: kök tekrar gelmez.
    expect(levels).toEqual([["BB 101:and<DD 101", "CC 101:and<DD 101"], ["AA 101:and<BB 101"]]);
    expect(ch.requires.map((l) => l.depth)).toEqual([1, 2]);
  });

  it("unlocks bütün programlar ve dönem verisinden", () => {
    const ch = buildCourseChain("DD 101", [p1, p2], [t]);
    const levels = ch.unlocks.map((l) => l.items.map((i) => `${i.node.code}:${i.kind}`));
    expect(levels[0]).toEqual(["AA 101:and", "EE 101:and", "FF 101:or"]);
    expect(ch.unlocks[0].items.find((i) => i.node.code === "FF 101")!.node.title).toBe("Dönem dersi");
    // AA 101 -> BB 101, CC 101 (DD 101 kök, tekrar yok); EE 101 -> FF 101 zaten görüldü
    expect(levels[1]).toEqual(["BB 101:and", "CC 101:or"]);
  });

  it("depth sınırı", () => {
    const chain = program("L", [c("LL 101"), c("LL 102", "LL 101"), c("LL 103", "LL 102"), c("LL 104", "LL 103"), c("LL 105", "LL 104")]);
    expect(buildCourseChain("LL 105", [chain], [], 2).requires.map((l) => l.items[0].node.code)).toEqual(["LL 104", "LL 103"]);
    expect(buildCourseChain("LL 105", [chain], []).requires).toHaveLength(3);
  });

  it("seviye başına en çok 30 ders, kod sırasıyla", () => {
    const many = Array.from({ length: 40 }, (_, i) => c(`XX ${String(100 + i)}`, "ROOT 100"));
    const ch = buildCourseChain("ROOT 100", [program("M", [c("ROOT 100"), ...many])], []);
    expect(ch.unlocks[0].items).toHaveLength(30);
    expect(ch.unlocks[0].items[0].node.code).toBe("XX 100");
    expect(ch.unlocks[0].items[29].node.code).toBe("XX 129");
  });
});

describe("gerçek veri: BSCS", () => {
  const programs = (programsData as ProgramsData).programs;
  const bscs = programs.find((p) => p.id === "BSCS")!;
  const terms = [termGuz as TermData];
  const g = buildProgramGraph(bscs, terms);

  it("düğüm sayısı tekil ders kalemi sayısı", () => {
    const codes = new Set<string>();
    for (const s of bscs.semesters) for (const i of s.items) if (i.kind === "course") codes.add(i.code.replace(/\s+/g, ""));
    expect(g.nodes.size).toBe(codes.size);
  });

  it("CS 201'in ataları", () => {
    // (CS 102 or CS 105) and (CS112 or MATH 112); CS 102 <- CS 101 veya CS 103; CS 112 <- CS 101 or CS 104
    expect([...ancestors(g, "CS 201")].sort()).toEqual(["CS 101", "CS 102", "CS 112"]);
    expect(g.edges.filter((e) => e.to === "CS 201").every((e) => e.kind === "or")).toBe(true);
    expect(descendants(g, "CS 201").has("CS 402")).toBe(true);
    expect(g.nodes.get("CS 401")!.unreadable).toBe(true);
    expect(g.nodes.get("FE 301")!.minEcts).toBe(105);
  });

  it("zincir tüm programlarla çalışır", () => {
    const ch = buildCourseChain("CS 201", programs, terms);
    expect(ch.requires[0].items.map((i) => i.node.code)).toEqual(expect.arrayContaining(["CS 102", "CS 112"]));
    expect(ch.unlocks[0].items.length).toBeGreaterThan(3);
    expect(ch.unlocks[0].items.length).toBeLessThanOrEqual(30);
  });
});

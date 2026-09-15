import { describe, expect, it } from "vitest";
import {
  charsForWidth,
  courseSlug,
  degreeCounts,
  directNeighbors,
  joinList,
  nodeAriaLabel,
  splitVisible,
  truncateLabel,
} from "./prereq-map-helpers";
import type { GraphEdge, GraphNode, PrereqGraph } from "@/lib/prereq-graph/types";

describe("truncateLabel", () => {
  it("kısa metne dokunmaz, boşlukları toparlar", () => {
    expect(truncateLabel("  Veri   Yapıları ", 20)).toBe("Veri Yapıları");
  });

  it("uzun metni sınırda keser ve üç nokta koyar", () => {
    const out = truncateLabel("Veri Yapıları ve Algoritmalar", 18);
    expect(out.length).toBeLessThanOrEqual(18);
    expect(out.endsWith("…")).toBe(true);
    expect(out).toBe("Veri Yapıları ve…");
  });

  it("son boşluk çok gerideyse kelimeyi böler", () => {
    expect(truncateLabel("Mühendislik Matematiği", 12)).toBe("Mühendislik…");
    expect(truncateLabel("Termodinamik", 6)).toBe("Termo…");
  });

  it("uç durumlar", () => {
    expect(truncateLabel("abc", 0)).toBe("");
    expect(truncateLabel("abcdef", 1)).toBe("…");
  });
});

describe("charsForWidth", () => {
  it("genişliğe göre karakter sayısı verir, en az 1", () => {
    expect(charsForWidth(168, 12)).toBe(22);
    expect(charsForWidth(10, 12)).toBe(1);
  });
});

describe("nodeAriaLabel", () => {
  it("örnekteki cümleyi kurar", () => {
    expect(
      nodeAriaLabel({ code: "CS 201", title: "Veri Yapıları", status: "remaining", prereqCount: 2, unlockCount: 3 }),
    ).toBe("CS 201 Veri Yapıları, kalan, 2 ön koşul, 3 dersin önünü açıyor");
  });

  it("geçildi, kritik ve okunamayan koşulu söyler", () => {
    expect(
      nodeAriaLabel({
        code: "MATH 101",
        title: "Kalkülüs",
        status: "passed",
        prereqCount: 0,
        unlockCount: 0,
        critical: true,
        unreadable: true,
      }),
    ).toBe("MATH 101 Kalkülüs, geçildi, kritik, ön koşulu yok, koşulun bir kısmı okunamadı");
  });
});

describe("courseSlug", () => {
  it("scraper kuralıyla aynı", () => {
    expect(courseSlug("CS 201")).toBe("cs-201");
    expect(courseSlug("MİM 105")).toBe("mim-105");
    expect(courseSlug("SAS 405_U")).toBe("sas-405-u");
  });
});

const node = (code: string): GraphNode => ({
  code,
  title: code,
  credits: null,
  slot: null,
  unreadable: false,
  prerequisiteText: "",
  minEcts: null,
});

describe("directNeighbors ve degreeCounts", () => {
  const edges: GraphEdge[] = [
    { from: "A", to: "C", kind: "and", group: null },
    { from: "B", to: "C", kind: "or", group: 0 },
    { from: "B", to: "C", kind: "or", group: 0 },
    { from: "C", to: "D", kind: "and", group: null },
  ];
  const graph: PrereqGraph = { nodes: new Map(["A", "B", "C", "D"].map((c) => [c, node(c)])), edges };

  it("komşuları bir kez listeler", () => {
    expect(directNeighbors(edges, "C")).toEqual({
      requires: [
        { code: "A", kind: "and", group: null },
        { code: "B", kind: "or", group: 0 },
      ],
      unlocks: [{ code: "D", kind: "and" }],
    });
  });

  it("tekrarlı kenarları saymaz", () => {
    const counts = degreeCounts(graph);
    expect(counts.get("C")).toEqual({ prereqs: 2, unlocks: 1 });
    expect(counts.get("B")).toEqual({ prereqs: 0, unlocks: 1 });
  });
});

describe("joinList ve splitVisible", () => {
  it("Türkçe liste", () => {
    expect(joinList([])).toBe("");
    expect(joinList(["A"])).toBe("A");
    expect(joinList(["A", "B"])).toBe("A ve B");
    expect(joinList(["A", "B", "C"], "ya da")).toBe("A, B ya da C");
  });

  it("görünür ve gizli", () => {
    expect(splitVisible([1, 2, 3], 2)).toEqual({ visible: [1, 2], hidden: [3] });
  });
});

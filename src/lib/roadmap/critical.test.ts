import { describe, expect, it } from "vitest";
import { criticalCourses, unreadablePrerequisites } from "./critical";
import type { PrereqApi } from "./plan";
import type { PrereqExpr, Requirement, RoadmapProgram } from "./types";

// Sahte ön koşul okuyucu: "A 1 and B 2" / "A 1 or B 2"; "?" içeren metin okunamaz.
const fake: PrereqApi = {
  parse(text): PrereqExpr {
    const t = text.trim();
    if (!t) return { kind: "none" };
    const parts = t
      .split(/ and | or /)
      .map((p): PrereqExpr => (p.includes("?") ? { kind: "unknown", text: p } : { kind: "course", code: p }));
    return { kind: "and", items: parts };
  },
  evaluate: () => null,
  codes: (e) => (e.kind === "and" ? e.items.flatMap((i) => (i.kind === "course" ? [i.code] : [])) : []),
  hasUnknown: (e) => e.kind === "and" && e.items.some((i) => i.kind === "unknown"),
};

const course = (id: string, code: string, prerequisites = ""): Requirement => ({
  id,
  programId: "P",
  kind: "course",
  code,
  title: code,
  credits: 6,
  prerequisites,
  corequisites: [],
  pool: null,
  slot: null,
});

const program: RoadmapProgram = {
  id: "P",
  kind: "anadal",
  name: "P",
  totalCredits: 0,
  requirements: [
    course("P:0", "CS 101"),
    course("P:1", "CS 102", "CS 101"),
    course("P:2", "CS 201", "CS 102 and MATH 101"),
    course("P:3", "CS 301", "CS201"),
    course("P:4", "MATH 101"),
    course("P:5", "CS 401", "CS 301 and ? en az ikisi"),
  ],
};

describe("criticalCourses", () => {
  it("dolaylı bekleyenleri sayar, çoktan aza sıralar", () => {
    expect(criticalCourses([program], {}, fake)).toEqual([
      { code: "CS 101", blocks: ["CS 102", "CS 201", "CS 301", "CS 401"] },
      { code: "CS 102", blocks: ["CS 201", "CS 301", "CS 401"] },
      { code: "MATH 101", blocks: ["CS 201", "CS 301", "CS 401"] },
      { code: "CS 201", blocks: ["CS 301", "CS 401"] },
      { code: "CS 301", blocks: ["CS 401"] },
    ]);
  });

  it("geçilen dersler hesaba girmez", () => {
    const res = criticalCourses([program], { "P:0": true, "P:1": true, "P:4": true }, fake);
    expect(res.map((r) => r.code)).toEqual(["CS 201", "CS 301"]);
  });
});

describe("unreadablePrerequisites", () => {
  it("kalan derslerdeki okunamayan metinleri verir", () => {
    expect(unreadablePrerequisites([program], {}, fake)).toEqual([
      { requirementId: "P:5", code: "CS 401", text: "CS 301 and ? en az ikisi" },
    ]);
    expect(unreadablePrerequisites([program], { "P:5": true }, fake)).toEqual([]);
  });
});

describe("gerçek ön koşul okuyucuyla", () => {
  it("varsayılan modül kullanılır", () => {
    const res = criticalCourses([program], {});
    expect(res[0].code).toBe("CS 101");
    expect(unreadablePrerequisites([program], {}).map((r) => r.requirementId)).toEqual(["P:5"]);
  });
});

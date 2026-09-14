import { describe, expect, it } from "vitest";
import {
  canRetake,
  computeGpa,
  gradeEntries,
  maxLoad,
  nextThreshold,
  retakeGpa,
  targetAverage,
  type GradeEntry,
} from "./gpa";
import type { Requirement, RoadmapProgram } from "./types";

const req = (id: string, patch: Partial<Requirement>): Requirement => ({
  id,
  programId: id.split(":")[0],
  kind: "course",
  code: null,
  title: id,
  credits: 6,
  prerequisites: "",
  corequisites: [],
  pool: null,
  slot: null,
  ...patch,
});

const prog = (id: string, kind: RoadmapProgram["kind"], requirements: Requirement[]): RoadmapProgram => ({
  id,
  kind,
  name: id,
  requirements,
  totalCredits: 240,
});

const entry = (key: string, credits: number, grade: GradeEntry["grade"]): GradeEntry => ({ key, label: key, credits, grade });

describe("computeGpa", () => {
  it("weights grades by AKTS and rounds to two decimals", () => {
    // (6*4 + 4*2.7 + 8*2.3) / 18 = 53.2 / 18 = 2.9555…
    const result = computeGpa([entry("a", 6, "A"), entry("b", 4, "B-"), entry("c", 8, "C+")]);
    expect(result).toMatchObject({ gpa: 2.96, credits: 18 });
    expect(result.points).toBeCloseTo(53.2);
  });

  it("returns null without grades", () => {
    expect(computeGpa([]).gpa).toBeNull();
  });
});

describe("gradeEntries", () => {
  it("counts a course graded in two programs once and uses the chosen pool course's credits", () => {
    const a = prog("A", "anadal", [
      req("A:0", { code: "MATH 211", credits: 6 }),
      req("A:1", { kind: "elective", pool: [{ code: "CS 447", title: "Ağlar", credits: 5 }] }),
      req("A:2", { kind: "elective", credits: null }),
    ]);
    const c = prog("B", "cap", [req("B:0", { code: "MATH211", credits: 6 })]);
    const entries = gradeEntries([a, c], { "A:0": true, "B:0": true, "A:1": "CS 447", "A:2": true }, { "A:0": "B", "B:0": "A", "A:1": "C", "A:2": "A" });
    expect(entries).toEqual([
      { key: "MATH 211", label: "MATH 211", credits: 6, grade: "B" },
      { key: "CS 447", label: "CS 447", credits: 5, grade: "C" },
    ]);
  });
});

describe("targetAverage", () => {
  const current = [entry("a", 60, "C+"), entry("b", 60, "B-")]; // 2.50 over 120 AKTS

  it("gives the average needed on the remaining credits, rounded up", () => {
    // 3.00 * 240 = 720; now 300 points; need 420 over 120 = 3.50
    expect(targetAverage(current, 120, 3)).toEqual({ kind: "needed", average: 3.5 });
    // 2.8 * 240 = 672 - 300 = 372 / 120 = 3.1
    expect(targetAverage(current, 120, 2.8)).toEqual({ kind: "needed", average: 3.1 });
  });

  it("says when the target is out of reach and what the best case is", () => {
    expect(targetAverage(current, 30, 3.5)).toEqual({ kind: "impossible", best: 2.8 });
  });

  it("says when even all F keeps the target", () => {
    expect(targetAverage([entry("a", 100, "A")], 20, 3)).toEqual({ kind: "guaranteed" });
  });

  it("drops failed courses from the current average because the retake grade replaces F", () => {
    const withF = [entry("a", 54, "B"), entry("f", 6, "F")];
    // kept 162 points / 54; the failed 6 AKTS is among the remaining; 3.0*60 = 180 - 162 = 18 / 6 = 3.00
    expect(targetAverage(withF, 6, 3)).toEqual({ kind: "needed", average: 3 });
  });
});

describe("retake rules", () => {
  it("allows retaking B- and below only", () => {
    expect(canRetake("B")).toBe(false);
    expect(canRetake("B-")).toBe(true);
    expect(canRetake("F")).toBe(true);
  });

  it("replaces the old grade with the new one", () => {
    const entries = [entry("a", 6, "C"), entry("b", 6, "A")];
    expect(retakeGpa(entries, "a", "A")).toBe(4);
  });
});

describe("thresholds and load", () => {
  it("finds the next threshold above the GPA", () => {
    expect(nextThreshold(2.1)?.value).toBe(2.2);
    expect(nextThreshold(3.6)).toBeNull();
  });

  it("follows Madde 20 for the maximum load", () => {
    expect(maxLoad(null, { cap: false, passedEcts: 0 })).toBe(30);
    expect(maxLoad(1.99, { cap: false, passedEcts: 100 })).toBe(30);
    expect(maxLoad(2, { cap: false, passedEcts: 100 })).toBe(36);
    expect(maxLoad(3, { cap: false, passedEcts: 100 })).toBe(42);
    expect(maxLoad(1.7, { cap: false, passedEcts: 200 })).toBe(42);
    expect(maxLoad(1.5, { cap: true, passedEcts: 0 })).toBe(42);
  });
});

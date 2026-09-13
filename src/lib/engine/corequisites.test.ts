import { describe, expect, it } from "vitest";
import type { Course } from "../types";
import { expandCorequisites } from "./corequisites";

const course = (code: string, corequisites: string[] = []): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: code,
  ects: null,
  localCredits: null,
  prerequisites: "",
  corequisites,
  sections: [],
});

const codes = (cs: Course[]) => cs.map((c) => c.code);

describe("expandCorequisites", () => {
  const cs101 = course("CS 101", ["CS 101L"]);
  const cs101l = course("CS 101L");
  const phys = course("PHYS 101", ["PHYS 101L", "PHYS 101R"]);
  const physL = course("PHYS 101L", ["PHYS 101"]);
  const physR = course("PHYS 101R", ["MATH 999"]); // MATH 999 not offered this term
  const math = course("MATH 101");
  const all = [cs101, cs101l, phys, physL, physR, math];

  it("returns the selection unchanged when there are no corequisites", () => {
    expect(codes(expandCorequisites([math], all))).toEqual(["MATH 101"]);
  });

  it("adds a missing corequisite present in the term data, after the selection", () => {
    expect(codes(expandCorequisites([cs101, math], all))).toEqual(["CS 101", "MATH 101", "CS 101L"]);
  });

  it("works in the reverse direction (the lab lists nothing, the lecture lists the lab)", () => {
    expect(codes(expandCorequisites([cs101l], all))).toEqual(["CS 101L", "CS 101"]);
  });

  it("follows chains, ignores codes that are not offered and never duplicates", () => {
    expect(codes(expandCorequisites([physR], all))).toEqual(["PHYS 101R", "PHYS 101", "PHYS 101L"]);
    expect(codes(expandCorequisites([phys, physL], all))).toEqual([
      "PHYS 101",
      "PHYS 101L",
      "PHYS 101R",
    ]);
  });

  it("matches codes ignoring case and whitespace", () => {
    const lecture = course("EE 201", ["ee201l"]);
    const lab = course("EE 201L");
    expect(codes(expandCorequisites([lecture], [lecture, lab]))).toEqual(["EE 201", "EE 201L"]);
  });

  it("does not mutate its inputs", () => {
    const selected = [cs101];
    expandCorequisites(selected, all);
    expect(codes(selected)).toEqual(["CS 101"]);
  });
});

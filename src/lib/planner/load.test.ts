import { describe, expect, it } from "vitest";
import type { Course } from "../types";
import { cartLoad, overloadText } from "./load";

const course = (code: string, ects: number | null): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: `${code} adı`,
  ects,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections: [],
});

const courses = new Map<string, Course>([
  ["CS 201", course("CS 201", 6)],
  ["MATH 211", course("MATH 211", 6)],
  ["TLL 100", course("TLL 100", null)],
]);

describe("cartLoad", () => {
  it("AKTS toplar, bilinmeyeni ayırır", () => {
    const load = cartLoad(["CS 201", "MATH 211", "TLL 100"], courses, 36, 2.84, false);
    expect(load).toMatchObject({ ects: 12, unknown: ["TLL 100"], limit: 36 });
  });
});

describe("overloadText", () => {
  const base = { ects: 38, unknown: [], limit: 36, gpa: 2.84, cap: false };

  it("sınır aşılmadıysa sessiz", () => {
    expect(overloadText({ ...base, ects: 36 })).toBeNull();
    expect(overloadText({ ...base, limit: null })).toBeNull();
  });

  it("aşınca kaç AKTS fazla olduğunu söyler", () => {
    expect(overloadText(base)).toBe("Sepetinde 38 AKTS var, dönem sınırın 36 AKTS (ortalaman 2,84 olduğu için). 2 AKTS fazlasın.");
  });

  it("çift anadalda gerekçe değişir, bilinmeyen AKTS belirtilir", () => {
    const text = overloadText({ ...base, ects: 45, limit: 42, cap: true, unknown: ["TLL 100"] });
    expect(text).toContain("çift anadal");
    expect(text).toContain("TLL 100 dersinin AKTS'si veride yok");
  });
});

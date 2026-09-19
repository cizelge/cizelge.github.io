import { describe, expect, it } from "vitest";
import type { Course } from "../types";
import type { InstructorSummary } from "../ratings/types";
import { bestPicks, scheduleScore, scoreLookup, sectionScore } from "./instructor-score";

const course = (code: string, sections: Record<string, string[]>): Course => ({
  code,
  slug: code.toLowerCase().replace(/\s+/g, "-"),
  title: `${code} adı`,
  ects: 6,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections: Object.entries(sections).map(([id, instructors]) => ({ id, instructors, capacity: null, restrictions: null, meetings: [] })),
});

const summary = (slug: string, score: number | null): InstructorSummary => ({
  slug,
  name: slug.toUpperCase(),
  n: 3,
  again: 100,
  criteria: {},
  score,
  comments: [],
});

const courses = new Map<string, Course>([
  ["CS 201", course("CS 201", { A: ["EMRE SEFER"], B: ["HASAN SÖZER"], C: [] })],
  ["MATH 211", course("MATH 211", { A: ["AYŞE KAYA"] })],
]);

const scoreOf = scoreLookup([summary("emre-sefer", 3.2), summary("hasan-sozer", 4.6), summary("ayse-kaya", null)]);

describe("sectionScore", () => {
  it("şubenin hocasının puanını verir, hocasız ya da puansız şubede null", () => {
    expect(sectionScore(courses.get("CS 201"), "A", scoreOf)).toBe(3.2);
    expect(sectionScore(courses.get("CS 201"), "B", scoreOf)).toBe(4.6);
    expect(sectionScore(courses.get("CS 201"), "C", scoreOf)).toBeNull();
    expect(sectionScore(courses.get("MATH 211"), "A", scoreOf)).toBeNull();
    expect(sectionScore(undefined, "A", scoreOf)).toBeNull();
  });
});

describe("scheduleScore", () => {
  it("yalnızca puanı bilinen şubeleri ortalar", () => {
    const refs = [
      { courseCode: "CS 201", sectionId: "A" },
      { courseCode: "MATH 211", sectionId: "A" },
    ];
    expect(scheduleScore(refs, courses, scoreOf)).toEqual({ score: 3.2, known: 1 });
  });

  it("hiç puan yoksa null", () => {
    expect(scheduleScore([{ courseCode: "MATH 211", sectionId: "A" }], courses, scoreOf)).toEqual({ score: null, known: 0 });
    const bos = scoreLookup(undefined);
    expect(scheduleScore([{ courseCode: "CS 201", sectionId: "A" }], courses, bos).score).toBeNull();
  });
});

describe("bestPicks", () => {
  it("aynı saatteki seçenekler arasından en yüksek puanlıyı seçer", () => {
    const refs = [{ courseCode: "CS 201", sectionId: "A" }];
    expect(bestPicks(refs, { "CS 201": ["A", "B", "C"] }, courses, scoreOf)).toEqual({ "CS 201": "B" });
  });

  it("zaten en iyisi seçiliyse ya da seçenek yoksa dokunmaz", () => {
    expect(bestPicks([{ courseCode: "CS 201", sectionId: "B" }], { "CS 201": ["A", "B"] }, courses, scoreOf)).toEqual({});
    expect(bestPicks([{ courseCode: "CS 201", sectionId: "A" }], { "CS 201": ["A"] }, courses, scoreOf)).toEqual({});
    expect(bestPicks([{ courseCode: "MATH 211", sectionId: "A" }], {}, courses, scoreOf)).toEqual({});
  });
});

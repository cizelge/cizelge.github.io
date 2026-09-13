import { describe, expect, it } from "vitest";
import type { Course } from "../types";
import { searchCourses } from "./search";

const course = (code: string, title: string, instructor = ""): Course => ({
  code,
  slug: code.toLowerCase(),
  title,
  ects: null,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections: [{ id: "A", instructors: instructor ? [instructor] : [], capacity: null, restrictions: null, meetings: [] }],
});

const courses = [
  course("MİM 105", "Mimarlık Kültürü", "MURAT ŞAHİN"),
  course("MATH 211", "Lineer Cebir"),
  course("CS 101", "Bilgisayar Programlama", "ALİ ERKAN"),
  course("CS 101L", "Bilgisayar Programlama Lab"),
];

const codes = (q: string) => searchCourses(courses, q).map((c) => c.code);

describe("searchCourses", () => {
  it("finds codes with Turkish letters however they are typed", () => {
    expect(codes("mim")).toEqual(["MİM 105"]);
    expect(codes("MIM105")).toEqual(["MİM 105"]);
    expect(codes("mİm 105")).toEqual(["MİM 105"]);
  });

  it("ranks an exact code first, then code prefixes", () => {
    expect(codes("cs 101")).toEqual(["CS 101", "CS 101L"]);
  });

  it("matches titles and instructors without caring about case or Turkish letters", () => {
    expect(codes("lineer")).toEqual(["MATH 211"]);
    expect(codes("sahin")).toEqual(["MİM 105"]);
    expect(codes("ali erkan")).toEqual(["CS 101"]);
  });

  it("returns nothing for an empty query", () => {
    expect(codes("  ")).toEqual([]);
  });
});

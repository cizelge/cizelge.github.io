import { describe, expect, it } from "vitest";
import type { Course, TermData } from "../types";
import { buildOfferingMap } from "./offering";
import type { Requirement, RoadmapProgram } from "./types";

const c = (code: string, withTimes = false): Course => ({
  code,
  slug: code,
  title: code,
  ects: 6,
  localCredits: null,
  prerequisites: "",
  corequisites: [],
  sections: [
    { id: "A", instructors: [], capacity: null, restrictions: null, meetings: withTimes ? [{ day: 1, start: "10:40", end: "12:30", room: null }] : [] },
  ],
});

const term = (label: string, courses: Course[]): TermData => ({
  schoolId: "ozyegin",
  termId: "x",
  termLabel: label,
  fetchedAt: "",
  courses,
});

const req = (id: string, over: Partial<Requirement>): Requirement => ({
  id,
  programId: "P",
  kind: "course",
  code: null,
  title: "",
  credits: 6,
  prerequisites: "",
  corequisites: [],
  pool: null,
  slot: null,
  ...over,
});

const program: RoadmapProgram = {
  id: "P",
  kind: "anadal",
  name: "P",
  totalCredits: 0,
  requirements: [
    req("P:1", { code: "CS 101", slot: { year: 1, season: "guz" } }),
    req("P:2", { code: "CS 102", slot: { year: 1, season: "bahar" } }),
    req("P:3", { code: "CS 999", slot: { year: 2, season: "guz" } }),
    req("P:4", { code: "CS 998", slot: { year: 2, season: "other" } }),
    req("P:5", { kind: "elective", slot: { year: 3, season: "bahar" }, pool: [{ code: "EE 1", title: "", credits: 4 }, { code: "EE 2", title: "", credits: 4 }] }),
  ],
};
const minor: RoadmapProgram = {
  id: "M",
  kind: "yandal",
  name: "M",
  totalCredits: 0,
  requirements: [req("M:req:0", { code: "PSY 101" })],
};

describe("buildOfferingMap", () => {
  const terms = [
    term("2026 - 2027 Güz", [c("CS 101", true), c("CS 102", true), c("EE 1", true)]),
    term("2026 -2027 Bahar", [c("CS 102"), c("EE 2")]), // saatsiz liste de sayılır
  ];
  const map = buildOfferingMap(terms, [program, minor]);
  const get = (code: string) => [...(map.get(code) ?? [])].sort();

  it("dönem verisindeki mevsimleri kullanır", () => {
    expect(get("CS 101")).toEqual(["guz"]);
    expect(get("CS 102")).toEqual(["bahar", "guz"]);
    expect(get("EE 1")).toEqual(["guz"]);
    expect(get("EE 2")).toEqual(["bahar"]);
  });

  it("veride olmayan ders müfredattaki mevsime, slotsuz ya da 'other' ise iki mevsime düşer", () => {
    expect(get("CS 999")).toEqual(["guz"]);
    expect(get("CS 998")).toEqual(["bahar", "guz"]);
    expect(get("PSY 101")).toEqual(["bahar", "guz"]);
  });

  it("verisi olmayan mevsim müfredattan tamamlanır", () => {
    const onlyGuz = buildOfferingMap([term("2026 - 2027 Güz", [c("CS 101")])], [program]);
    expect([...onlyGuz.get("CS 102")!]).toEqual(["bahar"]);
    expect([...onlyGuz.get("CS 101")!]).toEqual(["guz"]);
  });
});

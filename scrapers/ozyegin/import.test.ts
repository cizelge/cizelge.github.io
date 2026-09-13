import { describe, expect, it } from "vitest";
import fixture from "./fixtures/cs101-export.json";
import { buildTermData, type RawExport } from "./import";
import { validateTermData } from "../validate";

const raw = fixture as RawExport;

describe("buildTermData", () => {
  const term = buildTermData([raw], { fetchedAt: "2026-09-13T13:25:42.486Z" });

  it("fills term metadata from the export", () => {
    expect(term.schoolId).toBe("ozyegin");
    expect(term.termId).toBe("2026-2027-guz");
    expect(term.termLabel).toBe("2026 - 2027 Güz");
  });

  it("groups section rows into courses, sorted by code", () => {
    expect(term.courses.map((c) => c.code)).toEqual(["CS 101", "CS 101L"]);
    expect(term.courses[1].sections.map((s) => s.id)).toEqual(["A", "B", "C"]);
  });

  it("parses credits as ECTS and keeps local credits unknown", () => {
    expect(term.courses[0].ects).toBe(6);
    expect(term.courses[0].localCredits).toBeNull();
    expect(term.courses[1].ects).toBe(0);
  });

  it("parses corequisites, instructors and meetings", () => {
    const cs101 = term.courses[0];
    expect(cs101.slug).toBe("cs-101");
    expect(cs101.corequisites).toEqual(["CS 101L"]);
    expect(cs101.sections[0]).toEqual({
      id: "B",
      instructors: ["ALİ ERKAN"],
      capacity: null,
      restrictions: null,
      meetings: [{ day: 1, start: "10:40", end: "12:30", room: null }],
    });
    expect(term.courses[1].sections[0].meetings[0].day).toBe(2);
  });

  it("merges several exports and drops duplicate section rows", () => {
    const merged = buildTermData([raw, raw], { fetchedAt: "x" });
    expect(merged.courses[1].sections).toHaveLength(3);
  });

  it("rejects exports from different terms", () => {
    const other = { ...raw, termLabel: "2026 - 2027 Bahar" };
    expect(() => buildTermData([raw, other], { fetchedAt: "x" })).toThrow(/dönem/i);
  });

  it("rejects a Sunday meeting instead of silently dropping it", () => {
    const sunday: RawExport = {
      ...raw,
      rows: [{ ...raw.rows[0], meetings: [{ dayText: "Pazar", timeText: "10:40 - 12:30" }] }],
    };
    expect(() => buildTermData([sunday], { fetchedAt: "x" })).toThrow(/Pazar/);
  });

  it("produces data that passes validation", () => {
    expect(validateTermData(term)).toEqual([]);
  });
});

describe("validateTermData", () => {
  const good = buildTermData([raw], { fetchedAt: "2026-09-13T13:25:42.486Z" });

  it("reports start >= end", () => {
    const bad = structuredClone(good);
    bad.courses[0].sections[0].meetings[0].end = "10:40";
    expect(validateTermData(bad).join("\n")).toMatch(/CS 101\.B/);
  });

  it("reports a course without sections", () => {
    const bad = structuredClone(good);
    bad.courses[0].sections = [];
    expect(validateTermData(bad).join("\n")).toMatch(/CS 101.*şube/);
  });

  it("reports a large drop in course count versus the previous data", () => {
    const previous = structuredClone(good);
    previous.courses = [...good.courses, ...good.courses, ...good.courses].map((c, i) => ({
      ...c,
      code: `${c.code}-${i}`,
    }));
    expect(validateTermData(good, previous).join("\n")).toMatch(/%/);
  });
});

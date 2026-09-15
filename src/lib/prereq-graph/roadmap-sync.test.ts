import { describe, expect, it } from "vitest";
import type { Program } from "../types";
import { completionFromMarks, marksFromCompletion, sameCompletion } from "./roadmap-sync";

const program: Program = {
  id: "BSX",
  slug: "bsx",
  name: "Deneme",
  faculty: "F",
  semesters: [
    {
      year: 1,
      season: "guz",
      label: "1. Yıl - Güz",
      credits: null,
      items: [
        { kind: "course", code: "CS 101", title: "Prog", credits: 6, prerequisites: "", corequisites: [] },
        { kind: "elective", label: "BSX Seçmeli", credits: 4, pool: [{ code: "A 1", title: "A", credits: 4 }] },
      ],
    },
    {
      year: 1,
      season: "bahar",
      label: "1. Yıl - Bahar",
      credits: null,
      items: [
        { kind: "course", code: "CS102", title: "OOP", credits: 6, prerequisites: "CS 101", corequisites: [] },
        { kind: "elective", label: "Serbest", credits: 4, pool: null },
      ],
    },
    {
      year: 2,
      season: "guz",
      label: "2. Yıl - Güz",
      credits: null,
      items: [{ kind: "course", code: "CS 101", title: "Prog (tekrar)", credits: 6, prerequisites: "", corequisites: [] }],
    },
  ],
};

describe("marksFromCompletion", () => {
  it("ders gereksinimini kanonik koda, seçmeliyi gereksinim id'sine çevirir", () => {
    const marks = marksFromCompletion(program, {
      "BSX:y1-guz:0": true,
      "BSX:y1-guz:1": "A 1",
      "BSX:y1-bahar:0": true,
      "BSX:y1-bahar:1": true,
      "OTHER:y1-guz:0": true,
    });
    expect(new Set(marks.taken)).toEqual(new Set(["CS 101", "BSX:y1-guz:1", "CS 102", "BSX:y1-bahar:1"]));
    expect(marks.choices).toEqual({ "BSX:y1-guz:1": "A 1" });
  });

  it("boş işaretlerde boş döner", () => {
    expect(marksFromCompletion(program, {})).toEqual({ taken: [], choices: {} });
  });
});

describe("completionFromMarks", () => {
  it("başka programların anahtarlarını korur, bu programınkini yeniden yazar", () => {
    const previous = { "OTHER:y1-guz:0": true as const, "BSX:y1-bahar:0": true as const, "BSX:y1-guz:1": "A 1" };
    const next = completionFromMarks(program, previous, { taken: ["CS 101", "BSX:y1-bahar:1"], choices: {} });
    expect(next).toEqual({
      "OTHER:y1-guz:0": true,
      "BSX:y1-guz:0": true,
      "BSX:y2-guz:0": true,
      "BSX:y1-bahar:1": true,
    });
    expect(previous).toEqual({ "OTHER:y1-guz:0": true, "BSX:y1-bahar:0": true, "BSX:y1-guz:1": "A 1" });
  });

  it("alınan seçmelide seçilen kodu yazar; seçim yoksa true", () => {
    const next = completionFromMarks(program, {}, { taken: ["BSX:y1-guz:1"], choices: { "BSX:y1-guz:1": "A 1", "BSX:y1-bahar:1": "Z 9" } });
    expect(next).toEqual({ "BSX:y1-guz:1": "A 1" });
  });

  it("gidiş dönüş aynı işaretleri verir", () => {
    const completion = { "BSX:y1-guz:0": true as const, "BSX:y2-guz:0": true as const, "BSX:y1-guz:1": "A 1" };
    const back = completionFromMarks(program, completion, marksFromCompletion(program, completion));
    expect(sameCompletion(back, completion)).toBe(true);
  });
});

describe("sameCompletion", () => {
  it("sıra önemsiz, değer farkı önemli", () => {
    expect(sameCompletion({ a: true, b: "X" }, { b: "X", a: true })).toBe(true);
    expect(sameCompletion({ a: true }, { a: "X" })).toBe(false);
    expect(sameCompletion({ a: true }, { a: true, b: true })).toBe(false);
  });
});

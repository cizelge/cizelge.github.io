import { describe, expect, it } from "vitest";
import { generateSchedules } from "./generate";
import { rescore } from "./score";
import { NO_WEIGHTS, crs, key, mt, sec } from "./test-fixtures";
import type { GenerateInput } from "./types";

const base = (over: Partial<GenerateInput>): GenerateInput => ({
  courses: [],
  freeDays: [],
  locked: {},
  excluded: [],
  weights: NO_WEIGHTS,
  ...over,
});

const keys = (input: GenerateInput) =>
  generateSchedules(input)
    .candidates.map((c) => key(c.sections))
    .sort();

const math = crs(
  "MATH 101",
  sec("A", mt(1, "10:40", "12:30"), mt(3, "10:40", "12:30")),
  sec("B", mt(2, "12:40", "14:30"), mt(4, "12:40", "14:30")),
);
const cs = crs(
  "CS 101",
  sec("A", mt(1, "11:40", "13:30")), // overlaps MATH A
  sec("B", mt(5, "08:40", "10:30")),
);

describe("generateSchedules — hard rules", () => {
  it("enumerates all non-overlapping combinations", () => {
    expect(keys(base({ courses: [math, cs] }))).toEqual([
      "MATH 101:A|CS 101:B",
      "MATH 101:B|CS 101:A",
      "MATH 101:B|CS 101:B",
    ]);
  });

  it("reports sections in the order the courses were given, not search order", () => {
    const one = crs("PHYS 101", sec("X", mt(6, "09:00", "10:00")));
    const r = generateSchedules(base({ courses: [math, one] }));
    for (const c of r.candidates) expect(c.sections.map((s) => s.courseCode)).toEqual(["MATH 101", "PHYS 101"]);
  });

  it("drops sections meeting on a free day", () => {
    expect(keys(base({ courses: [math, cs], freeDays: [5] }))).toEqual(["MATH 101:B|CS 101:A"]);
  });

  it("keeps sections without meetings, even with every day free", () => {
    const online = crs("ONL 100", sec("A"));
    const r = generateSchedules(base({ courses: [online], freeDays: [1, 2, 3, 4, 5, 6] }));
    expect(r.candidates.map((c) => key(c.sections))).toEqual(["ONL 100:A"]);
    expect(r.schedules[0].summary).toEqual({ days: 0, gapMinutes: 0, earliestStart: null, latestEnd: null });
  });

  it("forces a locked section", () => {
    expect(keys(base({ courses: [math, cs], locked: { "CS 101": "A" } }))).toEqual(["MATH 101:B|CS 101:A"]);
  });

  it("never uses an excluded section", () => {
    expect(
      keys(base({ courses: [math, cs], excluded: [{ courseCode: "MATH 101", sectionId: "B" }] })),
    ).toEqual(["MATH 101:A|CS 101:B"]);
  });

  it("ignores locks and exclusions for courses that are not selected", () => {
    expect(
      keys(
        base({
          courses: [math],
          locked: { "CS 101": "A" },
          excluded: [{ courseCode: "CS 101", sectionId: "B" }],
        }),
      ),
    ).toEqual(["MATH 101:A", "MATH 101:B"]);
  });

  it("returns one empty schedule when no course is selected", () => {
    const r = generateSchedules(base({}));
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].sections).toEqual([]);
    expect(r.reason).toBeNull();
  });

  it("treats a duplicated course code as one course", () => {
    expect(keys(base({ courses: [math, math] }))).toEqual(["MATH 101:A", "MATH 101:B"]);
  });

  it("returns nothing (and a reason) when the rules leave no schedule", () => {
    const r = generateSchedules(base({ courses: [math, cs], freeDays: [1, 2] }));
    expect(r.candidates).toEqual([]);
    expect(r.schedules).toEqual([]);
    expect(r.truncated).toBe(false);
  });
});

describe("generateSchedules — cap", () => {
  // 3 courses x 10 time-less sections = 1000 valid schedules
  const wide = ["A 1", "B 1", "C 1"].map((code) =>
    crs(code, ...Array.from({ length: 10 }, (_, i) => sec(String(i)))),
  );

  it("stops at the cap and says so", () => {
    const r = generateSchedules(base({ courses: wide, candidateCap: 100 }));
    expect(r.candidates).toHaveLength(100);
    expect(r.truncated).toBe(true);
  });

  it("is not truncated when the cap equals the number of schedules", () => {
    const r = generateSchedules(base({ courses: wide, candidateCap: 1000 }));
    expect(r.candidates).toHaveLength(1000);
    expect(r.truncated).toBe(false);
  });

  it("defaults to a 50 000 cap", () => {
    const big = ["A 1", "B 1", "C 1", "D 1", "E 1"].map((code) =>
      crs(code, ...Array.from({ length: 10 }, (_, i) => sec(String(i)))),
    );
    const r = generateSchedules(base({ courses: big }));
    expect(r.candidates).toHaveLength(50_000);
    expect(r.truncated).toBe(true);
  });
});

describe("generateSchedules — ranking", () => {
  const early = crs(
    "EARLY 1",
    sec("E", mt(1, "08:40", "10:30")),
    sec("L", mt(1, "18:00", "19:50")),
    sec("M", mt(2, "12:40", "14:30")),
  );
  const other = crs("OTHER 1", sec("A", mt(1, "13:40", "15:30")), sec("B", mt(3, "13:40", "15:30")));

  it("ranks by weights and matches rescore on the returned candidates", () => {
    const weights = { ...NO_WEIGHTS, noEarly: 3, fewDays: 1 };
    const r = generateSchedules(base({ courses: [early, other], weights }));
    expect(r.schedules.length).toBe(6);
    const scores = r.schedules.map((s) => s.score);
    expect([...scores].sort((a, b) => a - b)).toEqual(scores);
    expect(r.schedules[0].score).toBe(1); // L or M with A: 1 day, no early
    expect(r.schedules).toEqual(rescore(r.candidates, weights));
  });

  it("limits output to topN", () => {
    const r = generateSchedules(base({ courses: [early, other], topN: 2 }));
    expect(r.schedules).toHaveLength(2);
    expect(r.candidates).toHaveLength(6);
  });

  it("honours custom early/late thresholds", () => {
    const weights = { ...NO_WEIGHTS, noEarly: 1, noLate: 1 };
    const r = generateSchedules(
      base({
        courses: [early],
        weights,
        earlyThreshold: "08:00",
        lateThreshold: "20:00",
      }),
    );
    expect(r.schedules.every((s) => s.score === 0)).toBe(true);
  });

  it("summarises each schedule for display", () => {
    const r = generateSchedules(
      base({ courses: [early, other], locked: { "EARLY 1": "E", "OTHER 1": "A" } }),
    );
    expect(r.schedules[0].summary).toEqual({
      days: 1,
      gapMinutes: 190,
      earliestStart: "08:40",
      latestEnd: "15:30",
    });
  });
});

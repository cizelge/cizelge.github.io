import { describe, expect, it } from "vitest";
import { explainNoSolution } from "./explain";
import { generateSchedules } from "./generate";
import { NO_WEIGHTS, crs, mt, sec } from "./test-fixtures";
import type { Constraints } from "./types";

const base = (over: Partial<Constraints>): Constraints => ({
  courses: [],
  freeDays: [],
  locked: {},
  excluded: [],
  ...over,
});

describe("explainNoSolution — reason", () => {
  it("returns null when a schedule exists", () => {
    const c = crs("A 1", sec("A", mt(1, "10:00", "11:00")));
    expect(explainNoSolution(base({ courses: [c] }))).toEqual({ reason: null, suggestions: [] });
  });

  it("names a course whose every section is on a free day", () => {
    const ok = crs("OK 1", sec("A", mt(3, "10:00", "11:00")));
    const c = crs(
      "HIST 101",
      sec("A", mt(1, "10:40", "12:30"), mt(4, "10:40", "12:30")),
      sec("B", mt(4, "08:40", "10:30"), mt(2, "08:40", "10:30")),
    );
    const { reason } = explainNoSolution(base({ courses: [ok, c], freeDays: [2, 4] }));
    expect(reason).toEqual({
      kind: "noEligibleSection",
      courseCode: "HIST 101",
      blocked: [
        { sectionId: "A", cause: "freeDay", day: 4 },
        { sectionId: "B", cause: "freeDay", day: 4 },
      ],
    });
  });

  it("distinguishes locks, exclusions and courses without sections", () => {
    const c = crs("X 1", sec("A", mt(1, "10:00", "11:00")), sec("B", mt(2, "10:00", "11:00")));
    expect(
      explainNoSolution(
        base({ courses: [c], locked: { "X 1": "B" }, excluded: [{ courseCode: "X 1", sectionId: "B" }] }),
      ).reason,
    ).toEqual({
      kind: "noEligibleSection",
      courseCode: "X 1",
      blocked: [
        { sectionId: "A", cause: "notLocked" },
        { sectionId: "B", cause: "excluded" },
      ],
    });
    expect(explainNoSolution(base({ courses: [crs("EMPTY 1")] })).reason).toEqual({
      kind: "noEligibleSection",
      courseCode: "EMPTY 1",
      blocked: [],
    });
  });

  it("reports a pair of courses whose every section pair overlaps, with one overlap time", () => {
    const free = crs("ART 100", sec("A", mt(5, "15:40", "17:30")));
    const math = crs(
      "MATH 211",
      sec("A", mt(2, "12:40", "14:30")),
      sec("B", mt(2, "12:40", "14:30"), mt(4, "08:40", "10:30")),
    );
    const phys = crs("PHYS 101", sec("A", mt(2, "12:40", "13:30")), sec("B", mt(2, "13:40", "15:30")));
    const { reason } = explainNoSolution(base({ courses: [free, math, phys] }));
    expect(reason).toEqual({
      kind: "pairConflict",
      courseCodes: ["MATH 211", "PHYS 101"],
      overlap: { day: 2, start: "12:40", end: "13:30" },
    });
  });

  it("reports a minimal group when no single course or pair is impossible", () => {
    const at = (code: string) =>
      crs(code, sec("A", mt(1, "09:00", "10:00")), sec("B", mt(1, "10:00", "11:00")));
    const unrelated = crs("U 1", sec("A", mt(3, "09:00", "10:00")));
    const { reason } = explainNoSolution(base({ courses: [unrelated, at("B 1"), at("C 1"), at("D 1")] }));
    expect(reason).toEqual({ kind: "groupConflict", courseCodes: ["B 1", "C 1", "D 1"] });
  });
});

describe("explainNoSolution — suggestions", () => {
  const math = crs(
    "MATH 101",
    sec("A", mt(1, "10:40", "12:30")),
    sec("B", mt(2, "10:40", "12:30")),
    sec("C", mt(3, "10:40", "12:30")),
  );
  const cs = crs("CS 101", sec("A", mt(1, "10:40", "12:30")), sec("B", mt(4, "10:40", "12:30")));
  const input = base({
    courses: [math, cs],
    freeDays: [2, 6],
    locked: { "CS 101": "A" },
    excluded: [
      { courseCode: "BIO 100", sectionId: "A" }, // course not selected: never suggested
      { courseCode: "MATH 101", sectionId: "C" },
    ],
  });

  it("lists each single constraint whose removal yields schedules, with the count", () => {
    const { reason, suggestions } = explainNoSolution(input);
    expect(reason).toEqual({
      kind: "pairConflict",
      courseCodes: ["MATH 101", "CS 101"],
      overlap: { day: 1, start: "10:40", end: "12:30" },
    });
    expect(suggestions).toEqual([
      { constraint: { kind: "freeDay", day: 2 }, scheduleCount: 1, truncated: false },
      { constraint: { kind: "lock", courseCode: "CS 101", sectionId: "A" }, scheduleCount: 1, truncated: false },
      {
        constraint: { kind: "exclusion", courseCode: "MATH 101", sectionId: "C" },
        scheduleCount: 1,
        truncated: false,
      },
    ]);
  });

  it("counts every schedule a relaxation produces", () => {
    const many = crs("MANY 1", ...["A", "B", "C", "D"].map((id) => sec(id, mt(5, "10:00", "11:00"))));
    const { suggestions } = explainNoSolution(base({ courses: [many], freeDays: [5] }));
    expect(suggestions).toEqual([{ constraint: { kind: "freeDay", day: 5 }, scheduleCount: 4, truncated: false }]);
  });

  it("is what generateSchedules returns when nothing fits", () => {
    const r = generateSchedules({ ...input, weights: NO_WEIGHTS });
    expect(r.schedules).toEqual([]);
    expect(r.reason?.kind).toBe("pairConflict");
    expect(r.suggestions).toHaveLength(3);
    expect(generateSchedules({ ...input, freeDays: [], weights: NO_WEIGHTS }).reason).toBeNull();
  });
});

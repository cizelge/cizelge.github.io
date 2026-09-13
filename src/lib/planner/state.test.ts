import { describe, expect, it } from "vitest";
import { decodeState, DEFAULT_WEIGHTS, EMPTY_STATE, encodeState, type PlannerState } from "./state";

const sections = new Map<string, string[]>([
  ["CS 101", ["A", "B"]],
  ["CS 101L", ["A", "B", "C"]],
  ["MATH 103", ["A"]],
]);

describe("encodeState / decodeState", () => {
  it("round-trips a full state", () => {
    const s: PlannerState = {
      cart: ["CS 101", "CS 101L", "MATH 103"],
      freeDays: [5, 1],
      locked: { "CS 101": "B" },
      excluded: [{ courseCode: "CS 101L", sectionId: "C" }],
      weights: { fewDays: 3, fewGaps: 0, lunchBreak: 1, noEarly: 2, noLate: 0 },
      selected: 2,
    };
    const q = encodeState(s);
    expect(q).toBe("d=CS101%2CCS101L%2CMATH103&bos=15&kilit=CS101%3AB&haric=CS101L%3AC&w=30120&p=3");
    expect(decodeState(q, sections)).toEqual({ state: { ...s, freeDays: [1, 5] }, missing: [] });
  });

  it("keeps the empty state's link empty", () => {
    expect(encodeState(EMPTY_STATE)).toBe("");
  });

  it("reports courses and sections that no longer exist, and keeps the rest", () => {
    const { state, missing } = decodeState("d=CS101,OLD999&kilit=CS101:Z&haric=MATH103:A", sections);
    expect(state.cart).toEqual(["CS 101"]);
    expect(state.locked).toEqual({});
    expect(missing).toEqual(["OLD999", "CS101:Z", "MATH103:A"]);
  });

  it("ignores malformed weights, days and page numbers", () => {
    const { state } = decodeState("d=cs101&w=99&bos=09x7&p=abc", sections);
    expect(state.cart).toEqual(["CS 101"]);
    expect(state.weights).toEqual(DEFAULT_WEIGHTS);
    expect(state.freeDays).toEqual([]);
    expect(state.selected).toBe(0);
  });
});

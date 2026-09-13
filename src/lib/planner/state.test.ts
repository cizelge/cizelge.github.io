import { describe, expect, it } from "vitest";
import { normalizeCode } from "../engine";
import { decodeState, DEFAULT_WEIGHTS, EMPTY_STATE, encodeState, resolveCode, type PlannerState } from "./state";

describe("course codes with Turkish letters and underscores", () => {
  const tr = new Map<string, string[]>([
    ["MİM 105", ["A", "B"]],
    ["SAS 405_U", ["A"]],
    ["MIS 201", ["A"]],
  ]);

  it("normalizeCode keeps İ distinct from I and undoes a lower-cased İ", () => {
    expect(normalizeCode("MİM 105")).toBe("MİM105");
    expect(normalizeCode("mi̇m105")).toBe("MİM105"); // "MİM".toLowerCase() === "mi̇m"
    expect(normalizeCode("MİM105")).not.toBe(normalizeCode("MIM105"));
    expect(normalizeCode("sas 405_u")).toBe("SAS405_U");
  });

  it("round-trips such codes through the link", () => {
    const s: PlannerState = { ...EMPTY_STATE, cart: ["MİM 105", "SAS 405_U"], locked: { "MİM 105": "B" } };
    const q = encodeState(s);
    expect(new URLSearchParams(q).get("d")).toBe("MİM105,SAS405_U");
    expect(decodeState(q, tr)).toEqual({ state: s, missing: [] });
  });

  it("resolves hand-typed links with raw Turkish letters", () => {
    expect(resolveCode("MİM105", [...tr.keys()])).toBe("MİM 105");
    const { state, missing } = decodeState("d=MİM105,sas405_u&kilit=MİM105:B", tr);
    expect(state.cart).toEqual(["MİM 105", "SAS 405_U"]);
    expect(state.locked).toEqual({ "MİM 105": "B" });
    expect(missing).toEqual([]);
  });
});

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
      program: null,
      year: null,
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

  it("accepts every day of the week, Sunday (7) included", () => {
    const s: PlannerState = { ...EMPTY_STATE, cart: ["CS 101"], freeDays: [7, 6, 1] };
    const q = encodeState(s);
    expect(q).toBe("d=CS101&bos=167");
    expect(decodeState(q, sections).state.freeDays).toEqual([1, 6, 7]);
  });

  it("ignores malformed weights, days and page numbers", () => {
    const { state } = decodeState("d=cs101&w=99&bos=08x9&p=abc", sections);
    expect(state.cart).toEqual(["CS 101"]);
    expect(state.weights).toEqual(DEFAULT_WEIGHTS);
    expect(state.freeDays).toEqual([]);
    expect(state.selected).toBe(0);
  });
});

describe("department and year in the link", () => {
  const programs = new Map<string, number[]>([
    ["BSCS", [1, 2, 3, 4]],
    ["BSARCH (TR)", [0, 1, 2, 3, 4]],
  ]);

  it("round-trips bolum and sinif", () => {
    const s: PlannerState = { ...EMPTY_STATE, cart: ["CS 101"], program: "BSARCH (TR)", year: 0 };
    const q = encodeState(s);
    expect(new URLSearchParams(q).get("bolum")).toBe("BSARCH (TR)");
    expect(new URLSearchParams(q).get("sinif")).toBe("0");
    expect(decodeState(q, sections, programs)).toEqual({ state: s, missing: [] });
  });

  it("keeps a department without a year, and never writes a year without a department", () => {
    expect(encodeState({ ...EMPTY_STATE, program: "BSCS" })).toBe("bolum=BSCS");
    expect(encodeState({ ...EMPTY_STATE, year: 2 })).toBe("");
    expect(decodeState("bolum=BSCS", sections, programs).state).toMatchObject({ program: "BSCS", year: null });
    expect(decodeState("sinif=2", sections, programs).state).toMatchObject({ program: null, year: null });
  });

  it("ignores an unknown department and reports it, and drops a year the department does not have", () => {
    const unknown = decodeState("d=CS101&bolum=BSXX&sinif=2", sections, programs);
    expect(unknown.state).toMatchObject({ cart: ["CS 101"], program: null, year: null });
    expect(unknown.missing).toEqual(["BSXX"]);
    const badYear = decodeState("bolum=BSCS&sinif=0", sections, programs);
    expect(badYear.state).toMatchObject({ program: "BSCS", year: null });
    expect(badYear.missing).toEqual([]);
    expect(decodeState("bolum=BSCS&sinif=abc", sections, programs).state.year).toBeNull();
  });

  it("ignores bolum silently when there is no curriculum data", () => {
    const { state, missing } = decodeState("bolum=BSCS&sinif=2", sections);
    expect(state).toMatchObject({ program: null, year: null });
    expect(missing).toEqual([]);
  });
});

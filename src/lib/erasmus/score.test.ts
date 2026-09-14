import { describe, expect, it } from "vitest";
import erasmusJson from "../../../data/ozyegin/erasmus.json";
import { eleNeededFor, erasmusEligibility, erasmusScore, grantEstimate, travelBand } from "./score";
import type { ErasmusData } from "./types";

const data = erasmusJson as ErasmusData;

describe("erasmusEligibility", () => {
  it("unknown when nothing entered", () => {
    const r = erasmusEligibility(data, { gpa: null, ele: null, ects: null });
    expect(r.map((x) => x.id)).toEqual(["gpa", "ele", "ectsApplication", "ectsNomination"]);
    expect(r.every((x) => x.status === "unknown")).toBe(true);
    expect(r[0].text).toContain("2,20");
    expect(r[2].text).toContain("24 AKTS");
    expect(r[3].text).toContain("54 AKTS");
  });

  it("ok at exact thresholds", () => {
    const r = erasmusEligibility(data, { gpa: 2.2, ele: 60, ects: 54 });
    expect(r.map((x) => x.status)).toEqual(["ok", "ok", "ok", "ok"]);
  });

  it("fail below thresholds with Turkish numbers", () => {
    const r = erasmusEligibility(data, { gpa: 2.19, ele: 59, ects: 40 });
    expect(r.map((x) => x.status)).toEqual(["fail", "fail", "ok", "fail"]);
    expect(r[0].text).toContain("2,19");
    expect(r[3].text).toContain("14 AKTS eksik");
    expect(erasmusEligibility(data, { gpa: 3, ele: 80, ects: 20 })[2].status).toBe("fail");
  });

  it("NaN is treated as unknown", () => {
    expect(erasmusEligibility(data, { gpa: Number.NaN, ele: null, ects: null })[0].status).toBe("unknown");
  });
});

describe("erasmusScore", () => {
  it("50% GPA×25 + 50% ELE", () => {
    expect(erasmusScore(data, { gpa: 3, ele: 80, criteria: {} })).toEqual({ gpaPart: 37.5, elePart: 40, bonus: 0, total: 77.5 });
  });

  it("rounds to 2 decimals", () => {
    const s = erasmusScore(data, { gpa: 3.33, ele: 71, criteria: {} });
    expect(s.gpaPart).toBe(41.63); // 41,625
    expect(s.elePart).toBe(35.5);
    expect(s.total).toBe(77.13);
  });

  it("perCount criteria multiply, others are 0/1, unknown ids ignored", () => {
    const s = erasmusScore(data, { gpa: 4, ele: 100, criteria: { previous: 2, homeCountry: 3, veteran: 1, disability: 0, nope: 5 } });
    expect(s.bonus).toBe(-20 - 10 + 15);
    expect(s.total).toBe(50 + 50 - 15);
    expect(erasmusScore(data, { gpa: 4, ele: 100, criteria: { previous: -3, withdrew: 1.7 } }).bonus).toBe(-10);
  });
});

describe("eleNeededFor", () => {
  it("rounds up to an integer", () => {
    // 75 - 37,5 = 37,5 → ELE 75
    expect(eleNeededFor(data, { gpa: 3, target: 75, criteria: {} })).toEqual({ kind: "needed", ele: 75 });
    // 75,2 - 37,5 = 37,7 → 75,4 → 76
    expect(eleNeededFor(data, { gpa: 3, target: 75.2, criteria: {} })).toEqual({ kind: "needed", ele: 76 });
  });

  it("does not overshoot on float noise", () => {
    expect(eleNeededFor(data, { gpa: 2.2, target: 57.5, criteria: {} })).toEqual({ kind: "needed", ele: 60 });
  });

  it("uses criteria", () => {
    expect(eleNeededFor(data, { gpa: 3, target: 75, criteria: { veteran: 1 } })).toEqual({ kind: "needed", ele: 45 });
  });

  it("impossible above 100, guaranteed at or below 0", () => {
    expect(eleNeededFor(data, { gpa: 2.5, target: 90, criteria: {} })).toEqual({ kind: "impossible" });
    expect(eleNeededFor(data, { gpa: 4, target: 100, criteria: {} })).toEqual({ kind: "needed", ele: 100 });
    expect(eleNeededFor(data, { gpa: 4, target: 50, criteria: {} })).toEqual({ kind: "guaranteed" });
    expect(eleNeededFor(data, { gpa: 4, target: 60, criteria: { veteran: 1 } })).toEqual({ kind: "guaranteed" });
  });
});

describe("grantEstimate", () => {
  it("caps funded months and adds travel", () => {
    expect(grantEstimate(data, { group: "Grup 1-2", months: 5, km: 1800, green: false, disadvantaged: false })).toEqual({
      monthly: 600,
      fundedMonths: 4,
      travel: 309,
      total: 2709,
    });
  });

  it("disadvantaged supplement and green travel", () => {
    expect(grantEstimate(data, { group: "Grup 3", months: 3, km: 1000, green: true, disadvantaged: true })).toEqual({
      monthly: 700,
      fundedMonths: 3,
      travel: 417,
      total: 2517,
    });
  });

  it("travel null without km or outside bands", () => {
    expect(grantEstimate(data, { group: "Grup 1-2", months: 4, km: null, green: false, disadvantaged: false })).toEqual({
      monthly: 600,
      fundedMonths: 4,
      travel: null,
      total: 2400,
    });
    expect(grantEstimate(data, { group: "Grup 1-2", months: 4, km: 5, green: false, disadvantaged: false }).travel).toBeNull();
  });

  it("band edges", () => {
    expect(travelBand(data, 10)?.standard).toBe(28);
    expect(travelBand(data, 99.5)?.standard).toBe(28);
    expect(travelBand(data, 100)?.standard).toBe(211);
    expect(travelBand(data, 3999)?.green).toBe(785);
    expect(travelBand(data, 4000)?.standard).toBe(1188);
    expect(travelBand(data, 20000)?.standard).toBe(1735);
  });

  it("unknown group gives 0 monthly", () => {
    expect(grantEstimate(data, { group: "yok", months: 4, km: null, green: false, disadvantaged: false }).total).toBe(0);
  });
});

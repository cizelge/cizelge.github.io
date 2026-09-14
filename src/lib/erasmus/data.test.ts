import { describe, expect, it } from "vitest";
import erasmusJson from "../../../data/ozyegin/erasmus.json";
import type { ErasmusData } from "./types";

const data = erasmusJson as ErasmusData;
const CRITERIA_IDS = ["previous", "withdrew", "homeCountry", "eleAbsent", "orientationAbsent", "disability", "veteran", "disaster", "socialProtection"];

describe("data/ozyegin/erasmus.json", () => {
  it("has the top-level shape", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(Number.isNaN(Date.parse(data.fetchedAt))).toBe(false);
    expect(data.callYear).toMatch(/^20\d\d-\d\d$/);
    expect(data.sources.length).toBeGreaterThan(0);
    for (const s of data.sources) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^https:\/\/www\.ozyegin\.edu\.tr\//);
    }
  });

  it("eligibility and score values from the page", () => {
    expect(data.eligibility).toEqual({ minGpa: 2.2, minEle: 60, minEctsAtApplication: 24, minEctsAtNomination: 54 });
    expect(data.score.gpaWeight + data.score.eleWeight).toBe(1);
    expect(data.score.gpaWeight).toBe(0.5);
    expect(data.score.gpaTo100.factor).toBe(25);
    expect(data.score.gpaTo100.assumption.length).toBeGreaterThan(20);
    expect(data.score.ranking.length).toBeGreaterThan(0);
    expect(data.durationMonths).toEqual({ min: 2, max: 12 });
  });

  it("criteria", () => {
    expect(data.criteria.map((c) => c.id)).toEqual(CRITERIA_IDS);
    const points = Object.fromEntries(data.criteria.map((c) => [c.id, c.points]));
    expect(points).toEqual({
      previous: -10,
      withdrew: -10,
      homeCountry: -10,
      eleAbsent: -5,
      orientationAbsent: -5,
      disability: 10,
      veteran: 15,
      disaster: 10,
      socialProtection: 10,
    });
    for (const c of data.criteria) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(typeof c.perCount).toBe("boolean");
    }
    expect(data.criteria.filter((c) => c.perCount).map((c) => c.id)).toEqual(["previous", "withdrew"]);
  });

  it("grant tables", () => {
    expect(data.grant.monthly.map((m) => m.euro)).toEqual([600, 450]);
    expect(new Set(data.grant.monthly.map((m) => m.group)).size).toBe(data.grant.monthly.length);
    for (const m of data.grant.monthly) expect(m.countries.length).toBeGreaterThan(0);
    expect(data.grant.maxFundedMonths).toBe(4);
    expect(data.grant.disadvantagedMonthly).toBe(250);
  });

  it("travel bands are contiguous and ordered", () => {
    const t = data.grant.travel;
    expect(t.map((b) => [b.standard, b.green])).toEqual([
      [28, 56],
      [211, 285],
      [309, 417],
      [395, 535],
      [580, 785],
      [1188, 1188],
      [1735, 1735],
    ]);
    expect(t[0].minKm).toBe(10);
    for (let i = 0; i < t.length; i++) {
      const b = t[i];
      expect(b.green).toBeGreaterThanOrEqual(b.standard);
      if (i < t.length - 1) {
        expect(b.maxKm).not.toBeNull();
        expect(t[i + 1].minKm).toBe((b.maxKm as number) + 1);
      } else {
        expect(b.maxKm).toBeNull();
      }
    }
  });
});

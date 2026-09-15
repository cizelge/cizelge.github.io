import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTime } from "@/lib/engine/timemask";
import type { ShuttleData } from "./types";

const file = path.join(process.cwd(), "data", "ozyegin", "shuttle.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as ShuttleData;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

describe("data/ozyegin/shuttle.json", () => {
  it("has the top-level fields", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(Number.isNaN(Date.parse(data.fetchedAt))).toBe(false);
    if (data.validFrom) expect(data.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.sources.length).toBeGreaterThan(0);
    for (const s of data.sources) expect(s.url).toMatch(/^https:\/\//);
    expect(data.routes.length).toBeGreaterThan(0);
  });

  it("uses unique route ids that point to known campuses", () => {
    const campuses = new Set(data.campuses.map((c) => c.id));
    const ids = data.routes.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of data.routes) {
      expect(campuses.has(r.campusId)).toBe(true);
      expect(r.name.trim()).not.toBe("");
      expect(r.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("has valid, sorted times and no day listed twice per route", () => {
    for (const r of data.routes) {
      const seen = new Set<number>();
      expect(r.services.length).toBeGreaterThan(0);
      for (const s of r.services) {
        expect(s.days.length).toBeGreaterThan(0);
        for (const d of s.days) {
          expect(d >= 1 && d <= 7).toBe(true);
          expect(seen.has(d)).toBe(false);
          seen.add(d);
        }
        for (const list of [s.toCampus, s.fromCampus]) {
          for (const t of list) {
            expect(t.departure).toMatch(HHMM);
            expect(t.stop.trim()).not.toBe("");
            if (t.arrival !== undefined) {
              expect(t.arrival).toMatch(HHMM);
              expect(parseTime(t.arrival)).toBeGreaterThan(parseTime(t.departure));
            }
          }
          const mins = list.map((t) => parseTime(t.departure));
          expect(mins).toEqual([...mins].sort((a, b) => a - b));
        }
      }
      if (r.travelMinutes !== undefined) expect(r.travelMinutes).toBeGreaterThan(0);
    }
  });

  it("matches the published schedule valid from 29 August 2026", () => {
    const metro = data.routes.find((r) => r.id === "cekmekoy-metro")!;
    const weekday = metro.services.find((s) => s.days.includes(1))!;
    expect(weekday.toCampus.map((t) => t.departure)).toEqual([
      "07:50", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00",
    ]);
    expect(weekday.fromCampus.map((t) => t.departure)).toEqual([
      "09:00", "11:00", "13:00", "15:00", "16:50", "19:00", "21:00", "22:40",
    ]);
    const tasdelen = data.routes.find((r) => r.id === "tasdelen")!;
    expect(tasdelen.services).toHaveLength(1);
    expect(tasdelen.services[0].toCampus.map((t) => t.departure)).toEqual(["08:10"]);
    expect(tasdelen.services[0].fromCampus).toEqual([]);
  });

  it("does not invent arrival times or travel durations", () => {
    for (const r of data.routes) {
      expect(r.travelMinutes).toBeUndefined();
      for (const s of r.services) for (const t of s.toCampus) expect(t.arrival).toBeUndefined();
    }
  });
});

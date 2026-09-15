import { describe, expect, it } from "vitest";
import calendarJson from "../../../data/ozyegin/academic-calendar.json";
import { OZYEGIN_CALENDAR } from "@/lib/calendar";
import { CATEGORIES, type AcademicCalendarData } from "./types";

const data = calendarJson as AcademicCalendarData;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (d: string) => ISO.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d;
const find = (title: string) => data.events.find((e) => e.title === title);

describe("data/ozyegin/academic-calendar.json", () => {
  it("has the top-level shape", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(data.academicYear).toBe("2026-2027");
    expect(Number.isNaN(Date.parse(data.fetchedAt))).toBe(false);
    expect(data.sources.length).toBeGreaterThan(0);
    for (const s of data.sources) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^https:\/\/www\.ozyegin\.edu\.tr\//);
    }
    expect(data.events.length).toBeGreaterThan(30);
  });

  it("every event is well-formed", () => {
    const allowed = new Set(Object.keys({ id: 1, title: 1, start: 1, end: 1, time: 1, category: 1, term: 1, note: 1, source: 1 }));
    for (const e of data.events) {
      for (const k of Object.keys(e)) expect(allowed.has(k), `${e.id}: ${k}`).toBe(true);
      expect(e.id).toMatch(/^[a-z0-9-]+$/);
      expect(e.title.trim().length).toBeGreaterThan(0);
      expect(validDate(e.start), e.id).toBe(true);
      if (e.end !== null) {
        expect(validDate(e.end), e.id).toBe(true);
        expect(e.end > e.start, e.id).toBe(true);
      }
      if (e.time !== undefined) expect(e.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(CATEGORIES).toContain(e.category);
      expect([null, "guz", "bahar", "yaz"]).toContain(e.term);
      if (e.note !== undefined) expect(e.note.trim().length).toBeGreaterThan(0);
      expect(Number.isInteger(e.source)).toBe(true);
      expect(data.sources[e.source], e.id).toBeDefined();
    }
  });

  it("ids are unique and events are sorted", () => {
    const ids = data.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = data.events.map((e) => `${e.start}|${e.end ?? e.start}|${e.id}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("stays within the academic year", () => {
    for (const e of data.events) {
      expect(e.start >= "2026-07-01", e.id).toBe(true);
      expect((e.end ?? e.start) <= "2027-09-30", e.id).toBe(true);
    }
  });

  it("agrees with the term calendar used for .ics course schedules", () => {
    for (const [termId, term] of [["2026-2027-guz", "Güz"], ["2026-2027-bahar", "Bahar"], ["2026-2027-yaz", "Yaz"]] as const) {
      const cal = OZYEGIN_CALENDAR[termId];
      expect(find(`${term} dersleri başlıyor`)?.start).toBe(cal.start);
      expect(find(`${term} dersleri bitiyor`)?.start).toBe(cal.end);
      const makeups = data.events.filter((e) => e.title.startsWith("Telafi günü") && e.start >= cal.start && e.start <= cal.end);
      expect(makeups.map((e) => e.start)).toEqual(cal.makeups.map((m) => m.date));
    }
  });

  it("key dates from the Lisans column and the minor page", () => {
    const apply = find("Yatay geçiş, çift anadal ve yandal başvuruları");
    expect([apply?.start, apply?.end, apply?.time]).toEqual(["2026-08-03", "2026-08-14", "10:00"]);
    const results = find("Yatay geçiş, çift anadal ve yandal sonuçları");
    expect([results?.start, results?.time]).toEqual(["2026-09-02", "19:00"]);
    expect(find("Güz dönem sonu sınavları")).toMatchObject({ start: "2026-12-26", end: "2027-01-06", category: "sinav" });
    expect(find("Bahar dönem sonu sınavları")).toMatchObject({ start: "2027-05-02", end: "2027-05-11" });
    expect(find("Güz dersten çekilme")).toMatchObject({ start: "2026-11-23", end: "2026-11-27" });
    expect(find("Bahar ders ekleme-bırakma")).toMatchObject({ start: "2027-01-22", end: "2027-01-28" });
  });
});

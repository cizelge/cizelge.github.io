import { describe, expect, it } from "vitest";
import type { TermCalendar } from "../calendar";
import { classDay, formatIn, istanbulNow, parseSaved, pickSchedule, todayView, type SavedSchedule } from "./today";

const cal: TermCalendar = {
  start: "2026-09-21",
  end: "2026-12-25",
  noClass: ["2026-10-28", "2026-10-29"],
  makeups: [{ date: "2026-11-07", replaces: "2026-10-28" }],
  source: "",
};

const m = (code: string, day: number, start: string, end: string) => ({
  code,
  title: `${code} adı`,
  section: "A",
  day,
  start,
  end,
  room: "AB1 245",
  instructor: null,
});

const schedule: SavedSchedule = {
  v: 1,
  schoolId: "ozyegin",
  termId: "2026-2027-guz",
  termLabel: "2026 - 2027 Güz",
  savedAt: "2026-09-15T10:00:00Z",
  meetings: [m("MATH 211", 1, "13:40", "15:30"), m("CS 201", 1, "08:40", "10:30"), m("EE 203", 3, "10:40", "12:30")],
};

describe("classDay", () => {
  it("dönem öncesi, sonrası, tatil ve telafi", () => {
    expect(classDay("2026-09-16", cal)).toEqual({ kind: "beforeTerm", start: "2026-09-21" });
    expect(classDay("2026-12-26", cal)).toEqual({ kind: "afterTerm" });
    expect(classDay("2026-10-28", cal)).toEqual({ kind: "holiday" });
    // 7 Kasım Cumartesi, 28 Ekim Çarşamba'nın dersleri.
    expect(classDay("2026-11-07", cal)).toEqual({ kind: "class", weekday: 3, makeupFor: "2026-10-28" });
    expect(classDay("2026-09-21", cal)).toEqual({ kind: "class", weekday: 1, makeupFor: null });
    expect(classDay("2026-09-16", undefined)).toEqual({ kind: "class", weekday: 3, makeupFor: null });
  });
});

describe("todayView", () => {
  it("süren ve sıradaki ders", () => {
    const v = todayView(schedule, "2026-09-21", 9 * 60, cal);
    expect(v.classes.map((c) => c.code)).toEqual(["CS 201", "MATH 211"]);
    expect(v.current?.code).toBe("CS 201");
    expect(v.next).toEqual({ meeting: schedule.meetings[0], inMinutes: 280 });
    expect(v.nextDay).toBeNull();
  });

  it("ders bitince bir sonraki ders günü", () => {
    const v = todayView(schedule, "2026-09-21", 16 * 60, cal);
    expect(v.current).toBeNull();
    expect(v.next).toBeNull();
    expect(v.nextDay?.date).toBe("2026-09-23");
    expect(v.nextDay?.classes.map((c) => c.code)).toEqual(["EE 203"]);
  });

  it("dönem başlamadan ilk ders günü, tatili atlar, telafi gününü bulur", () => {
    expect(todayView(schedule, "2026-09-16", 600, cal).nextDay?.date).toBe("2026-09-21");
    // 27 Ekim akşamı: 28 Çarşamba tatil, sonraki ders 2 Kasım Pazartesi.
    expect(todayView(schedule, "2026-10-27", 1200, cal).nextDay?.date).toBe("2026-11-02");
    const sat = todayView(schedule, "2026-11-07", 600, cal);
    expect(sat.day).toMatchObject({ kind: "class", weekday: 3 });
    expect(sat.next?.meeting.code).toBe("EE 203");
  });
});

describe("pickSchedule", () => {
  const bahar = { ...schedule, termId: "2026-2027-bahar", savedAt: "2026-09-16T10:00:00Z" };
  const cals = { "2026-2027-guz": cal, "2026-2027-bahar": { ...cal, start: "2027-01-20", end: "2027-04-30" } };
  it("süren dönemi seçer, bitince sonrakini", () => {
    expect(pickSchedule([bahar, schedule], cals, "2026-10-01")?.termId).toBe("2026-2027-guz");
    expect(pickSchedule([bahar, schedule], cals, "2027-01-02")?.termId).toBe("2026-2027-bahar");
    expect(pickSchedule([], cals, "2027-01-02")).toBeNull();
  });
});

describe("yardımcılar", () => {
  it("parseSaved bozuk kaydı reddeder", () => {
    expect(parseSaved(JSON.stringify(schedule))?.meetings).toHaveLength(3);
    expect(parseSaved("{")).toBeNull();
    expect(parseSaved(JSON.stringify({ v: 2 }))).toBeNull();
  });
  it("formatIn", () => {
    expect(formatIn(45)).toBe("45 dk");
    expect(formatIn(65)).toBe("1 sa 5 dk");
    expect(formatIn(120)).toBe("2 sa");
  });
  it("istanbulNow UTC+3", () => {
    expect(istanbulNow(new Date("2026-09-20T22:30:00Z"))).toEqual({ date: "2026-09-21", minutes: 90 });
  });
});

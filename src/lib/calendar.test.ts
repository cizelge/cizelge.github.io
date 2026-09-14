import { describe, expect, it } from "vitest";
import { isoWeekday, meetingDates, OZYEGIN_CALENDAR } from "./calendar";

const guz = OZYEGIN_CALENDAR["2026-2027-guz"];
const bahar = OZYEGIN_CALENDAR["2026-2027-bahar"];

describe("OZYEGIN_CALENDAR", () => {
  it("has makeup days on Saturdays and no-class days inside the term", () => {
    for (const cal of Object.values(OZYEGIN_CALENDAR)) {
      expect(cal.start < cal.end).toBe(true);
      for (const m of cal.makeups) expect(isoWeekday(m.date)).toBe(6);
      for (const d of cal.noClass) expect(d >= cal.start && d <= cal.end).toBe(true);
    }
  });
});

describe("meetingDates", () => {
  it("starts on the first matching weekday and skips holidays", () => {
    // Çarşamba dersi: 23 Eylül'den başlar, 28 Ekim yapılmaz, 7 Kasım Cumartesi telafi edilir.
    expect(meetingDates(3, guz)).toEqual({ first: "2026-09-23", skipped: ["2026-10-28"], extra: ["2026-11-07"] });
  });

  it("handles a term starting mid-week", () => {
    // Bahar Çarşamba başlıyor; Pazartesi dersleri 25 Ocak'ta başlar.
    expect(meetingDates(1, bahar)).toEqual({ first: "2027-01-25", skipped: ["2027-03-08"], extra: ["2027-03-20"] });
    expect(meetingDates(3, bahar).first).toBe("2027-01-20");
  });

  it("includes the last day of the term", () => {
    expect(meetingDates(5, guz).skipped).toEqual(["2026-10-30"]);
    expect(meetingDates(5, guz).extra).toEqual(["2026-12-05"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  daysUntil,
  escapeText,
  eventsIcs,
  eventStatus,
  foldLine,
  formatLongDate,
  formatRange,
  groupByMonth,
  relativeLabel,
  upcoming,
} from "./calendar";
import type { CalendarEvent } from "./types";

const ev = (id: string, start: string, end: string | null = null, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: id,
  start,
  end,
  category: "diger",
  term: null,
  source: 0,
  ...extra,
});

const EVENTS = [
  ev("b", "2026-09-21"),
  ev("a", "2026-09-14", "2026-09-16"),
  ev("c", "2026-10-28", "2026-10-29"),
  ev("d", "2026-12-26", "2027-01-06"),
  ev("e", "2026-09-10"),
];

describe("upcoming", () => {
  it("skips past events, keeps ongoing ones, sorts and limits", () => {
    expect(upcoming(EVENTS, "2026-09-15", 3).map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(upcoming(EVENTS, "2026-09-16", 10).map((e) => e.id)).toEqual(["a", "b", "c", "d"]);
    expect(upcoming(EVENTS, "2026-09-17", 10).map((e) => e.id)).toEqual(["b", "c", "d"]);
    expect(upcoming(EVENTS, "2027-02-01", 3)).toEqual([]);
  });

  it("does not mutate the input", () => {
    const copy = [...EVENTS];
    upcoming(EVENTS, "2026-01-01", 5);
    expect(EVENTS).toEqual(copy);
  });
});

describe("groupByMonth", () => {
  it("groups by start month with Turkish labels", () => {
    const groups = groupByMonth(EVENTS);
    expect(groups.map((g) => [g.key, g.label, g.events.map((e) => e.id)])).toEqual([
      ["2026-09", "Eylül 2026", ["e", "a", "b"]],
      ["2026-10", "Ekim 2026", ["c"]],
      ["2026-12", "Aralık 2026", ["d"]],
    ]);
  });

  it("labels every month", () => {
    const labels = groupByMonth(Array.from({ length: 12 }, (_, i) => ev(`m${i}`, `2027-${String(i + 1).padStart(2, "0")}-01`))).map(
      (g) => g.label,
    );
    expect(labels).toEqual([
      "Ocak 2027", "Şubat 2027", "Mart 2027", "Nisan 2027", "Mayıs 2027", "Haziran 2027",
      "Temmuz 2027", "Ağustos 2027", "Eylül 2027", "Ekim 2027", "Kasım 2027", "Aralık 2027",
    ]);
  });
});

describe("daysUntil and status", () => {
  it("counts calendar days, across months and years", () => {
    expect(daysUntil("2026-09-15", ev("x", "2026-09-18"))).toBe(3);
    expect(daysUntil("2026-12-30", ev("x", "2027-01-02"))).toBe(3);
    expect(daysUntil("2026-09-15", ev("x", "2026-09-15"))).toBe(0);
    expect(daysUntil("2026-09-15", ev("x", "2026-09-14", "2026-09-16"))).toBe(-1);
    // Yaz saati değişimi (25 Ekim) sonucu kaydırmaz.
    expect(daysUntil("2026-10-24", ev("x", "2026-10-26"))).toBe(2);
  });

  it("labels relative to today", () => {
    expect(relativeLabel("2026-09-15", ev("x", "2026-09-18"))).toBe("3 gün kaldı");
    expect(relativeLabel("2026-09-15", ev("x", "2026-09-16"))).toBe("yarın");
    expect(relativeLabel("2026-09-15", ev("x", "2026-09-15"))).toBe("bugün");
    expect(relativeLabel("2026-09-15", ev("x", "2026-09-15", "2026-09-20"))).toBe("bugün");
    expect(relativeLabel("2026-09-15", ev("x", "2026-09-14", "2026-09-16"))).toBe("sürüyor");
    expect(relativeLabel("2026-09-16", ev("x", "2026-09-14", "2026-09-16"))).toBe("sürüyor");
    expect(eventStatus("2026-09-17", ev("x", "2026-09-14", "2026-09-16"))).toBe("past");
  });
});

describe("formatRange", () => {
  it("single day with weekday", () => {
    expect(formatRange("2026-09-21", null)).toBe("21 Eyl Pzt");
    expect(formatRange("2027-01-01", "2027-01-01")).toBe("1 Oca Cum");
    expect(formatRange("2026-11-07", null)).toBe("7 Kas Cmt");
    expect(formatRange("2027-08-29", null)).toBe("29 Ağu Paz");
  });

  it("long date", () => {
    expect(formatLongDate("2026-09-15")).toBe("15 Eylül 2026");
    expect(formatLongDate("2027-02-01T10:00:00Z")).toBe("1 Şubat 2027");
  });

  it("ranges within and across months", () => {
    expect(formatRange("2026-10-28", "2026-10-30")).toBe("28–30 Eki");
    expect(formatRange("2026-12-29", "2027-01-02")).toBe("29 Ara – 2 Oca");
    expect(formatRange("2027-03-29", "2027-04-02")).toBe("29 Mar – 2 Nis");
  });
});

describe("eventsIcs", () => {
  const events: CalendarEvent[] = [
    ev("2026-09-14-guz-ders-kayitlari", "2026-09-14", "2026-09-16", { title: "Güz ders kayıtları", category: "kayit" }),
    ev("2026-10-28-cumhuriyet", "2026-10-28", "2026-10-29", {
      title: "Cumhuriyet Bayramı; tatil, ders yok",
      category: "tatil",
      note: "Telafi: 7 Kasım\\21 Kasım",
    }),
    ev("2026-09-02-sonuc", "2026-09-02", null, { title: "Sonuçlar", category: "basvuru", time: "19:00" }),
    ev("2026-12-26-final", "2026-12-26", "2027-01-06", { title: "Dönem sonu sınavları", category: "sinav" }),
  ];
  const ics = eventsIcs(events, { calName: "Özyeğin, akademik takvim", now: new Date("2026-09-15T08:30:00.000Z") });

  it("uses CRLF everywhere and wraps a calendar", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(ics).toContain("X-WR-CALNAME:Özyeğin\\, akademik takvim\r\n");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  });

  it("all-day dates with exclusive end", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20260914\r\nDTEND;VALUE=DATE:20260917\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260902\r\nDTEND;VALUE=DATE:20260903\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261226\r\nDTEND;VALUE=DATE:20270107\r\n");
    expect(ics).toContain("DTSTAMP:20260915T083000Z\r\n");
  });

  it("stable UIDs from ids", () => {
    expect(ics).toContain("UID:2026-09-14-guz-ders-kayitlari@ozuhelper\r\n");
    const again = eventsIcs(events, { calName: "x", now: new Date("2027-01-01T00:00:00Z") });
    expect(again.match(/UID:[^\r]+/g)).toEqual(ics.match(/UID:[^\r]+/g));
  });

  it("escapes text and puts time and note into the description", () => {
    expect(ics).toContain("SUMMARY:Cumhuriyet Bayramı\\; tatil\\, ders yok\r\n");
    expect(ics).toContain("DESCRIPTION:Telafi: 7 Kasım\\\\21 Kasım\r\n");
    expect(ics).toContain("DESCRIPTION:Saat 19:00\r\n");
  });

  it("adds a one-day alarm only to registration, application and exam events", () => {
    const blocks = ics.split("BEGIN:VEVENT").slice(1);
    const withAlarm = blocks.map((b) => b.includes("TRIGGER:-P1D"));
    expect(withAlarm).toEqual([true, false, true, true]);
    expect(blocks[0]).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\n");
  });

  it("escapes a newline as \\n", () => {
    expect(escapeText("a\nb")).toBe("a\\nb");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const long = `SUMMARY:${"ğ".repeat(80)}`;
    const folded = foldLine(long);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    const enc = new TextEncoder();
    for (const l of lines) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
    expect(lines.map((l, i) => (i === 0 ? l : l.slice(1))).join("")).toBe(long);
    expect(foldLine("SHORT:x")).toBe("SHORT:x");
  });
});

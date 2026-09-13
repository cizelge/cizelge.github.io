import { describe, expect, it } from "vitest";
import type { Meeting } from "../types";
import {
  SLOTS_PER_DAY,
  addInterval,
  emptyMask,
  firstOverlapSlot,
  formatTime,
  masksOverlap,
  maskFromMeetings,
  orInto,
  parseTime,
  xorInto,
} from "./timemask";

const m = (day: Meeting["day"], start: string, end: string): Meeting => ({
  day,
  start,
  end,
  room: null,
});

describe("parseTime / formatTime", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(parseTime("00:00")).toBe(0);
    expect(parseTime("09:40")).toBe(580);
    expect(parseTime("17:40")).toBe(1060);
    expect(parseTime("9:05")).toBe(545);
    expect(parseTime("24:00")).toBe(1440);
  });

  it("rejects malformed or out-of-range times", () => {
    expect(() => parseTime("")).toThrow();
    expect(() => parseTime("10")).toThrow();
    expect(() => parseTime("10:60")).toThrow();
    expect(() => parseTime("25:00")).toThrow();
    expect(() => parseTime("24:01")).toThrow();
    expect(() => parseTime("ab:cd")).toThrow();
  });

  it("formats minutes back to zero-padded HH:MM", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(580)).toBe("09:40");
    expect(formatTime(1439)).toBe("23:59");
  });
});

describe("week masks", () => {
  it("has 288 five-minute slots per day", () => {
    expect(SLOTS_PER_DAY).toBe(288);
  });

  it("detects overlap on the same day", () => {
    const a = maskFromMeetings([m(2, "12:40", "14:30")]);
    const b = maskFromMeetings([m(2, "14:00", "15:30")]);
    expect(masksOverlap(a, b)).toBe(true);
  });

  it("treats back-to-back meetings as non-overlapping", () => {
    const a = maskFromMeetings([m(1, "10:40", "12:30")]);
    const b = maskFromMeetings([m(1, "12:30", "14:00")]);
    expect(masksOverlap(a, b)).toBe(false);
  });

  it("does not confuse different days", () => {
    const a = maskFromMeetings([m(1, "10:40", "12:30")]);
    const b = maskFromMeetings([m(3, "10:40", "12:30")]);
    expect(masksOverlap(a, b)).toBe(false);
  });

  it("handles slots at word boundaries and the end of the day", () => {
    // slot 31 and 32 straddle the first Uint32 word boundary (02:35-02:45)
    const a = maskFromMeetings([m(6, "02:35", "02:40")]);
    const b = maskFromMeetings([m(6, "02:40", "02:45")]);
    expect(masksOverlap(a, b)).toBe(false);
    const late1 = maskFromMeetings([m(6, "23:00", "24:00")]);
    const late2 = maskFromMeetings([m(6, "23:55", "24:00")]);
    expect(masksOverlap(late1, late2)).toBe(true);
    expect(masksOverlap(a, late1)).toBe(false);
  });

  it("an empty mask never overlaps", () => {
    const a = maskFromMeetings([m(1, "08:40", "20:00")]);
    expect(masksOverlap(a, emptyMask())).toBe(false);
    expect(masksOverlap(maskFromMeetings([]), a)).toBe(false);
  });

  it("OR accumulates and XOR removes a disjoint mask again", () => {
    const acc = emptyMask();
    const a = maskFromMeetings([m(1, "08:40", "10:30")]);
    const b = maskFromMeetings([m(1, "10:40", "12:30"), m(4, "13:40", "15:30")]);
    orInto(acc, a);
    orInto(acc, b);
    expect(masksOverlap(acc, a)).toBe(true);
    expect(masksOverlap(acc, b)).toBe(true);
    xorInto(acc, b);
    expect(masksOverlap(acc, b)).toBe(false);
    expect(masksOverlap(acc, a)).toBe(true);
  });

  it("rounds partial slots outward so sub-slot overlaps are never missed", () => {
    const mask = emptyMask();
    addInterval(mask, 1, 602, 603); // 10:02-10:03 -> slot 120
    const other = maskFromMeetings([m(1, "10:00", "10:05")]);
    expect(masksOverlap(mask, other)).toBe(true);
  });

  it("reports the first overlapping slot as day + minute", () => {
    const a = maskFromMeetings([m(2, "12:40", "14:30"), m(4, "09:00", "10:00")]);
    const b = maskFromMeetings([m(4, "09:30", "11:00"), m(2, "13:00", "13:30")]);
    expect(firstOverlapSlot(a, b)).toEqual({ day: 2, minute: 780 });
    expect(firstOverlapSlot(a, emptyMask())).toBeNull();
  });
});

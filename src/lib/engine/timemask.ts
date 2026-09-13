import type { Meeting } from "../types";

/**
 * Week time masks.
 *
 * A day is split into 288 five-minute slots. Each of the 7 days (Monday = 1 …
 * Sunday = 7) owns 9 Uint32 words (288 bits), so a whole week is one 63-word
 * Uint32Array. Two schedules overlap iff some word pair ANDs to non-zero.
 *
 * Why Uint32Array instead of one BigInt per day: the backtracking loop does an
 * AND-check, an OR (place) and an XOR (undo) per step. Typed-array word ops
 * allocate nothing, whereas every BigInt operation allocates a new BigInt.
 *
 * Times that are not on a 5-minute boundary are rounded outward
 * (start down, end up), so a real overlap is never missed; two meetings that
 * merely share a partial slot are treated as conflicting.
 */

export type Day = Meeting["day"];

export const SLOT_MINUTES = 5;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES; // 288
export const DAYS = 7;
export const WORDS_PER_DAY = Math.ceil(SLOTS_PER_DAY / 32); // 9
export const MASK_WORDS = DAYS * WORDS_PER_DAY; // 63

export type WeekMask = Uint32Array;

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** "10:40" -> 640 (minutes since midnight). Accepts 00:00..24:00. */
export function parseTime(value: string): number {
  const match = TIME_RE.exec(value);
  if (!match) throw new Error(`Invalid time: "${value}"`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59 || hours > 24 || (hours === 24 && minutes !== 0)) {
    throw new Error(`Invalid time: "${value}"`);
  }
  return hours * 60 + minutes;
}

/** 640 -> "10:40" */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function emptyMask(): WeekMask {
  return new Uint32Array(MASK_WORDS);
}

/** Marks [startMin, endMin) on `day` (1..7). Empty or inverted ranges are ignored. */
export function addInterval(mask: WeekMask, day: Day, startMin: number, endMin: number): void {
  const first = Math.max(0, Math.floor(startMin / SLOT_MINUTES));
  const last = Math.min(SLOTS_PER_DAY, Math.ceil(endMin / SLOT_MINUTES)); // exclusive
  const base = (day - 1) * WORDS_PER_DAY;
  for (let slot = first; slot < last; slot++) {
    mask[base + (slot >>> 5)] |= 1 << (slot & 31);
  }
}

export function maskFromMeetings(meetings: readonly Meeting[]): WeekMask {
  const mask = emptyMask();
  for (const meeting of meetings) {
    addInterval(mask, meeting.day, parseTime(meeting.start), parseTime(meeting.end));
  }
  return mask;
}

export function masksOverlap(a: WeekMask, b: WeekMask): boolean {
  for (let i = 0; i < MASK_WORDS; i++) {
    if ((a[i] & b[i]) !== 0) return true;
  }
  return false;
}

/** Indices of the non-zero words of a mask; lets hot loops skip empty words. */
export function nonZeroWords(mask: WeekMask): Int32Array {
  const indices: number[] = [];
  for (let i = 0; i < MASK_WORDS; i++) if (mask[i] !== 0) indices.push(i);
  return Int32Array.from(indices);
}

export function orInto(target: WeekMask, source: WeekMask): void {
  for (let i = 0; i < MASK_WORDS; i++) target[i] |= source[i];
}

/** Undoes a previous `orInto` of a mask that was disjoint from `target`. */
export function xorInto(target: WeekMask, source: WeekMask): void {
  for (let i = 0; i < MASK_WORDS; i++) target[i] ^= source[i];
}

/** First (earliest day, earliest slot) overlapping slot, as day + minute of slot start. */
export function firstOverlapSlot(a: WeekMask, b: WeekMask): { day: Day; minute: number } | null {
  for (let i = 0; i < MASK_WORDS; i++) {
    const both = (a[i] & b[i]) >>> 0;
    if (both !== 0) {
      const bit = 31 - Math.clz32(both & -both);
      const day = (Math.floor(i / WORDS_PER_DAY) + 1) as Day;
      const slot = (i % WORDS_PER_DAY) * 32 + bit;
      return { day, minute: slot * SLOT_MINUTES };
    }
  }
  return null;
}

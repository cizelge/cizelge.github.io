// Ortak boş saat: iki ya da daha çok programın dolu saatlerini birleştirip herkesin boş olduğu aralıkları bulur.
// Paylaşılan kodda ders adı yoktur, yalnızca "şu saat dolu" bilgisi vardır.
import type { Day } from "../engine";

/** Slot çözünürlüğü (dakika). Özyeğin saatleri :40'ta başladığı için 10 dakika gerekir. */
export const SLOT = 10;
/** Günün kapsanan aralığı. */
export const DAY_START = 8 * 60;
export const DAY_END = 22 * 60;
export const SLOTS_PER_DAY = (DAY_END - DAY_START) / SLOT;
/** Pazartesiden pazara. */
export const DAYS: readonly Day[] = [1, 2, 3, 4, 5, 6, 7];
const TOTAL_SLOTS = SLOTS_PER_DAY * DAYS.length;
const BYTES = Math.ceil(TOTAL_SLOTS / 8);

export interface Busy {
  day: Day;
  start: string;
  end: string;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const toTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

const slotIndex = (day: Day, minutes: number) => (day - 1) * SLOTS_PER_DAY + Math.floor((minutes - DAY_START) / SLOT);

/** Dolu saatlerden bit haritası. Aralığın dışına taşan kısımlar kırpılır. */
export function busyMask(meetings: readonly Busy[]): Uint8Array {
  const mask = new Uint8Array(BYTES);
  for (const m of meetings) {
    if (!DAYS.includes(m.day)) continue;
    const start = Math.max(DAY_START, toMinutes(m.start));
    const end = Math.min(DAY_END, toMinutes(m.end));
    if (!(end > start)) continue;
    const first = slotIndex(m.day, start);
    // Bitişi kapsayan son slot: 10:30'da biten ders 10:20-10:30 slotunu doldurur.
    const last = slotIndex(m.day, end - 1);
    for (let i = first; i <= last; i++) mask[i >> 3] |= 1 << (i & 7);
  }
  return mask;
}

/** Birden çok kişinin dolu saatlerini birleştirir (biri doluysa ortak boş değildir). */
export function combine(masks: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(BYTES);
  for (const mask of masks) {
    for (let i = 0; i < BYTES; i++) out[i] |= mask[i] ?? 0;
  }
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Adres çubuğuna sığan kısa kod. */
export function encodeMask(mask: Uint8Array): string {
  let out = "";
  for (let i = 0; i < BYTES; i += 3) {
    const n = ((mask[i] ?? 0) << 16) | ((mask[i + 1] ?? 0) << 8) | (mask[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  return out.replace(/A+$/, "") || "A";
}

export function decodeMask(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(text)) return null;
  const padded = text + "A".repeat((4 - (text.length % 4)) % 4);
  const mask = new Uint8Array(BYTES);
  let byte = 0;
  for (let i = 0; i < padded.length; i += 4) {
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const v = B64.indexOf(padded[i + k]);
      if (v < 0) return null;
      n = (n << 6) | v;
    }
    for (const shift of [16, 8, 0]) {
      if (byte < BYTES) mask[byte++] = (n >> shift) & 255;
    }
  }
  return mask;
}

/** Verilen oturum, bit haritasındaki dolu saatlerle çakışıyor mu. */
export function overlapsBusy(mask: Uint8Array, m: Busy): boolean {
  if (!DAYS.includes(m.day)) return false;
  const start = Math.max(DAY_START, toMinutes(m.start));
  const end = Math.min(DAY_END, toMinutes(m.end));
  for (let minutes = start; minutes < end; minutes += SLOT) {
    const i = slotIndex(m.day, minutes);
    if (((mask[i >> 3] ?? 0) >> (i & 7)) & 1) return true;
  }
  return false;
}

export interface FreeBlock {
  day: Day;
  start: string;
  end: string;
  /** Aralığın uzunluğu (dakika). */
  minutes: number;
}

const isBusy = (mask: Uint8Array, i: number) => ((mask[i >> 3] ?? 0) >> (i & 7)) & 1;

/**
 * Herkesin boş olduğu aralıklar. `min` dakikadan kısa aralıklar atılır
 * (10 dakikalık boşluk buluşmaya yaramaz).
 */
export function freeBlocks(
  mask: Uint8Array,
  { min = 60, from = "08:40", to = "20:30", days = [1, 2, 3, 4, 5] as readonly Day[] } = {},
): FreeBlock[] {
  const out: FreeBlock[] = [];
  const fromMin = Math.max(DAY_START, toMinutes(from));
  const toMin = Math.min(DAY_END, toMinutes(to));
  for (const day of days) {
    let runStart: number | null = null;
    for (let minutes = fromMin; minutes <= toMin; minutes += SLOT) {
      const inside = minutes < toMin;
      const busy = inside ? isBusy(mask, slotIndex(day, minutes)) : 1;
      if (!busy && runStart === null) runStart = minutes;
      if (busy && runStart !== null) {
        const length = minutes - runStart;
        if (length >= min) out.push({ day, start: toTime(runStart), end: toTime(minutes), minutes: length });
        runStart = null;
      }
    }
  }
  return out;
}

/** "1 sa 50 dk" biçiminde süre. */
export function spanLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} sa`;
  return `${h} sa ${m} dk`;
}

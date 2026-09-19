// Sitenin üstündeki geri sayım bandı: hangi tarih gösterilsin, ne yazsın.
// Saf mantık; "bugün" dışarıdan verilir (İstanbul saati).
import { daysUntil, formatRange, lastDay } from "./calendar";
import type { CalendarEvent } from "./types";

/** Bandın ilgilendiği işler: kayıt, ekleme-bırakma, dersten çekilme. */
export function isDeadline(event: CalendarEvent): boolean {
  const title = event.title.toLocaleLowerCase("tr");
  return event.category === "kayit" || title.includes("çekilme") || title.includes("ekleme-bırakma");
}

/** Bu kadar gün önceden görünmeye başlar. */
export const LEAD_DAYS = 7;
/** Bundan uzun süren işler (ör. aylarca açık kayıtlar) bantta gösterilmez. */
export const MAX_SPAN_DAYS = 21;

const DAY_MS = 86_400_000;
const span = (event: CalendarEvent) =>
  Math.round((Date.parse(`${lastDay(event)}T00:00:00Z`) - Date.parse(`${event.start}T00:00:00Z`)) / DAY_MS);

/**
 * Bantta gösterilecek tarih: süren varsa en yakın biten, yoksa yedi gün içinde başlayan.
 * Uygun tarih yoksa null.
 */
export function pickDeadline(events: readonly CalendarEvent[], today: string): CalendarEvent | null {
  const uygun = events.filter((e) => isDeadline(e) && span(e) <= MAX_SPAN_DAYS && lastDay(e) >= today);
  const suren = uygun.filter((e) => e.start <= today).sort((a, b) => lastDay(a).localeCompare(lastDay(b)));
  if (suren.length > 0) return suren[0];
  const yakin = uygun.filter((e) => e.start > today && daysUntil(today, e) <= LEAD_DAYS).sort((a, b) => a.start.localeCompare(b.start));
  return yakin[0] ?? null;
}

export interface DeadlineText {
  /** "Ders ekleme-bırakma sürüyor" */
  head: string;
  /** "29 Eylül'de bitiyor, 3 gün kaldı" */
  detail: string;
  /** Son gün bugün ya da yarınsa acil sayılır (bant vurgulanır). */
  urgent: boolean;
}

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

/** "29 Eylül" */
function dayMonth(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const remaining = (today: string, date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);

export function deadlineText(event: CalendarEvent, today: string): DeadlineText {
  const end = lastDay(event);
  if (event.start <= today) {
    const left = remaining(today, end);
    const detail =
      left === 0 ? `bugün son gün (${dayMonth(end)})` : left === 1 ? `yarın bitiyor (${dayMonth(end)})` : `${dayMonth(end)}'de bitiyor, ${left} gün kaldı`;
    return { head: `${event.title} sürüyor`, detail, urgent: left <= 1 };
  }
  const left = remaining(today, event.start);
  const detail = left === 1 ? `yarın başlıyor (${formatRange(event.start, event.end)})` : `${dayMonth(event.start)}'de başlıyor, ${left} gün kaldı`;
  return { head: event.title, detail, urgent: false };
}

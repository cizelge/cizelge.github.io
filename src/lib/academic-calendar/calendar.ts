// Akademik takvim hesapları: yaklaşanlar, aylara bölme, tarih yazımı ve .ics dosyası.
// Tarihler "YYYY-AA-GG" metinleri olarak karşılaştırılır; saat dilimi hesabı yoktur.
import type { CalendarEvent, EventCategory } from "./types";

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
/** getUTCDay sırası: Pazar = 0. */
const DAYS_SHORT = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

const DAY_MS = 86_400_000;

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function addDays(date: string, days: number): string {
  return new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Etkinliğin son günü (tek günlükse başladığı gün). */
export function lastDay(event: CalendarEvent): string {
  return event.end ?? event.start;
}

/** Bugün ya da sonrasında biten etkinlikler (sürenler dahil), başlangıca göre sıralı. */
export function upcoming(events: CalendarEvent[], todayISO: string, limit: number): CalendarEvent[] {
  return events
    .filter((e) => lastDay(e) >= todayISO)
    .sort((a, b) => a.start.localeCompare(b.start) || lastDay(a).localeCompare(lastDay(b)))
    .slice(0, limit);
}

export interface MonthGroup {
  /** "2026-09". */
  key: string;
  /** "Eylül 2026". */
  label: string;
  events: CalendarEvent[];
}

/** Etkinlikleri başladıkları aya göre gruplar; aylar ve ay içindeki sıra korunur (başlangıca göre). */
export function groupByMonth(events: CalendarEvent[]): MonthGroup[] {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const groups: MonthGroup[] = [];
  for (const e of sorted) {
    const key = e.start.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      const [y, m] = key.split("-").map(Number);
      group = { key, label: `${MONTHS[m - 1]} ${y}`, events: [] };
      groups.push(group);
    }
    group.events.push(e);
  }
  return groups;
}

/** Bugünden etkinliğin başlangıcına kalan gün; başlamışsa negatif. */
export function daysUntil(todayISO: string, event: CalendarEvent): number {
  return Math.round((toUtc(event.start) - toUtc(todayISO)) / DAY_MS);
}

export type EventStatus = "past" | "ongoing" | "today" | "future";

export function eventStatus(todayISO: string, event: CalendarEvent): EventStatus {
  if (lastDay(event) < todayISO) return "past";
  if (event.start === todayISO) return "today";
  if (event.start < todayISO) return "ongoing";
  return "future";
}

/** "3 gün kaldı", "yarın", "bugün", "sürüyor", "geçti". */
export function relativeLabel(todayISO: string, event: CalendarEvent): string {
  const status = eventStatus(todayISO, event);
  if (status === "past") return "geçti";
  if (status === "today") return "bugün";
  if (status === "ongoing") return "sürüyor";
  const days = daysUntil(todayISO, event);
  return days === 1 ? "yarın" : `${days} gün kaldı`;
}

function parts(date: string) {
  const d = new Date(toUtc(date));
  return { day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear(), weekday: d.getUTCDay() };
}

/** "2026-09-15" -> "15 Eylül 2026". fetchedAt gibi tam zaman damgalarında yalnızca tarih kısmı kullanılır. */
export function formatLongDate(date: string): string {
  const { day, month, year } = parts(date.slice(0, 10));
  return `${day} ${MONTHS[month]} ${year}`;
}

/** "21 Eyl Pzt", "28–30 Eki", "29 Ara – 2 Oca". */
export function formatRange(start: string, end: string | null): string {
  const a = parts(start);
  if (end === null || end === start) return `${a.day} ${MONTHS_SHORT[a.month]} ${DAYS_SHORT[a.weekday]}`;
  const b = parts(end);
  if (a.month === b.month && a.year === b.year) return `${a.day}–${b.day} ${MONTHS_SHORT[a.month]}`;
  return `${a.day} ${MONTHS_SHORT[a.month]} – ${b.day} ${MONTHS_SHORT[b.month]}`;
}

/** Bu türler için bir gün önceden hatırlatma eklenir. */
const ALARM_CATEGORIES: ReadonlySet<EventCategory> = new Set(["kayit", "basvuru", "sinav"]);

/** RFC 5545 metin kaçışı. */
export function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 75 sekizliyi aşan satırları katlar; çok baytlı karakterleri bölmez. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74; // devam satırı bir boşlukla başlar
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join("\r\n ");
}

const compact = (date: string) => date.replace(/-/g, "");

export interface IcsOptions {
  calName: string;
  /** DTSTAMP; verilmezse şimdiki an. */
  now?: Date;
}

export function eventsIcs(events: CalendarEvent[], { calName, now = new Date() }: IcsOptions): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cizelge//Akademik takvim//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
  ];
  for (const e of events) {
    const description = [e.time ? `Saat ${e.time}` : null, e.note ?? null].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@ozuhelper`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(e.start)}`,
      `DTEND;VALUE=DATE:${compact(addDays(lastDay(e), 1))}`,
      `SUMMARY:${escapeText(e.title)}`,
    );
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push("TRANSP:TRANSPARENT");
    if (ALARM_CATEGORIES.has(e.category)) {
      lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(e.title)}`, "TRIGGER:-P1D", "END:VALARM");
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

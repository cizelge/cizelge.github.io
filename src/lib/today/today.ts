// "Bugün" ekranı: kayıtlı programdan bugünün dersleri, şu anki ve sıradaki ders. Saf mantık: React yok.
// Tarih ve saat dışarıdan verilir (İstanbul saati); akademik takvimdeki tatil ve telafi günleri hesaba katılır.
import { isoWeekday, type TermCalendar } from "../calendar";
import { parseTime } from "../engine/timemask";

export interface SavedMeeting {
  code: string;
  title: string;
  section: string;
  day: number;
  start: string;
  end: string;
  room: string | null;
  instructor: string | null;
}

/** Planlayıcının tarayıcıya yazdığı program (dönem başına bir kayıt). */
export interface SavedSchedule {
  v: 1;
  schoolId: string;
  termId: string;
  termLabel: string;
  savedAt: string;
  meetings: SavedMeeting[];
}

export const scheduleKey = (schoolId: string, termId: string) => `bugun:${schoolId}:${termId}`;

export function parseSaved(raw: string | null): SavedSchedule | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const s = v as Partial<SavedSchedule>;
    if (s.v !== 1 || typeof s.termId !== "string" || typeof s.termLabel !== "string" || !Array.isArray(s.meetings)) return null;
    const meetings = s.meetings.filter(
      (m): m is SavedMeeting =>
        typeof m === "object" &&
        m !== null &&
        typeof m.code === "string" &&
        typeof m.day === "number" &&
        typeof m.start === "string" &&
        typeof m.end === "string",
    );
    return { v: 1, schoolId: String(s.schoolId ?? ""), termId: s.termId, termLabel: s.termLabel, savedAt: String(s.savedAt ?? ""), meetings };
  } catch {
    return null;
  }
}

export type DayKind =
  | { kind: "class"; weekday: number; makeupFor: string | null }
  | { kind: "holiday" }
  | { kind: "beforeTerm"; start: string }
  | { kind: "afterTerm" };

/** `date` günü hangi haftanın gününün dersleri yapılıyor. Takvim yoksa her gün kendi dersleri. */
export function classDay(date: string, cal: TermCalendar | undefined): DayKind {
  if (!cal) return { kind: "class", weekday: isoWeekday(date), makeupFor: null };
  if (date < cal.start) return { kind: "beforeTerm", start: cal.start };
  if (date > cal.end) return { kind: "afterTerm" };
  const makeup = cal.makeups.find((m) => m.date === date);
  if (makeup) return { kind: "class", weekday: isoWeekday(makeup.replaces), makeupFor: makeup.replaces };
  if (cal.noClass.includes(date)) return { kind: "holiday" };
  return { kind: "class", weekday: isoWeekday(date), makeupFor: null };
}

const byStart = (a: SavedMeeting, b: SavedMeeting) => parseTime(a.start) - parseTime(b.start) || a.code.localeCompare(b.code);

/** Haftanın bir gününün dersleri, başlangıca göre. */
export function meetingsOn(schedule: SavedSchedule, weekday: number): SavedMeeting[] {
  return schedule.meetings.filter((m) => m.day === weekday).sort(byStart);
}

export interface TodayView {
  day: DayKind;
  classes: SavedMeeting[];
  /** Şu an süren ders. */
  current: SavedMeeting | null;
  /** Sıradaki ders ve başlamasına kalan dakika. */
  next: { meeting: SavedMeeting; inMinutes: number } | null;
  /** Bugün ders kalmadıysa (ya da hiç yoksa) dersi olan bir sonraki gün. */
  nextDay: { date: string; classes: SavedMeeting[] } | null;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `date` ve günün dakikası (`minutes`, 0-1439) için görünüm. */
export function todayView(schedule: SavedSchedule, date: string, minutes: number, cal: TermCalendar | undefined): TodayView {
  const day = classDay(date, cal);
  const classes = day.kind === "class" ? meetingsOn(schedule, day.weekday) : [];
  const current = classes.find((m) => parseTime(m.start) <= minutes && minutes < parseTime(m.end)) ?? null;
  const upcoming = classes.find((m) => parseTime(m.start) > minutes);
  const next = upcoming ? { meeting: upcoming, inMinutes: parseTime(upcoming.start) - minutes } : null;

  let nextDay: TodayView["nextDay"] = null;
  if (!current && !next && schedule.meetings.length > 0) {
    // Dönem başlamadıysa ilk ders gününden, değilse yarından aramaya başla; en fazla 60 gün.
    let d = day.kind === "beforeTerm" ? day.start : addDays(date, 1);
    for (let i = 0; i < 60; i++, d = addDays(d, 1)) {
      const k = classDay(d, cal);
      if (k.kind === "afterTerm") break;
      if (k.kind !== "class") continue;
      const list = meetingsOn(schedule, k.weekday);
      if (list.length) {
        nextDay = { date: d, classes: list };
        break;
      }
    }
  }
  return { day, classes, current, next, nextDay };
}

/** Takvimi olan dönemlerden bugüne uyan kayıt: süren dönem, yoksa en yakın başlayacak olan; hiçbiri yoksa en yeni kayıt. */
export function pickSchedule(
  saved: readonly SavedSchedule[],
  calendars: Readonly<Record<string, TermCalendar>>,
  date: string,
): SavedSchedule | null {
  const withCal = saved
    .filter((s) => calendars[s.termId] && calendars[s.termId].end >= date)
    .sort((a, b) => calendars[a.termId].start.localeCompare(calendars[b.termId].start));
  if (withCal.length) return withCal[0];
  return [...saved].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
}

/** "45 dk", "1 sa 5 dk", "2 sa". */
export function formatIn(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} dk`;
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

/** İstanbul saatine göre "YYYY-AA-GG" ve günün dakikası. */
export function istanbulNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

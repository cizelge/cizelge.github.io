// Akademik takvim: dönemin ders başlangıç/bitiş günleri, ders yapılmayan günler ve telafi günleri.
// Takvime ekle (.ics) dosyası dersleri bu tarihlere göre tekrar ettirir.

export interface TermCalendar {
  /** İlk ders günü, "YYYY-AA-GG". */
  start: string;
  /** Son ders günü (dahil). */
  end: string;
  /** Dönem içinde ders yapılmayan günler (bayram, kampüs tatili). */
  noClass: string[];
  /** Telafi günleri: `date` günü, `replaces` gününün (haftanın o günü) dersleri yapılır. */
  makeups: { date: string; replaces: string }[];
  /** Tarihlerin alındığı yer. */
  source: string;
}

const OZU_2026_2027 =
  "https://www.ozyegin.edu.tr/sites/default/files/upload/OgrenciHizmetleri/2026.09.08_2026-2027_akademik_takvim_tr.pdf";

/** Özyeğin lisans takvimi (2026-2027 akademik takvimi, "Lisans" sütunu). */
export const OZYEGIN_CALENDAR: Record<string, TermCalendar> = {
  "2026-2027-guz": {
    start: "2026-09-21",
    end: "2026-12-25",
    noClass: ["2026-10-28", "2026-10-29", "2026-10-30"],
    makeups: [
      { date: "2026-11-07", replaces: "2026-10-28" },
      { date: "2026-11-21", replaces: "2026-10-29" },
      { date: "2026-12-05", replaces: "2026-10-30" },
    ],
    source: OZU_2026_2027,
  },
  "2026-2027-bahar": {
    start: "2027-01-20",
    end: "2027-04-30",
    noClass: ["2027-03-08", "2027-03-09", "2027-03-10", "2027-03-11", "2027-03-12", "2027-04-23"],
    // Takvim Ramazan Bayramı için yalnızca Pazartesi ve Salı telafisi veriyor.
    makeups: [
      { date: "2027-03-20", replaces: "2027-03-08" },
      { date: "2027-04-03", replaces: "2027-03-09" },
      { date: "2027-04-17", replaces: "2027-04-23" },
    ],
    source: OZU_2026_2027,
  },
  "2026-2027-yaz": {
    start: "2027-07-05",
    end: "2027-08-20",
    noClass: ["2027-07-15"],
    makeups: [{ date: "2027-07-17", replaces: "2027-07-15" }],
    source: OZU_2026_2027,
  },
};

/** "2026-09-21" -> 1 (Pazartesi) ... 7 (Pazar). */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface MeetingDates {
  /** Haftalık tekrarın ilk günü (dönemde o gün hiç ders yoksa null). */
  first: string | null;
  /** Haftalık tekrarın düşeceği ama ders yapılmayan günler. */
  skipped: string[];
  /** Haftalık düzen dışında eklenen telafi günleri. */
  extra: string[];
}

/** Haftanın `day` gününde yapılan bir dersin dönemdeki günleri. */
export function meetingDates(day: number, cal: TermCalendar): MeetingDates {
  let first: string | null = null;
  const skipped: string[] = [];
  const offset = (day - isoWeekday(cal.start) + 7) % 7;
  for (let date = addDays(cal.start, offset); date <= cal.end; date = addDays(date, 7)) {
    if (cal.noClass.includes(date)) skipped.push(date);
    if (first === null) first = date;
  }
  const extra = cal.makeups.filter((m) => isoWeekday(m.replaces) === day && m.date >= cal.start && m.date <= cal.end).map((m) => m.date);
  return { first, skipped, extra };
}

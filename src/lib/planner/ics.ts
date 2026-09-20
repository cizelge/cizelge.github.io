// Seçili programı takvim dosyasına (.ics) çevirir.
// Akademik takvimi bilinen dönemde dersler gerçek başlangıç ve bitiş günleri arasında tekrar eder,
// tatiller atlanır, telafi günleri ayrı etkinlik olarak eklenir. Takvim bilinmiyorsa önümüzdeki
// Pazartesiden başlayıp 14 hafta tekrar eder.
import type { Course } from "../types";
import type { SectionRef } from "../engine";
import { meetingDates, type TermCalendar } from "../calendar";

const pad = (n: number) => String(n).padStart(2, "0");
const DAY_CODES = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

// Türkiye 2016'dan beri yaz saati uygulamıyor: sabit +03.
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Istanbul",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0300",
  "TZOFFSETTO:+0300",
  "TZNAME:+03",
  "END:STANDARD",
  "END:VTIMEZONE",
];

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const compactDate = (iso: string) => iso.replace(/-/g, "");
const compactTime = (hhmm: string) => hhmm.replace(":", "") + "00";

function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type IcsSchedule =
  | { kind: "calendar"; calendar: TermCalendar }
  | { kind: "weeks"; firstMonday: Date; weeks?: number };

export function buildIcs(sections: readonly SectionRef[], courses: ReadonlyMap<string, Course>, when: IcsSchedule | Date): string {
  const schedule: IcsSchedule = when instanceof Date ? { kind: "weeks", firstMonday: when } : when;
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OzuHelper//TR", "CALSCALE:GREGORIAN", ...VTIMEZONE];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  for (const ref of sections) {
    const course = courses.get(ref.courseCode);
    const section = course?.sections.find((s) => s.id === ref.sectionId);
    if (!course || !section) continue;
    const uidBase = `${ref.courseCode.replace(/\s/g, "")}-${ref.sectionId}`;
    const common = [
      `SUMMARY:${escape(`${course.code} ${course.title}`)}`,
      `DESCRIPTION:${escape(`Şube ${section.id}${section.instructors.length ? `, ${section.instructors.join(", ")}` : ""}`)}`,
    ];

    section.meetings.forEach((m, i) => {
      const location = m.room ? [`LOCATION:${escape(m.room)}`] : [];
      const event = (uid: string, date: string, extra: string[]) => [
        "BEGIN:VEVENT",
        `UID:${uid}@ders-planlayici`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Europe/Istanbul:${compactDate(date)}T${compactTime(m.start)}`,
        `DTEND;TZID=Europe/Istanbul:${compactDate(date)}T${compactTime(m.end)}`,
        ...extra,
        ...common,
        ...location,
        "END:VEVENT",
      ];

      if (schedule.kind === "calendar") {
        const cal = schedule.calendar;
        const dates = meetingDates(m.day, cal);
        if (dates.first) {
          // Son ders gününün sonu, İstanbul saatiyle 23:59:59 = UTC 20:59:59.
          const until = `${compactDate(cal.end)}T205959Z`;
          const exdates = dates.skipped.map((d) => `EXDATE;TZID=Europe/Istanbul:${compactDate(d)}T${compactTime(m.start)}`);
          lines.push(...event(`${uidBase}-${i}`, dates.first, [`RRULE:FREQ=WEEKLY;UNTIL=${until};BYDAY=${DAY_CODES[m.day]}`, ...exdates]));
        }
        dates.extra.forEach((d, k) => lines.push(...event(`${uidBase}-${i}-telafi-${k}`, d, ["COMMENT:Telafi ders günü"])));
      } else {
        const date = new Date(schedule.firstMonday);
        date.setDate(date.getDate() + (m.day - 1));
        lines.push(...event(`${uidBase}-${i}`, localDate(date), [`RRULE:FREQ=WEEKLY;COUNT=${schedule.weeks ?? 14};BYDAY=${DAY_CODES[m.day]}`]));
      }
    });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

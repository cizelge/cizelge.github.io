// Seçili programı takvim dosyasına (.ics) çevirir: dönem başından itibaren haftalık tekrar eden etkinlikler.
import type { Course } from "../types";
import type { SectionRef } from "../engine";

const pad = (n: number) => String(n).padStart(2, "0");
const DAY_CODES = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** `firstMonday`: dönemin ilk haftasının Pazartesi günü. */
export function buildIcs(
  sections: readonly SectionRef[],
  courses: ReadonlyMap<string, Course>,
  firstMonday: Date,
  weeks = 14,
): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ders-planlayici//TR", "CALSCALE:GREGORIAN"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  for (const ref of sections) {
    const course = courses.get(ref.courseCode);
    const section = course?.sections.find((s) => s.id === ref.sectionId);
    if (!course || !section) continue;
    section.meetings.forEach((m, i) => {
      const date = new Date(firstMonday);
      date.setDate(date.getDate() + (m.day - 1));
      const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
      const t = (hhmm: string) => hhmm.replace(":", "") + "00";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${ref.courseCode.replace(/\s/g, "")}-${ref.sectionId}-${i}@ders-planlayici`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Europe/Istanbul:${ymd}T${t(m.start)}`,
        `DTEND;TZID=Europe/Istanbul:${ymd}T${t(m.end)}`,
        `RRULE:FREQ=WEEKLY;COUNT=${weeks};BYDAY=${DAY_CODES[m.day]}`,
        `SUMMARY:${escape(`${course.code} ${course.title}`)}`,
        `DESCRIPTION:${escape(`Şube ${section.id}${section.instructors.length ? `, ${section.instructors.join(", ")}` : ""}`)}`,
        ...(m.room ? [`LOCATION:${escape(m.room)}`] : []),
        "END:VEVENT",
      );
    });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

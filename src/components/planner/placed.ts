import type { Course } from "@/lib/types";
import type { Day, SectionRef } from "@/lib/engine";
import { parseTime } from "@/lib/engine";

export interface PlacedMeeting {
  courseCode: string;
  sectionId: string;
  day: Day;
  start: string;
  end: string;
  instructor: string | null;
  color: number;
}

export function placeMeetings(
  sections: readonly SectionRef[],
  courses: ReadonlyMap<string, Course>,
  colorOf: (code: string) => number,
): PlacedMeeting[] {
  const out: PlacedMeeting[] = [];
  for (const ref of sections) {
    const section = courses.get(ref.courseCode)?.sections.find((s) => s.id === ref.sectionId);
    if (!section) continue;
    for (const m of section.meetings) {
      out.push({
        courseCode: ref.courseCode,
        sectionId: ref.sectionId,
        day: m.day,
        start: m.start,
        end: m.end,
        instructor: section.instructors[0] ?? null,
        color: colorOf(ref.courseCode),
      });
    }
  }
  return out;
}

/** Tablonun saat aralığı: en az 08:00–18:00, dersler taşarsa genişler. */
export function timeRange(meetings: readonly { start: string; end: string }[]) {
  let start = 8 * 60;
  let end = 18 * 60;
  for (const m of meetings) {
    start = Math.min(start, parseTime(m.start));
    end = Math.max(end, parseTime(m.end));
  }
  return { start, end };
}

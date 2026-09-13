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

/** Yalnızca derslerin kapladığı saatler (tam saate yuvarlanmış), en az `minHours` saat. */
export function tightRange(meetings: readonly { start: string; end: string }[], minHours = 4) {
  if (meetings.length === 0) return timeRange(meetings);
  let start = Infinity;
  let end = -Infinity;
  for (const m of meetings) {
    start = Math.min(start, parseTime(m.start));
    end = Math.max(end, parseTime(m.end));
  }
  start = Math.floor(start / 60) * 60;
  end = Math.ceil(end / 60) * 60;
  const missing = minHours * 60 - (end - start);
  if (missing > 0) {
    const before = Math.min(start, Math.ceil(missing / 120) * 60);
    start -= before;
    end = Math.min(24 * 60, end + missing - before);
  }
  return { start, end };
}

export interface Lane {
  /** Aynı anda çakışan bloklar arasında kaçıncı sütun. */
  lane: number;
  /** O çakışma grubundaki sütun sayısı. */
  lanes: number;
}

/**
 * Aynı gündeki çakışan blokları yan yana sütunlara dağıtır (ders sayfasında şubeler aynı saatte olabilir).
 * Dönen dizi girdiyle aynı sıradadır.
 */
export function assignLanes(meetings: readonly { day: Day; start: string; end: string }[]): Lane[] {
  const result: Lane[] = meetings.map(() => ({ lane: 0, lanes: 1 }));
  const byDay = new Map<Day, number[]>();
  meetings.forEach((m, i) => byDay.set(m.day, [...(byDay.get(m.day) ?? []), i]));

  for (const idxs of byDay.values()) {
    const sorted = [...idxs].sort(
      (a, b) => parseTime(meetings[a].start) - parseTime(meetings[b].start) || parseTime(meetings[b].end) - parseTime(meetings[a].end),
    );
    let group: number[] = [];
    let groupEnd = -1;
    let laneEnds: number[] = [];
    const flush = () => {
      for (const i of group) result[i].lanes = laneEnds.length;
      group = [];
      laneEnds = [];
      groupEnd = -1;
    };
    for (const i of sorted) {
      const s = parseTime(meetings[i].start);
      const e = parseTime(meetings[i].end);
      if (group.length && s >= groupEnd) flush();
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(e);
      } else {
        laneEnds[lane] = e;
      }
      result[i].lane = lane;
      group.push(i);
      groupEnd = Math.max(groupEnd, e);
    }
    flush();
  }
  return result;
}

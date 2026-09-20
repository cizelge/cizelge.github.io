// "Aynı şubeyi alalım": bir dersin hangi şubeleri hem senin hem arkadaşının programına sığıyor.
// Arkadaşın yalnızca dolu saatlerini paylaşır (bkz. free-time.ts); hangi dersleri aldığı bilinmez.
import { parseTime } from "../engine";
import type { Course, Meeting } from "../types";
import { overlapsBusy } from "./free-time";

export interface OtherMeeting {
  courseCode: string;
  day: Meeting["day"];
  start: string;
  end: string;
}

export interface SharedSection {
  sectionId: string;
  instructors: string[];
  meetings: readonly Meeting[];
  /** Senin programında çakıştığı dersler. */
  myClash: string[];
  /** Arkadaşının o saatte dersi var mı. */
  friendBusy: boolean;
  /** İkiniz de alabilir misiniz. */
  bothFree: boolean;
}

const overlaps = (a: Pick<Meeting, "day" | "start" | "end">, b: Pick<Meeting, "day" | "start" | "end">) =>
  a.day === b.day && parseTime(a.start) < parseTime(b.end) && parseTime(b.start) < parseTime(a.end);

/**
 * Dersin şubelerini ikinizin programına göre değerlendirir.
 * `mine` senin programındaki oturumlar; bu dersin kendi oturumları dışarıda bırakılmalıdır.
 */
export function sharedSections(course: Course, mine: readonly OtherMeeting[], friend: Uint8Array): SharedSection[] {
  const others = mine.filter((m) => m.courseCode !== course.code);
  return course.sections.map((section) => {
    const clash = new Set<string>();
    let friendBusy = false;
    for (const m of section.meetings) {
      for (const other of others) if (overlaps(m, other)) clash.add(other.courseCode);
      if (overlapsBusy(friend, m)) friendBusy = true;
    }
    const myClash = [...clash];
    // Saati belli olmayan şube kimseyle çakışmaz; ikisi de alabilir sayılır.
    return {
      sectionId: section.id,
      instructors: [...section.instructors],
      meetings: section.meetings,
      myClash,
      friendBusy,
      bothFree: myClash.length === 0 && !friendBusy,
    };
  });
}

/** Ekranda gösterilecek kısa durum cümlesi. */
export function sharedLabel(s: SharedSection): string {
  if (s.bothFree) return "İkiniz de alabilirsiniz";
  if (s.myClash.length > 0 && s.friendBusy) return `Sende ${s.myClash.join(", ")} ile çakışıyor, arkadaşında da ders var`;
  if (s.myClash.length > 0) return `Sende ${s.myClash.join(", ")} ile çakışıyor`;
  return "Arkadaşının o saatte dersi var";
}

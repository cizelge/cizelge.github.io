// Programın "hoca puanı": şubelerin hocalarının genel puan ortalaması.
// Puanlar hoca sayfalarından gelir; puanı olmayan hoca ortalamaya girmez.
import type { SectionRef } from "../engine";
import { instructorSlug } from "../ratings/instructors";
import type { InstructorSummary } from "../ratings/types";
import type { Course } from "../types";

export type ScoreOf = (instructor: string) => number | null;

/** Hoca adından genel puana bakan işlev; puan listesi yoksa hep null döner. */
export function scoreLookup(instructors: readonly InstructorSummary[] | undefined): ScoreOf {
  if (!instructors || instructors.length === 0) return () => null;
  const map = new Map(instructors.map((i) => [i.slug, i.score]));
  return (name: string) => map.get(instructorSlug(name)) ?? null;
}

/** Bir şubenin hocalarının en yüksek puanı; puan yoksa null. */
export function sectionScore(course: Course | undefined, sectionId: string, scoreOf: ScoreOf): number | null {
  const section = course?.sections.find((s) => s.id === sectionId);
  if (!section) return null;
  const scores = section.instructors.map(scoreOf).filter((s): s is number => s !== null);
  return scores.length ? Math.max(...scores) : null;
}

/** Programın ortalama hoca puanı (puanı bilinen şubeler üzerinden); hiç puan yoksa null. */
export function scheduleScore(
  sections: readonly SectionRef[],
  courses: ReadonlyMap<string, Course>,
  scoreOf: ScoreOf,
): { score: number | null; known: number } {
  const scores = sections
    .map((r) => sectionScore(courses.get(r.courseCode), r.sectionId, scoreOf))
    .filter((s): s is number => s !== null);
  if (scores.length === 0) return { score: null, known: 0 };
  return { score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10, known: scores.length };
}

/** Bir düzendeki her ders için en yüksek puanlı seçenek; seçenek yoksa ya da puan yoksa değiştirmez. */
export function bestPicks(
  sections: readonly SectionRef[],
  alternatives: Readonly<Record<string, string[]>>,
  courses: ReadonlyMap<string, Course>,
  scoreOf: ScoreOf,
): Record<string, string> {
  const picks: Record<string, string> = {};
  for (const ref of sections) {
    const options = alternatives[ref.courseCode];
    if (!options || options.length < 2) continue;
    const course = courses.get(ref.courseCode);
    let bestId = ref.sectionId;
    let bestScore = sectionScore(course, ref.sectionId, scoreOf) ?? -1;
    for (const id of options) {
      const score = sectionScore(course, id, scoreOf);
      if (score !== null && score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    if (bestId !== ref.sectionId) picks[ref.courseCode] = bestId;
  }
  return picks;
}

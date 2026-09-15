// Oy özetlerinin biçimi; worker/src/logic.ts ile aynı olmak zorunda.

export const WORKLOAD_LABELS = [
  "haftada 2 saatten az",
  "haftada 2–5 saat",
  "haftada 5–8 saat",
  "haftada 8–12 saat",
  "haftada 12 saatten fazla",
] as const;

/** Oy verirken gösterilen kısa etiketler. */
export const WORKLOAD_SHORT = ["2 saatten az", "2–5 saat", "5–8 saat", "8–12 saat", "12 saatten fazla"] as const;

export const DIFFICULTY_LABELS = ["çok kolay", "kolay", "orta", "zor", "çok zor"] as const;

export interface InstructorSummary {
  name: string;
  n: number;
  difficulty: number;
  again: number;
}

export interface CourseSummary {
  n: number;
  difficulty: number;
  workload: number;
  again: number;
  instructors?: InstructorSummary[];
}

/** Özetin tek satırlık okunuşu. */
export function describeSummary(s: CourseSummary): string {
  const difficulty = s.difficulty.toLocaleString("tr-TR", { minimumFractionDigits: 1 });
  return `Zorluk ${difficulty}/5, ${WORKLOAD_LABELS[Math.round(s.workload) - 1]}, %${s.again} tekrar alır`;
}

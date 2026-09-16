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

/** Hocaya sorulan iki soru; yalnızca hoca seçildiyse sorulur. */
export const CLARITY_LABELS = ["hiç anlaşılmıyordu", "zor anlaşılıyordu", "idare eder", "anlaşılırdı", "çok anlaşılırdı"] as const;
export const FAIRNESS_LABELS = ["hiç adil değildi", "pek adil değildi", "idare eder", "adildi", "çok adildi"] as const;

/** Bir dersin içindeki hoca kırılımı. */
export interface InstructorInCourse {
  name: string;
  n: number;
  difficulty: number;
  again: number;
  /** Anlatım ortalaması (1-5); yeterli cevap yoksa null. */
  clarity: number | null;
  /** Notlandırma ortalaması (1-5); yeterli cevap yoksa null. */
  fairness: number | null;
}

/** Hoca sayfası: bütün derslerinin toplamı. */
export interface InstructorSummary extends InstructorInCourse {
  courses: { code: string; n: number; difficulty: number; again: number }[];
}

export interface CourseSummary {
  n: number;
  difficulty: number;
  workload: number;
  again: number;
  instructors?: InstructorInCourse[];
}

/** Özetin tek satırlık okunuşu. */
export function describeSummary(s: CourseSummary): string {
  const difficulty = s.difficulty.toLocaleString("tr-TR", { minimumFractionDigits: 1 });
  return `Zorluk ${difficulty}/5, ${WORKLOAD_LABELS[Math.round(s.workload) - 1]}, %${s.again} tekrar alır`;
}

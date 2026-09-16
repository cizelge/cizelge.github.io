// Oy özetlerinin biçimi; server/logic.ts ile aynı olmak zorunda.

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

export const INSTRUCTOR_CRITERIA = ["clarity", "fairness", "helpful", "attendance"] as const;
export type Criterion = (typeof INSTRUCTOR_CRITERIA)[number];
export type Criteria = Partial<Record<Criterion, number>>;

/** Hocaya sorulan kriterler: başlık, soru ve 1-5 karşılıkları. */
export const CRITERION_INFO: Record<Criterion, { label: string; question: string; scale: readonly string[] }> = {
  clarity: {
    label: "Ders anlatımı",
    question: "Anlatımı anlaşılır mıydı?",
    scale: ["hiç anlaşılmıyordu", "zor anlaşılıyordu", "idare eder", "anlaşılırdı", "çok anlaşılırdı"],
  },
  fairness: {
    label: "Notlandırma",
    question: "Notlandırması adil miydi?",
    scale: ["hiç adil değildi", "pek adil değildi", "idare eder", "adildi", "çok adildi"],
  },
  helpful: {
    label: "Yardımseverlik",
    question: "Soru sorunca yardımcı olur muydu?",
    scale: ["hiç olmazdı", "pek olmazdı", "idare eder", "olurdu", "her zaman olurdu"],
  },
  attendance: {
    label: "Yoklama",
    question: "Yoklama alır mıydı?",
    scale: ["hiç almazdı", "nadiren", "bazen", "çoğu ders", "her ders"],
  },
};

/** Bir dersin içindeki hoca kırılımı. */
export interface InstructorInCourse {
  name: string;
  n: number;
  difficulty: number;
  again: number;
  /** Yeterli cevap alan kriterler; ötekiler hiç gelmez. */
  criteria: Criteria;
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

export const oneDecimal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1 });

/** Özetin tek satırlık okunuşu. */
export function describeSummary(s: CourseSummary): string {
  return `Zorluk ${oneDecimal(s.difficulty)}/5, ${WORKLOAD_LABELS[Math.round(s.workload) - 1]}, %${s.again} tekrar alır`;
}

/** Hocanın genel puanı: anlatım, yardımseverlik ve notlandırmanın ortalaması; cevap yoksa null. */
export function instructorScore(criteria: Criteria): number | null {
  const parts = [criteria.clarity, criteria.fairness, criteria.helpful].filter((v): v is number => typeof v === "number");
  if (parts.length === 0) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10;
}

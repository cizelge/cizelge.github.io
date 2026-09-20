// Ders puanlarının biçimi; server/courses.ts ile aynı olmak zorunda.
import type { Comment } from "./types";

export const COURSE_CRITERIA = ["useful", "interesting", "difficulty", "workload"] as const;
export type CourseCriterion = (typeof COURSE_CRITERIA)[number];
export type CourseCriteria = Partial<Record<CourseCriterion, number>>;

/** Derse sorulan kriterler: başlık, kısa açıklama ve 1-5 karşılıkları. */
export const COURSE_CRITERION_INFO: Record<CourseCriterion, { label: string; hint: string; scale: readonly string[] }> = {
  useful: {
    label: "Faydası",
    hint: "işine yarayan bir şey öğrendin mi",
    scale: ["hiçbir şey kalmadı", "pek bir şey kalmadı", "idare eder", "faydalıydı", "çok faydalıydı"],
  },
  interesting: {
    label: "İlgi Çekicilik",
    hint: "dersi merak ederek mi dinledin",
    scale: ["çok sıkıcıydı", "sıkıcıydı", "idare eder", "ilgi çekiciydi", "çok ilgi çekiciydi"],
  },
  difficulty: {
    label: "Zorluk",
    hint: "geçmesi ne kadar zordu",
    scale: ["çok kolay", "kolay", "orta", "zor", "çok zor"],
  },
  workload: {
    label: "İş Yükü",
    hint: "ödev, proje ve çalışma saati",
    scale: ["çok az", "az", "orta", "çok", "çok fazla"],
  },
};

/** Genel puana giren kriterler; zorluk ve iş yükü iyi/kötü değil, dışarıda. */
export const SCORED_COURSE_CRITERIA: readonly CourseCriterion[] = ["useful", "interesting"];

export interface CourseSummary {
  /** "CS201" biçiminde anahtar. */
  course: string;
  title: string;
  n: number;
  /** "Yine alırdım" diyenlerin yüzdesi. */
  again: number;
  criteria: CourseCriteria;
  /** Faydalı ve ilgi çekici ortalaması; cevap yoksa null. */
  score: number | null;
  comments: Comment[];
}

/** Ders kodunun kayıt anahtarı: "cs 201" -> "CS201". */
export const courseKey = (code: string) => code.replace(/\s+/g, "").toUpperCase();

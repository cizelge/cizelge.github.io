// Not ortalaması hesapları. Kurallar Özyeğin Lisans Eğitim ve Öğretim Yönetmeliği'nden (2020):
// Madde 30 katsayılar, Madde 31 ortalamalar (AKTS ağırlıklı, tekrarda son not), Madde 24 ders tekrarı,
// Madde 20 ders yükü, Madde 34 yeterli/sınamalı ve onur.
import { canonicalCode } from "./progress";
import type { Completion, RoadmapProgram } from "./types";

export const GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_POINTS: Record<Grade, number> = {
  A: 4,
  "A-": 3.7,
  "B+": 3.3,
  B: 3,
  "B-": 2.7,
  "C+": 2.3,
  C: 2,
  "C-": 1.7,
  "D+": 1.3,
  D: 1,
  F: 0,
};

export const isGrade = (v: unknown): v is Grade => typeof v === "string" && (GRADES as readonly string[]).includes(v);

/** Gereksinim id -> son harf notu. F: dersten kalındı, ders kalanlara döner ama ortalamada sayılır. */
export type Grades = Record<string, Grade>;

export interface GradeEntry {
  /** Aynı ders iki programda da varsa tek kayıt: ders kodu; serbest seçmelide gereksinim id. */
  key: string;
  label: string;
  credits: number;
  grade: Grade;
}

/** Notu girilmiş dersler. Aynı kod birden çok programda notlandıysa ilk bulunan sayılır; AKTS'si bilinmeyen ders ortalamaya girmez. */
export function gradeEntries(programs: readonly RoadmapProgram[], completion: Completion, grades: Grades): GradeEntry[] {
  const out = new Map<string, GradeEntry>();
  for (const program of programs) {
    for (const req of program.requirements) {
      const grade = grades[req.id];
      if (!grade) continue;
      const mark = completion[req.id];
      let key = req.id;
      let label = req.title;
      let credits = req.credits;
      if (req.kind === "course" && req.code) {
        key = canonicalCode(req.code);
        label = req.code;
      } else if (req.pool && typeof mark === "string") {
        const chosen = req.pool.find((c) => canonicalCode(c.code) === canonicalCode(mark));
        key = canonicalCode(mark);
        label = mark;
        credits = chosen?.credits ?? req.credits;
      }
      if (credits === null || credits <= 0 || out.has(key)) continue;
      out.set(key, { key, label, credits, grade });
    }
  }
  return [...out.values()];
}

export interface GpaResult {
  /** İki haneye yuvarlanmış ortalama; not yoksa null. */
  gpa: number | null;
  credits: number;
  points: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeGpa(entries: readonly { credits: number; grade: Grade }[]): GpaResult {
  let credits = 0;
  let points = 0;
  for (const e of entries) {
    credits += e.credits;
    points += e.credits * GRADE_POINTS[e.grade];
  }
  return { gpa: credits > 0 ? round2(points / credits) : null, credits, points };
}

export type TargetResult =
  | { kind: "guaranteed" }
  | { kind: "impossible"; best: number }
  | { kind: "needed"; average: number }
  | { kind: "noRemaining"; gpa: number | null };

/**
 * Kalan `remainingCredits` AKTS'de hedefe ulaşmak için gereken ortalama.
 * F alınmış dersler tekrar alınacağı için (son not geçerli) şimdiki hesaptan çıkarılır;
 * `remainingCredits` bu dersleri zaten içermelidir (planda kalan dersler arasındadırlar).
 */
export function targetAverage(entries: readonly GradeEntry[], remainingCredits: number, target: number): TargetResult {
  const kept = entries.filter((e) => e.grade !== "F");
  const { credits, points } = computeGpa(kept);
  const remaining = Math.max(0, remainingCredits);
  if (remaining === 0) return { kind: "noRemaining", gpa: credits > 0 ? round2(points / credits) : null };

  const total = credits + remaining;
  const needed = (target * total - points) / remaining;
  if (needed <= 0) return { kind: "guaranteed" };
  if (needed > 4 + 1e-9) return { kind: "impossible", best: round2((points + 4 * remaining) / total) };
  // Yukarı yuvarlanır: 3,171 gerekiyorsa 3,17 yetmez.
  return { kind: "needed", average: Math.ceil(needed * 100 - 1e-9) / 100 };
}

/** Madde 24(3): B ve üstü tekrarlanamaz; B- ve altı tekrarlanabilir. */
export const canRetake = (grade: Grade) => GRADE_POINTS[grade] <= GRADE_POINTS["B-"];

/** Bir dersi yeni notla tekrar alırsa ortalama ne olur (son not geçerli). */
export function retakeGpa(entries: readonly GradeEntry[], key: string, grade: Grade): number | null {
  return computeGpa(entries.map((e) => (e.key === key ? { ...e, grade } : e))).gpa;
}

export interface Threshold {
  value: number;
  label: string;
}

export const THRESHOLDS: readonly Threshold[] = [
  { value: 2, label: "Yeterli öğrenci" },
  { value: 2.2, label: "Erasmus başvurusu" },
  { value: 2.5, label: "Yandal başvurusu" },
  // Çift Anadal sayfası (2026): başvuru ve devam için en az 2,72.
  { value: 2.72, label: "Çift anadal başvurusu" },
  { value: 3, label: "Onur" },
  { value: 3.5, label: "Yüksek onur" },
];

export function nextThreshold(gpa: number): Threshold | null {
  return THRESHOLDS.find((t) => gpa < t.value) ?? null;
}

/** Madde 20(2): güz ve bahar döneminde alınabilecek en fazla AKTS. */
export function maxLoad(gpa: number | null, opts: { cap: boolean; passedEcts: number }): number {
  if (opts.cap) return 42;
  if (gpa === null) return 30;
  if (gpa >= 1.6 && opts.passedEcts >= 198) return 42;
  if (gpa >= 3) return 42;
  if (gpa >= 2) return 36;
  return 30;
}

export const formatGpa = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

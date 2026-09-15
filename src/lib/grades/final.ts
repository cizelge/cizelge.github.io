// "Finalden kaç almam lazım": ağırlıklı ders notundan her harf notu için gereken final puanı. Saf mantık.

export interface GradeItem {
  name: string;
  /** Yüzde ağırlık (0-100). */
  weight: number;
  /** 0-100; null: henüz notu yok (final gibi hesaplanır). */
  score: number | null;
}

export interface LetterCutoff {
  letter: string;
  /** Bu harf için gereken en düşük ders puanı (0-100). */
  min: number;
}

/**
 * Varsayılan sınırlar. Özyeğin'de harf sınırlarını dersin hocası belirler; bunlar yalnızca başlangıç değeri,
 * kullanıcı ders izlencesindeki sınırlarla değiştirir.
 */
export const DEFAULT_CUTOFFS: readonly LetterCutoff[] = [
  { letter: "A", min: 90 },
  { letter: "A-", min: 85 },
  { letter: "B+", min: 80 },
  { letter: "B", min: 75 },
  { letter: "B-", min: 70 },
  { letter: "C+", min: 65 },
  { letter: "C", min: 60 },
  { letter: "C-", min: 55 },
  { letter: "D+", min: 50 },
  { letter: "D", min: 45 },
];

export interface GradeState {
  /** Notu girilmiş kalemlerin ders puanına katkısı (0-100 ölçeğinde). */
  earned: number;
  /** Notu girilmemiş kalemlerin (final dahil) toplam ağırlığı. */
  remainingWeight: number;
  /** Bütün ağırlıkların toplamı; 100 değilse sonuç yanıltıcıdır. */
  totalWeight: number;
}

export function gradeState(items: readonly GradeItem[]): GradeState {
  let earned = 0;
  let remainingWeight = 0;
  let totalWeight = 0;
  for (const item of items) {
    if (!(item.weight > 0)) continue;
    totalWeight += item.weight;
    if (item.score === null) remainingWeight += item.weight;
    else earned += (item.weight * clamp(item.score)) / 100;
  }
  return { earned: round(earned), remainingWeight: round(remainingWeight), totalWeight: round(totalWeight) };
}

export type Need =
  /** Kalan her kalemden en az bu puan (0-100, yukarı yuvarlanmış tek ondalık). */
  | { kind: "score"; score: number }
  /** Kalanlardan 0 alsan da bu harf garanti. */
  | { kind: "secured" }
  /** Kalanlardan 100 alsan da yetmez. */
  | { kind: "impossible"; best: number };

/** Ders puanının `target`e ulaşması için notu girilmemiş kalemlerin her birinden gereken puan. */
export function neededScore(state: GradeState, target: number): Need {
  const missing = target - state.earned;
  if (missing <= 1e-9) return { kind: "secured" };
  if (state.remainingWeight <= 0) return { kind: "impossible", best: state.earned };
  const score = (missing * 100) / state.remainingWeight;
  if (score > 100 + 1e-9) return { kind: "impossible", best: round(state.earned + state.remainingWeight) };
  return { kind: "score", score: Math.ceil(score * 10 - 1e-9) / 10 };
}

/** Kalanlardan `score` alınırsa ders puanı ve harf notu (sınırlar büyükten küçüğe). */
export function projected(state: GradeState, score: number, cutoffs: readonly LetterCutoff[]): { total: number; letter: string } {
  const total = round(state.earned + (state.remainingWeight * clamp(score)) / 100);
  const sorted = [...cutoffs].sort((a, b) => b.min - a.min);
  return { total, letter: sorted.find((c) => total >= c.min - 1e-9)?.letter ?? "F" };
}

function clamp(n: number): number {
  return Math.min(100, Math.max(0, n));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

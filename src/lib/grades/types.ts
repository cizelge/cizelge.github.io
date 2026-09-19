// Not dağılımı: sunucudaki server/grades.ts ile aynı sözleşme.

export const LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F", "W"] as const;
export type Letter = (typeof LETTERS)[number];

/** Dağılım çubuklarında soldan sağa bu sıra kullanılır. */
export const LETTER_ORDER: readonly Letter[] = LETTERS;

/** Harfin ne anlama geldiği (ipucu metni). */
export const LETTER_HINT: Record<Letter, string> = {
  A: "4,00",
  "A-": "3,70",
  "B+": "3,30",
  B: "3,00",
  "B-": "2,70",
  "C+": "2,30",
  C: "2,00",
  "C-": "1,70",
  "D+": "1,30",
  D: "1,00",
  F: "kaldı",
  W: "çekildi",
};

export type Counts = Partial<Record<Letter, number>>;

export interface InstructorGrades {
  slug: string;
  n: number;
  letters: Counts;
  gpa: number | null;
  pass: number | null;
}

export interface CourseGrades {
  course: string;
  n: number;
  /** Eşiğe ulaşılmadıysa dağılım boş gelir, yalnızca sayı bilinir. */
  hidden: boolean;
  letters: Counts;
  gpa: number | null;
  pass: number | null;
  instructors: InstructorGrades[];
  terms: string[];
}

/** Sunucudaki eşik; "daha N bildirim lazım" yazısı için. */
export const MIN_GRADES = 5;

const SEASON_LABEL: Record<string, string> = { guz: "Güz", bahar: "Bahar", yaz: "Yaz" };

/** "2025-2026-guz" -> "2025-2026 Güz" */
export function termLabel(code: string): string {
  const [start, end, season] = code.split("-");
  return `${start}-${end} ${SEASON_LABEL[season] ?? season}`;
}

/**
 * Not bildirilebilecek dönemler, yeniden eskiye.
 * Akademik yıl eylülde başlar; içinde bulunulan dönem de listeye girer (notu çıkmış olabilir).
 */
export function recentTerms(now = new Date(), count = 9): string[] {
  const month = now.getMonth(); // 0 = Ocak
  const year = now.getFullYear();
  // Eylül ve sonrası yeni akademik yıl; öncesi bir önceki yılın akademik yılı.
  const startYear = month >= 8 ? year : year - 1;
  // Bir akademik yılın dönemleri, yeniden eskiye.
  const seasons = ["yaz", "bahar", "guz"] as const;
  // İçinde bulunulan dönem: eylül-ocak güz, şubat-haziran bahar, temmuz-ağustos yaz.
  const current = month >= 8 || month === 0 ? "guz" : month >= 6 ? "yaz" : "bahar";
  const out: string[] = [];
  let y = startYear;
  let i = seasons.indexOf(current);
  while (out.length < count) {
    out.push(`${y}-${y + 1}-${seasons[i]}`);
    i++;
    // Yılın güzünü de yazdıktan sonra bir önceki akademik yılın yazına geçilir.
    if (i === seasons.length) {
      i = 0;
      y--;
    }
  }
  return out;
}

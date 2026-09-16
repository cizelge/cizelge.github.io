// Hoca puanlarının biçimi; server/logic.ts ile aynı olmak zorunda.

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

/** Sayfada gösterilen isimsiz yorum. */
export interface Comment {
  id: string;
  text: string;
  at: string;
  again: boolean;
  score: number | null;
}

export interface InstructorSummary {
  slug: string;
  name: string;
  /** Kaç kişi puanladı. */
  n: number;
  /** "Yine bu hocadan alırdım" diyenlerin yüzdesi. */
  again: number;
  criteria: Criteria;
  /** Anlatım, notlandırma ve yardımseverliğin ortalaması; cevap yoksa null. */
  score: number | null;
  /** Yeniden eskiye isimsiz yorumlar. */
  comments: Comment[];
}

export const MAX_COMMENT = 500;

/** "3 gün önce", "dün", "bugün". */
export function sinceLabel(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(days)) return "";
  if (days <= 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} ay önce` : `${Math.floor(months / 12)} yıl önce`;
}

export const oneDecimal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1 });

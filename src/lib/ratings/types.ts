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
}

export const oneDecimal = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1 });

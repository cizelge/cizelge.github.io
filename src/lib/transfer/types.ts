// Yatay geçiş ve çift anadal uygunluk sayfası: parçalar arasındaki ortak sözleşme.
// Veri: data/ozyegin/transfer.json (TransferData). Mantık: src/lib/transfer/eligibility.ts. Arayüz: /ozyegin/gecis.

export type ScoreType = "SAY" | "EA" | "SÖZ" | "DİL";

/** Bir yılın YKS yerleşme bilgisi (Özyeğin'de o program ve burs türü için). */
export interface BaseScore {
  year: number;                    // YKS yılı: 2025
  scholarship: "tam" | "yuzde50" | "yuzde25" | "ucretli" | "diger";
  scholarshipLabel: string;        // kaynaktaki yazım: "Tam Burslu"
  quota: number | null;
  minScore: number | null;         // en düşük yerleşen puanı
  maxScore: number | null;
  minRank: number | null;          // en düşük başarı sırası (büyük sayı)
  maxRank: number | null;
}

/** Sınıf düzeyi -> kontenjan. Anahtarlar: "hazirlik", "1", "2", "3", "4". Yoksa anahtar yok. */
export type QuotaByYear = Partial<Record<"hazirlik" | "1" | "2" | "3" | "4", number>>;

export interface TransferProgram {
  /** programs.json'daki SIS kodu ("BSCS"); eşleşmeyen program için null. */
  programId: string | null;
  name: string;                    // "Bilgisayar Mühendisliği"
  faculty: string;
  scoreType: ScoreType | null;
  baseScores: BaseScore[];         // yıllar ve burs türleri
  /** Kurum içi (başarıya göre) yatay geçiş kontenjanı; yayınlanmadıysa null. */
  internalQuota: QuotaByYear | null;
  /** Merkezi yerleştirme puanı ile (Ek Madde-1) kontenjan; yayınlanmadıysa null. */
  centralQuota: QuotaByYear | null;
  /** Çift anadal kabul ediyor mu (Gastronomi, Pilotaj: false). */
  capOpen: boolean;
  /** Çift anadal için "ilk %20" yerine geçen YKS başarı sırası şartları (biri yeter). */
  capRankRules: CapRankRule[];
  /** Kurum içi (başarıya göre) geçişte kayıt yılına göre zorunlu başarı sırası şartları. */
  internalRankRules: CapRankRule[];
  /** Merkezi yerleştirme puanı ile geçişte kayıt yılına göre zorunlu başarı sırası şartları. */
  centralRankRules: CapRankRule[];
  /** Kurum içi geçiş için programa özel ek koşullar (2027-2028'den itibaren olanlar dahil), düz metin. */
  notes: string[];
}

export interface CapRankRule {
  scoreType: ScoreType;
  maxRank: number;                 // bu sıradan iyi (küçük ya da eşit) olmalı
  /** Kayıt yılı aralığı; sınırsızsa null. */
  fromYear: number | null;
  toYear: number | null;
  text: string;                    // kaynaktaki cümle
}

export interface TransferRules {
  capMinGpa: number;               // 2.72
  capCreditsBySemester: { semester: number; minCredits: number }[]; // 3->48, 4->84, 5->120
  capSemesters: { min: number; max: number }; // başvuru dönemi (3..5)
  internalSemesters: { min: number; max: number }; // kurum içi geçişte okunmuş dönem (2..5)
  yandalMinGpa: number;            // 2.50
}

export interface TransferData {
  schoolId: string;
  fetchedAt: string;
  /** Kurallar ve kontenjanların ait olduğu başvuru dönemi: "2026-2027 Güz". */
  applicationTerm: string;
  sources: { label: string; url: string }[];
  rules: TransferRules;
  programs: TransferProgram[];
}

/* ------------------------------------------------------------------ */
/* Uygunluk (src/lib/transfer/eligibility.ts)                           */
/* ------------------------------------------------------------------ */

export interface StudentProfile {
  /** Şu anki anadal (programs.json kodu); null = Özyeğin öğrencisi değil / seçilmedi. */
  programId: string | null;
  gpa: number | null;
  /** Hazırlık ve yaz hariç tamamlanmış dönem sayısı (başvuru döneminin başına kadar). */
  completedSemesters: number | null;
  completedCredits: number | null;
  hasFailedCourse: boolean | null;
  entryYear: number | null;        // YKS ile yerleşilen yıl
  scoreType: ScoreType | null;
  score: number | null;            // o yılın yerleşme puanı
  rank: number | null;             // başarı sırası
  /** Sınıfının GNO'ya göre ilk %20'sinde mi; bilinmiyorsa null. */
  top20: boolean | null;
}

export type CheckStatus = "ok" | "fail" | "unknown";

export interface Check {
  id: string;                      // "gpa", "semesters", "credits", "failed", "score", "rank", "open", "quota"
  status: CheckStatus;
  /** Kısa Türkçe cümle: "Ortalaman 2,72'nin üstünde." / "84 AKTS gerekiyor, 70 tamamladın." */
  text: string;
}

export interface PathResult {
  path: "internal" | "central" | "cap";
  /** Genel durum: bir fail varsa fail; fail yok ama unknown varsa unknown; hepsi ok ise ok. */
  status: CheckStatus;
  checks: Check[];
  /** Kontenjan (öğrencinin gideceği sınıf düzeyi için), bilinmiyorsa null. */
  quota: number | null;
  /** Özyeğin taban puanına göre fark (puan - taban), aynı puan türünde ve kayıt yılının verisi varsa. */
  scoreMargin: number | null;
}

/*
 * eligibility.ts dışa aktarır:
 *   targetYearLevel(profile): "2" | "3" | "4" | null          // tamamlanan döneme göre geçilecek sınıf (2 dönem -> 2. sınıf, 4 -> 3.)
 *   evaluateInternal(target: TransferProgram, profile, data): PathResult
 *   evaluateCentral(target: TransferProgram, profile, data): PathResult
 *     // şart: kayıt yılındaki puan >= hedefin o yılki Özyeğin en düşük puanı (burs türlerinin en düşüğü, ücretli dahil);
 *     //       o yılın verisi yoksa unknown
 *   evaluateCap(target: TransferProgram, profile, data): PathResult
 *   evaluateAll(profile, data): { program: TransferProgram; internal: PathResult; central: PathResult; cap: PathResult }[]
 *     // öğrencinin kendi programı hariç; sıralama: cap/internal ok olanlar önce, sonra ada göre (tr)
 * Kurum içi geçişteki "Türkiye'deki eşdeğer programların en düşük taban puanı" şartı veride yok: her zaman unknown
 * ve metni bunu söyler.
 */

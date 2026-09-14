// Erasmus: parçalar arasındaki ortak sözleşme.
// Kaynak: Özyeğin "Erasmus+ Öğrenim Hareketliliği / Giden Öğrenci" sayfası (2024-25 çağrısı ve hibe tablosu).
// Veri: data/ozyegin/erasmus.json (ErasmusData). Mantık: src/lib/erasmus/score.ts, src/lib/roadmap/erasmus.ts.
// Arayüz: /ozyegin/erasmus ve yol haritasındaki Erasmus dönemi.

export interface ErasmusCriterion {
  id: string;                      // "previous", "withdrew", "homeCountry", "eleAbsent", "orientationAbsent", "disability", "veteran", "disaster", "socialProtection"
  label: string;                   // "Daha önce Erasmus'a katıldım"
  points: number;                  // -10, +15 ...
  /** true: kaç kez olduğu girilir (önceki katılım her biri için -10). */
  perCount: boolean;
}

export interface ErasmusData {
  schoolId: string;
  fetchedAt: string;
  callYear: string;                // "2024-25"
  sources: { label: string; url: string }[];
  eligibility: {
    minGpa: number;                // 2.20 (lisans)
    minEle: number;                // 60
    minEctsAtApplication: number;  // 24
    minEctsAtNomination: number;   // 54
  };
  score: {
    gpaWeight: number;             // 0.5
    eleWeight: number;             // 0.5
    /** İlanda 4'lük ortalamanın 100'lüğe çevrilmesi yazmıyor: varsayım ve açıklaması. */
    gpaTo100: { factor: number; assumption: string };
    ranking: string;               // "Fakülte/yüksekokul bazında"
  };
  criteria: ErasmusCriterion[];
  grant: {
    monthly: { group: string; countries: string; euro: number }[];
    maxFundedMonths: number;       // 4
    disadvantagedMonthly: number;  // 250
    travel: { minKm: number; maxKm: number | null; standard: number; green: number }[];
  };
  durationMonths: { min: number; max: number }; // 2..12
}

/*
 * src/lib/erasmus/score.ts dışa aktarır:
 *   erasmusEligibility(data, input: { gpa: number|null; ele: number|null; ects: number|null }):
 *     { id: "gpa"|"ele"|"ectsApplication"|"ectsNomination"; status: "ok"|"fail"|"unknown"; text: string }[]
 *   erasmusScore(data, input: { gpa: number; ele: number; criteria: Record<string, number> }):
 *     { gpaPart: number; elePart: number; bonus: number; total: number }   // criteria: id -> adet (perCount değilse 0/1)
 *   eleNeededFor(data, input: { gpa: number; target: number; criteria: Record<string, number> }):
 *     { kind: "needed"; ele: number } | { kind: "impossible" } | { kind: "guaranteed" }   // ELE 0..100
 *   grantEstimate(data, input: { group: string; months: number; km: number|null; green: boolean; disadvantaged: boolean }):
 *     { monthly: number; fundedMonths: number; travel: number | null; total: number }
 */

/* ------------------------------------------------------------------ */
/* Ders eşleştirme taslağı (src/lib/erasmus/agreement.ts)              */
/* ------------------------------------------------------------------ */

export interface AgreementRow {
  id: string;
  hostCode: string;
  hostTitle: string;
  hostEcts: number | null;
  /** Eşlenen Özyeğin gereksinimi (yol haritası Requirement.id) ya da elle yazılan ders kodu; boşsa null. */
  match: { kind: "requirement"; requirementId: string } | { kind: "code"; code: string } | null;
}

export interface AgreementDraft {
  version: 1;
  hostUniversity: string;
  term: { startYear: number; season: "guz" | "bahar" } | null;
  rows: AgreementRow[];
}

/*
 * agreement.ts dışa aktarır:
 *   loadDraft(): AgreementDraft; saveDraft(d): void          // localStorage "erasmus:ozyegin", try/catch, doğrulamalı
 *   validateDraft(raw: unknown): AgreementDraft
 *   draftTotals(d, lookupCredits: (m: NonNullable<AgreementRow["match"]>) => number | null):
 *     { hostEcts: number; matchedOzuEcts: number; unmatchedRows: number }
 */

/* ------------------------------------------------------------------ */
/* Yol haritasında Erasmus dönemi (src/lib/roadmap/erasmus.ts)          */
/* ------------------------------------------------------------------ */

/*
 * PlanOptions'a (src/lib/roadmap/types.ts) isteğe bağlı alan eklenir:
 *   erasmus?: { term: { startYear: number; season: "guz" | "bahar" }; ects: number }
 *     // O dönem Özyeğin'de ders alınmaz. Kalan SEÇMELİLERDEN (havuzlu ya da serbest) en fazla `ects` AKTS'lik kısmı
 *     // "yurt dışında alınıp saydırılacak" olarak o döneme yerleşir (zorunlu dersler yerleşmez).
 *     // PlanTerm'e isteğe bağlı `erasmus?: true` eklenir.
 *
 * erasmus.ts dışa aktarır:
 *   suggestErasmusTerms(programs, completion, offering, options: PlanOptions, candidates: number = 6):
 *     { term: { startYear: number; season: "guz" | "bahar" }; label: string; graduation: string | null;
 *       delayTerms: number; electivesAbroad: number; pushedRequired: string[] }[]
 *     // Planın ilk `candidates` dönemi için Erasmus'u o döneme koyup buildPlan'ı tekrar çalıştırır; Erasmussuz plana göre
 *     // mezuniyet gecikmesi (dönem), yurt dışına taşınan seçmeli AKTS'si ve bir sonraki döneme kayan zorunlu ders kodlarını verir.
 *     // Sıra: delayTerms artan, sonra pushedRequired.length artan, sonra electivesAbroad azalan, sonra tarih.
 */

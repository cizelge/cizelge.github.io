// Mezuniyet yol haritası: parçalar arasındaki ortak sözleşme.
// Bu dosyadaki tipler ve aşağıda imzası verilen fonksiyonlar paralel yazılan modüllerin buluşma noktasıdır;
// imzaları değiştirmek yerine yeni alan ekleyin.
import type { PlanPoolCourse, PlanSeason } from "../types";
import type { TermSeason } from "../terms";

export type { PlanPoolCourse, PlanSeason, TermSeason };

/* ------------------------------------------------------------------ */
/* Ön koşullar (src/lib/roadmap/prereq.ts)                             */
/* ------------------------------------------------------------------ */

/**
 * Serbest yazılmış ön koşulun ağacı. Ders kodları normalizeCode ile yazılır ("CS 101").
 * "unknown": okunamayan ya da yorumlanamayan kısım (ör. "şu dört dersten en az ikisi"); ham metin saklanır.
 */
export type PrereqExpr =
  | { kind: "none" }
  | { kind: "course"; code: string }
  | { kind: "minEcts"; ects: number }
  | { kind: "and"; items: PrereqExpr[] }
  | { kind: "or"; items: PrereqExpr[] }
  | { kind: "unknown"; text: string };

/*
 * prereq.ts dışa aktarır:
 *   parsePrerequisite(text: string): PrereqExpr
 *   evaluatePrerequisite(expr: PrereqExpr, passed: ReadonlySet<string>, passedEcts: number): boolean | null
 *     true: sağlanıyor, false: sağlanmıyor, null: "unknown" yüzünden karar verilemiyor
 *     (and içinde bir false varsa false; or içinde bir true varsa true).
 *   prerequisiteCodes(expr: PrereqExpr): string[]   // ağaçtaki bütün ders kodları, tekrarsız
 *   hasUnknown(expr: PrereqExpr): boolean
 */

/* ------------------------------------------------------------------ */
/* Gereksinimler: anadal, çift anadal ve yandal aynı biçime çevrilir    */
/* ------------------------------------------------------------------ */

export type RoadmapProgramKind = "anadal" | "cap" | "yandal";

export interface Requirement {
  /** Program içinde tekil ve kalıcı (localStorage'da anahtar): "BSCS:y2-bahar:3", "MINEE:req:0". */
  id: string;
  programId: string;
  kind: "course" | "elective";
  /** kind "course" için ders kodu ("CS 201"). */
  code: string | null;
  /** Ders adı ya da seçmeli etiketi ("BSCS Program-İçi Seçmeli"). */
  title: string;
  /** AKTS; bilinmiyorsa null (hesaplarda 0 sayılır ve arayüzde belirtilir). */
  credits: number | null;
  /** Ham ön koşul metni; yoksa "". Seçmelide "". */
  prerequisites: string;
  corequisites: string[];
  /** kind "elective" için havuz; null = serbest seçmeli (herhangi bir ders). */
  pool: PlanPoolCourse[] | null;
  /** Müfredattaki önerilen yer; yandalda null. */
  slot: { year: number; season: PlanSeason } | null;
}

export interface RoadmapProgram {
  id: string;
  kind: RoadmapProgramKind;
  name: string;
  requirements: Requirement[];
  /** Toplam AKTS (müfredat başlıklarındaki kredilerin toplamı ya da gereksinimlerin toplamı). */
  totalCredits: number;
}

/*
 * requirements.ts dışa aktarır:
 *   programRequirements(program: Program, kind: "anadal" | "cap"): RoadmapProgram
 * minors.ts dışa aktarır:
 *   minorRequirements(minor: Minor): RoadmapProgram   // status "unlisted" ise requirements boş
 */

/* ------------------------------------------------------------------ */
/* Yandal verisi (data/ozyegin/minors.json)                            */
/* ------------------------------------------------------------------ */

export interface MinorElectiveGroup {
  /** Bu listeden en az kaç ders alınmalı. */
  min: number;
  pool: PlanPoolCourse[];
  note?: string;
}

export interface Minor {
  /** Kalıcı kimlik: "yandal-elektrik-elektronik". */
  id: string;
  name: string;
  department: string;
  /** Listenin alındığı resmi sayfa. */
  sourceUrl: string;
  /** "listed": ders listesi sayfada var; "unlisted": sayfa var ama tam liste yok. */
  status: "listed" | "unlisted";
  required: PlanPoolCourse[];
  electiveGroups: MinorElectiveGroup[];
  /** Kaynaktaki koşullar, muafiyetler vb. düz metin. */
  notes: string[];
}

export interface MinorsData {
  schoolId: string;
  fetchedAt: string;
  minors: Minor[];
}

/* ------------------------------------------------------------------ */
/* İlerleme (src/lib/roadmap/progress.ts)                              */
/* ------------------------------------------------------------------ */

/**
 * Kullanıcının işaretleri: gereksinim id -> true (ders / serbest seçmeli geçildi)
 * ya da havuzdan seçilen dersin kodu (havuzlu seçmeli geçildi). Olmayan anahtar: geçilmedi.
 */
export type Completion = Record<string, true | string>;

export interface ProgramProgress {
  programId: string;
  passedCredits: number;
  totalCredits: number;
  remainingCourses: number;
  remainingElectives: number;
}

/*
 * progress.ts dışa aktarır:
 *   passedCodes(programs: RoadmapProgram[], completion: Completion): Set<string>
 *     // geçilen ders kodları; havuzdan seçilen kodlar dahil. Bir programda geçilen ders
 *     // aynı koda sahip başka programdaki "course" gereksinimini de karşılar.
 *   isDone(req: Requirement, completion: Completion, passed: ReadonlySet<string>): boolean
 *   programProgress(program: RoadmapProgram, completion: Completion, passed: ReadonlySet<string>): ProgramProgress
 *   passedEcts(programs: RoadmapProgram[], completion: Completion): number  // aynı ders bir kez sayılır
 *   markUntil(program: RoadmapProgram, until: { year: number; season: PlanSeason }): Completion
 *     // "bundan önceki dönemlerin hepsini geçtim": slot'u bu dönemden önce olan her gereksinim;
 *     // havuzlu seçmelilerde true (hangi dersin alındığı bilinmiyor).
 */

/* ------------------------------------------------------------------ */
/* Plan (src/lib/roadmap/plan.ts, offering.ts, critical.ts)            */
/* ------------------------------------------------------------------ */

/** Hangi mevsimlerde açıldığı. offering.ts: dönem verisi + müfredattaki yer. */
export type OfferingMap = ReadonlyMap<string, ReadonlySet<TermSeason>>;

export interface PlanTerm {
  startYear: number;          // akademik yılın başladığı yıl: 2026-2027 Bahar -> 2026
  season: "guz" | "bahar";
  /** "2027 Bahar" gibi takvim yılıyla etiket. */
  label: string;
  requirementIds: string[];
  credits: number;
  /** Erasmus dönemi: Özyeğin'de ders yok; yalnızca yurt dışında alınıp saydırılacak seçmeliler. */
  erasmus?: true;
}

export interface PlanResult {
  terms: PlanTerm[];
  /** Hiçbir döneme yerleşemeyenler (ön koşul döngüsü, hiç açılmıyor, vb.) ve nedeni. */
  unplaced: { requirementId: string; reason: "prerequisite" | "notOffered" | "unknown" }[];
  /** Son dönemin etiketi; her şey yerleştiyse tahmini mezuniyet. */
  graduation: string | null;
}

export interface PlanOptions {
  /** İlk plan dönemi. */
  start: { startYear: number; season: "guz" | "bahar" };
  /** Dönem başına en fazla AKTS. */
  maxCredits: number;
  /** Güvenlik sınırı; varsayılan 16 dönem. */
  maxTerms?: number;
  /** Yurt dışında geçirilecek dönem ve orada saydırılacak en fazla AKTS (yalnızca seçmeliler). */
  erasmus?: { term: { startYear: number; season: "guz" | "bahar" }; ects: number };
}

/*
 * offering.ts dışa aktarır:
 *   buildOfferingMap(terms: TermData[], programs: RoadmapProgram[]): OfferingMap
 *     // bir ders dönem verisinde varsa o mevsim; hiçbir dönem verisinde yoksa müfredattaki slot mevsimi;
 *     // o da yoksa (yandal) iki mevsim de.
 *
 * plan.ts dışa aktarır:
 *   buildPlan(programs: RoadmapProgram[], completion: Completion, offering: OfferingMap, options: PlanOptions): PlanResult
 *     // Açgözlü: kalan gereksinimler müfredat sırasıyla (slot yıl/mevsim, sonra yandal) dönemlere;
 *     // bir ders ancak ön koşulu ÖNCEKİ dönemlerde tamamlananlarla sağlanıyorsa (null = unknown sayılır ve
 *     // yerleştirilir) ve o mevsim açılıyorsa yerleşir. Aynı kodlu gereksinimler tek ders olarak yerleşir.
 *     // Seçmeliler kendi slot mevsiminde (yandalda iki mevsimde de) yer bulur, ön koşulu yoktur.
 *     // Yan koşullu dersler (corequisites) aynı döneme konur, krediye sayılmaz.
 *
 * critical.ts dışa aktarır:
 *   criticalCourses(programs: RoadmapProgram[], completion: Completion):
 *     { code: string; blocks: string[] }[]   // kalan bir dersi ön koşul olarak bekleyen kalan dersler (dolaylı dahil), çoktan aza
 *   unreadablePrerequisites(programs: RoadmapProgram[], completion: Completion):
 *     { requirementId: string; code: string; text: string }[]
 */

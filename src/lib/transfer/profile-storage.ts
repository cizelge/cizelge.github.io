// Geçiş sayfasının tarayıcıda kalan öğrenci bilgileri ve yol haritası kaydından ön doldurma.
// Okurken her alan doğrulanır; bozuk kayıt sayfayı kırmaz, boş bilgiye döner.
import { computeGpa, gradeEntries } from "../roadmap/gpa";
import { passedEcts } from "../roadmap/progress";
import type { RoadmapState } from "../roadmap/storage";
import type { RoadmapProgram } from "../roadmap/types";
import type { Program } from "../types";
import type { ScoreType, StudentProfile } from "./types";

export const PROFILE_KEY = "gecis:ozyegin";

export const SCORE_TYPES: readonly ScoreType[] = ["SAY", "EA", "SÖZ", "DİL"];

export const EMPTY_PROFILE: StudentProfile = {
  programId: null,
  gpa: null,
  completedSemesters: null,
  completedCredits: null,
  hasFailedCourse: null,
  entryYear: null,
  scoreType: null,
  score: null,
  rank: null,
  top20: null,
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const numberIn = (v: unknown, min: number, max: number, integer = false): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v)) ? v : null;

const boolOrNull = (v: unknown) => (typeof v === "boolean" ? v : null);

/** Alan sınırları: arayüzdeki doğrulama da bunları kullanır. */
export const LIMITS = {
  gpa: { min: 0, max: 4 },
  completedSemesters: { min: 0, max: 8 },
  completedCredits: { min: 0, max: 400 },
  entryYear: { min: 2000, max: 2100 },
  score: { min: 0, max: 600 },
  rank: { min: 1, max: 5_000_000 },
} as const;

export function validateProfile(raw: unknown): StudentProfile {
  if (!isRecord(raw) || raw.version !== 1) return { ...EMPTY_PROFILE };
  const scoreType = SCORE_TYPES.includes(raw.scoreType as ScoreType) ? (raw.scoreType as ScoreType) : null;
  return {
    programId: typeof raw.programId === "string" && raw.programId.trim() !== "" ? raw.programId : null,
    gpa: numberIn(raw.gpa, LIMITS.gpa.min, LIMITS.gpa.max),
    completedSemesters: numberIn(raw.completedSemesters, LIMITS.completedSemesters.min, LIMITS.completedSemesters.max, true),
    completedCredits: numberIn(raw.completedCredits, LIMITS.completedCredits.min, LIMITS.completedCredits.max),
    hasFailedCourse: boolOrNull(raw.hasFailedCourse),
    entryYear: numberIn(raw.entryYear, LIMITS.entryYear.min, LIMITS.entryYear.max, true),
    scoreType,
    score: numberIn(raw.score, LIMITS.score.min, LIMITS.score.max),
    rank: numberIn(raw.rank, LIMITS.rank.min, LIMITS.rank.max, true),
    top20: boolOrNull(raw.top20),
  };
}

export function parseProfile(text: string | null): StudentProfile {
  if (!text) return { ...EMPTY_PROFILE };
  try {
    return validateProfile(JSON.parse(text));
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function serializeProfile(profile: StudentProfile): string {
  return JSON.stringify({ version: 1, ...profile });
}

export function loadProfile(): StudentProfile {
  try {
    return parseProfile(window.localStorage.getItem(PROFILE_KEY));
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveProfile(profile: StudentProfile): void {
  try {
    window.localStorage.setItem(PROFILE_KEY, serializeProfile(profile));
  } catch {
    /* gizli pencere, dolu depo vb.: sessizce geç */
  }
}

/* ------------------------------------------------------------------ */
/* Girdi okuma: "2,72", "125.000", "412,5"                              */
/* ------------------------------------------------------------------ */

/** Ondalık sayı; virgül de nokta da ondalık ayıracı olabilir. Boş ya da okunamazsa null. */
export function parseDecimalInput(text: string): number | null {
  const t = text.trim().replace(/\s+/g, "");
  if (!/^\d+([.,]\d*)?$/.test(t)) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Tam sayı; binlik ayıracı olarak nokta, virgül ya da boşluk olabilir ("125.000"). */
export function parseIntegerInput(text: string): number | null {
  const t = text.trim().replace(/[\s.,]/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Yol haritasından ön doldurma                                         */
/* ------------------------------------------------------------------ */

/** Gereksinim: [id, ders kodu, AKTS, havuzlu seçmeli mi]. Müfredatın tamamı istemciye gitmesin diye sıkıştırılmış. */
export type SlimRequirement = [id: string, code: string | null, credits: number | null, pooled: 0 | 1];

export interface PrefillIndex {
  programs: { id: string; name: string; reqs: SlimRequirement[] }[];
  /** Havuz derslerinin AKTS'si, ders koduna göre. */
  poolCredits: Record<string, number | null>;
}

/** Sunucuda çalışır: müfredatlardan yalnızca not ortalaması ve AKTS hesabı için gerekenler. */
export function buildPrefillIndex(programs: readonly Program[]): PrefillIndex {
  const poolCredits: Record<string, number | null> = {};
  const out: PrefillIndex["programs"] = [];
  for (const p of programs) {
    const reqs: SlimRequirement[] = [];
    for (const sem of p.semesters) {
      sem.items.forEach((item, index) => {
        const id = `${p.id}:y${sem.year}-${sem.season}:${index}`;
        if (item.kind === "course") {
          reqs.push([id, item.code, item.credits, 0]);
        } else {
          reqs.push([id, null, item.credits, item.pool ? 1 : 0]);
          for (const c of item.pool ?? []) if (!(c.code in poolCredits)) poolCredits[c.code] = c.credits;
        }
      });
    }
    out.push({ id: p.id, name: p.name, reqs });
  }
  return { programs: out, poolCredits };
}

/** Sıkıştırılmış müfredatı yol haritası hesaplarının beklediği biçime geri çevirir (yalnızca işaretli havuz dersleri). */
function toRoadmapProgram(
  program: PrefillIndex["programs"][number],
  kind: "anadal" | "cap",
  state: RoadmapState,
  poolCredits: PrefillIndex["poolCredits"],
): RoadmapProgram {
  return {
    id: program.id,
    kind,
    name: program.name,
    totalCredits: 0,
    requirements: program.reqs.map(([id, code, credits, pooled]) => {
      const mark = state.completion[id];
      const pool =
        pooled === 1
          ? typeof mark === "string"
            ? [{ code: mark, title: "", credits: findPoolCredits(poolCredits, mark) }]
            : []
          : null;
      return {
        id,
        programId: program.id,
        kind: code !== null ? "course" : "elective",
        code,
        title: code ?? "",
        credits,
        prerequisites: "",
        corequisites: [],
        pool,
        slot: null,
      };
    }),
  };
}

function findPoolCredits(poolCredits: PrefillIndex["poolCredits"], code: string): number | null {
  if (code in poolCredits) return poolCredits[code];
  const compact = code.replace(/\s+/g, "").toLocaleUpperCase("en");
  for (const [k, v] of Object.entries(poolCredits)) if (k.replace(/\s+/g, "").toLocaleUpperCase("en") === compact) return v;
  return null;
}

/**
 * Yol haritası kaydından çıkarılabilen bilgiler. Saf fonksiyon.
 * programId: kayıtlı anadal; gpa: girilen notlardan; completedCredits: geçildi işaretli derslerin AKTS'si;
 * hasFailedCourse: F notu varsa true (F yoksa bilinmez, çünkü not girmek zorunlu değil).
 */
export function prefillFromRoadmap(state: RoadmapState, index: PrefillIndex): Partial<StudentProfile> {
  const out: Partial<StudentProfile> = {};
  const anadal = index.programs.find((p) => p.id === state.anadal);
  if (!anadal) return out;
  out.programId = anadal.id;

  const list = [toRoadmapProgram(anadal, "anadal", state, index.poolCredits)];
  const cap = index.programs.find((p) => p.id === state.cap && p.id !== anadal.id);
  if (cap) list.push(toRoadmapProgram(cap, "cap", state, index.poolCredits));

  const gpa = computeGpa(gradeEntries(list, state.completion, state.grades)).gpa;
  if (gpa !== null) out.gpa = gpa;

  const credits = passedEcts(list, state.completion);
  if (credits > 0) out.completedCredits = credits;

  if (Object.values(state.grades).some((g) => g === "F")) out.hasFailedCourse = true;
  return out;
}

/** Kullanıcının boş bıraktığı alanlar ön doldurmayla tamamlanır; `dismissed` alanlara dokunulmaz. */
export function mergeProfile(
  own: StudentProfile,
  prefill: Partial<StudentProfile>,
  dismissed: ReadonlySet<keyof StudentProfile> = new Set(),
): { profile: StudentProfile; prefilled: (keyof StudentProfile)[] } {
  const profile = { ...own };
  const prefilled: (keyof StudentProfile)[] = [];
  for (const key of Object.keys(prefill) as (keyof StudentProfile)[]) {
    const value = prefill[key];
    if (value === undefined || value === null || own[key] !== null || dismissed.has(key)) continue;
    (profile as Record<keyof StudentProfile, unknown>)[key] = value;
    prefilled.push(key);
  }
  return { profile, prefilled };
}

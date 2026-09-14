// Erasmus sayfasının yol haritası kaydından ön doldurması ve tarayıcıda kalan öğrenci bilgileri.
// Ön doldurma saf fonksiyondur; kayıt okuma her alanı doğrular, bozuk kayıt sayfayı kırmaz.
import { computeGpa, gradeEntries } from "../roadmap/gpa";
import { canonicalCode, isDone, passedCodes, passedEcts } from "../roadmap/progress";
import { programRequirements } from "../roadmap/requirements";
import type { RoadmapState } from "../roadmap/storage";
import type { RoadmapProgram } from "../roadmap/types";
import type { PlanSeason, Program } from "../types";

/* ------------------------------------------------------------------ */
/* Sunucuda: müfredatların istemciye gidecek hafif hâli                 */
/* ------------------------------------------------------------------ */

/**
 * Ön koşul metinleri ve havuz dersi adları çıkarılır; eşleştirme için kod, ad, AKTS ve seçmeli etiketi kalır.
 * Gereksinim id'leri (program:yıl-mevsim:sıra) değişmez, çünkü müfredat sırası korunur.
 */
export function slimPrograms(programs: readonly Program[]): Program[] {
  return programs.map((p) => ({
    id: p.id,
    slug: "",
    name: p.name,
    faculty: p.faculty,
    semesters: p.semesters.map((s) => ({
      year: s.year,
      season: s.season,
      label: "",
      credits: s.credits,
      items: s.items.map((item) =>
        item.kind === "course"
          ? { kind: "course" as const, code: item.code, title: item.title, credits: item.credits, prerequisites: "", corequisites: [] }
          : {
              kind: "elective" as const,
              label: item.label,
              credits: item.credits,
              pool: item.pool ? item.pool.map((c) => ({ code: c.code, title: "", credits: c.credits })) : null,
            },
      ),
    })),
  }));
}

/* ------------------------------------------------------------------ */
/* Yol haritasından ön doldurma                                         */
/* ------------------------------------------------------------------ */

export interface RemainingRequirement {
  /** Yol haritası Requirement.id. */
  id: string;
  code: string | null;
  title: string;
  credits: number | null;
  programName: string;
  /** Müfredattaki yer: "2. yıl Bahar"; aynı adlı seçmelileri ayırmak için. */
  slotLabel: string | null;
}

export interface ErasmusPrefill {
  /** Kayıtlı bir anadal var mı (yoksa eşleştirme yalnızca ders koduyla yapılır). */
  hasRoadmap: boolean;
  /** "Bilgisayar Mühendisliği" ya da "Bilgisayar Mühendisliği ve Matematik (ÇAP)". */
  programName: string | null;
  gpa: number | null;
  /** Geçildi işaretli derslerin AKTS'si; hiç yoksa null. */
  ects: number | null;
  /** Anadal, sonra çift anadal; tamamlanmamış gereksinimler müfredat sırasıyla. Hazırlık yılı dahil değil. */
  remainingRequirements: RemainingRequirement[];
}

export const EMPTY_PREFILL: ErasmusPrefill = { hasRoadmap: false, programName: null, gpa: null, ects: null, remainingRequirements: [] };

const SEASON_LABEL: Record<PlanSeason, string> = { guz: "Güz", bahar: "Bahar", yaz: "Yaz", other: "" };

function slotLabel(slot: { year: number; season: PlanSeason } | null): string | null {
  if (!slot || slot.year <= 0) return null;
  const season = SEASON_LABEL[slot.season];
  return season ? `${slot.year}. yıl ${season}` : `${slot.year}. yıl`;
}

/** Saf fonksiyon: yol haritası durumu ve müfredatlardan ortalama, AKTS ve kalan gereksinimler. Yandal hesaba katılmaz. */
export function erasmusPrefill(state: RoadmapState, programs: readonly Program[]): ErasmusPrefill {
  const anadal = programs.find((p) => p.id === state.anadal);
  if (!anadal) return { ...EMPTY_PREFILL, remainingRequirements: [] };

  const list: RoadmapProgram[] = [programRequirements(anadal, "anadal")];
  const cap = programs.find((p) => p.id === state.cap && p.id !== anadal.id);
  if (cap) list.push(programRequirements(cap, "cap"));

  const gpa = computeGpa(gradeEntries(list, state.completion, state.grades)).gpa;
  const ects = passedEcts(list, state.completion);
  const passed = passedCodes(list, state.completion);

  const remaining: RemainingRequirement[] = [];
  const seenCodes = new Set<string>();
  for (const program of list) {
    for (const req of program.requirements) {
      if (req.slot && req.slot.year === 0) continue; // hazırlık yurt dışında alınmaz
      if (isDone(req, state.completion, passed)) continue;
      if (req.kind === "course" && req.code) {
        // Aynı ders iki programda da varsa bir kez listelenir.
        const key = canonicalCode(req.code);
        if (seenCodes.has(key)) continue;
        seenCodes.add(key);
      }
      remaining.push({
        id: req.id,
        code: req.code,
        title: req.title,
        credits: req.credits,
        programName: program.name,
        slotLabel: slotLabel(req.slot),
      });
    }
  }

  return {
    hasRoadmap: true,
    programName: cap ? `${anadal.name} ve ${cap.name} (ÇAP)` : anadal.name,
    gpa,
    ects: ects > 0 ? ects : null,
    remainingRequirements: remaining,
  };
}

/** Elle yazılan ders kodunun AKTS'si: müfredat derslerinde ya da seçmeli havuzlarında bu kod varsa. */
export function buildCodeCredits(programs: readonly Program[]): Map<string, number> {
  const out = new Map<string, number>();
  const add = (code: string, credits: number | null) => {
    const key = canonicalCode(code);
    if (credits !== null && credits > 0 && !out.has(key)) out.set(key, credits);
  };
  for (const p of programs) {
    for (const s of p.semesters) {
      for (const item of s.items) {
        if (item.kind === "course") add(item.code, item.credits);
        else for (const c of item.pool ?? []) add(c.code, c.credits);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tarayıcıda kalan öğrenci bilgileri                                   */
/* ------------------------------------------------------------------ */

export const ERASMUS_PROFILE_KEY = "erasmus-bilgi:ozyegin";

export interface ErasmusProfile {
  gpa: number | null;
  ects: number | null;
  ele: number | null;
  /** Kriter id -> adet (perCount değilse 0/1). */
  criteria: Record<string, number>;
  target: number | null;
  grant: { group: string | null; months: number | null; km: number | null; green: boolean; disadvantaged: boolean };
}

export const EMPTY_ERASMUS_PROFILE: ErasmusProfile = {
  gpa: null,
  ects: null,
  ele: null,
  criteria: {},
  target: null,
  grant: { group: null, months: null, km: null, green: false, disadvantaged: false },
};

export const ERASMUS_LIMITS = {
  gpa: { min: 0, max: 4 },
  ects: { min: 0, max: 400 },
  ele: { min: 0, max: 100 },
  target: { min: 0, max: 200 },
  count: { min: 0, max: 9 },
  months: { min: 1, max: 12 },
  km: { min: 0, max: 40_000 },
} as const;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const numberIn = (v: unknown, lim: { min: number; max: number }, integer = false): number | null =>
  typeof v === "number" && Number.isFinite(v) && v >= lim.min && v <= lim.max && (!integer || Number.isInteger(v)) ? v : null;

export function validateErasmusProfile(raw: unknown): ErasmusProfile {
  if (!isRecord(raw) || raw.version !== 1) return { ...EMPTY_ERASMUS_PROFILE, criteria: {}, grant: { ...EMPTY_ERASMUS_PROFILE.grant } };
  const criteria: Record<string, number> = {};
  if (isRecord(raw.criteria)) {
    for (const [id, v] of Object.entries(raw.criteria)) {
      const n = numberIn(v, ERASMUS_LIMITS.count, true);
      if (n !== null && n > 0) criteria[id] = n;
    }
  }
  const g = isRecord(raw.grant) ? raw.grant : {};
  return {
    gpa: numberIn(raw.gpa, ERASMUS_LIMITS.gpa),
    ects: numberIn(raw.ects, ERASMUS_LIMITS.ects),
    ele: numberIn(raw.ele, ERASMUS_LIMITS.ele),
    criteria,
    target: numberIn(raw.target, ERASMUS_LIMITS.target),
    grant: {
      group: typeof g.group === "string" && g.group.trim() !== "" ? g.group : null,
      months: numberIn(g.months, ERASMUS_LIMITS.months, true),
      km: numberIn(g.km, ERASMUS_LIMITS.km),
      green: g.green === true,
      disadvantaged: g.disadvantaged === true,
    },
  };
}

export function parseErasmusProfile(text: string | null): ErasmusProfile {
  if (!text) return validateErasmusProfile(null);
  try {
    return validateErasmusProfile(JSON.parse(text));
  } catch {
    return validateErasmusProfile(null);
  }
}

export function serializeErasmusProfile(profile: ErasmusProfile): string {
  return JSON.stringify({ version: 1, ...profile });
}

export function loadErasmusProfile(): ErasmusProfile {
  try {
    return parseErasmusProfile(window.localStorage.getItem(ERASMUS_PROFILE_KEY));
  } catch {
    return validateErasmusProfile(null);
  }
}

export function saveErasmusProfile(profile: ErasmusProfile): void {
  try {
    window.localStorage.setItem(ERASMUS_PROFILE_KEY, serializeErasmusProfile(profile));
  } catch {
    /* gizli pencere, dolu depo vb.: sessizce geç */
  }
}

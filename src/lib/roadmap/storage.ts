// Yol haritası sayfasının tarayıcıda kalan durumu. Okurken her alan doğrulanır;
// bozuk ya da eski bir kayıt sayfayı kırmaz, varsayılana döner.
import type { TermSeason } from "../terms";
import { isGrade, type Grades } from "./gpa";
import type { Completion } from "./types";

export const STORAGE_KEY = "yol-haritasi:ozyegin";

export type StartSeason = "guz" | "bahar";

export interface RoadmapState {
  version: 1;
  anadal: string | null;
  cap: string | null;
  yandal: string | null;
  /** Müfredatta başlanacak dönem (1. yıl Güz gibi); null = varsayılan. */
  start: { year: number; season: StartSeason } | null;
  completion: Completion;
  /** Gereksinim id -> son harf notu (isteğe bağlı). */
  grades: Grades;
  maxCredits: number;
  /** Yurt dışında geçirilecek takvim dönemi ve orada saydırılacak AKTS; null = Erasmus yok. */
  erasmus: { term: { startYear: number; season: StartSeason }; ects: number } | null;
}

export const ERASMUS_MIN_ECTS = 0;
export const ERASMUS_MAX_ECTS = 42;

export const DEFAULT_START = { year: 1, season: "guz" as StartSeason };
export const CREDIT_CHOICES = [30, 35, 40, 45] as const;
export const DEFAULT_MAX_CREDITS = 30;
const MIN_CREDITS = 10;
const MAX_CREDITS = 60;

export const EMPTY_STATE: RoadmapState = {
  version: 1,
  anadal: null,
  cap: null,
  yandal: null,
  start: null,
  completion: {},
  grades: {},
  maxCredits: DEFAULT_MAX_CREDITS,
  erasmus: null,
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const idOrNull = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Bilinmeyen biçimi olabildiğince kurtarır; kurtarılamayan alan varsayılana döner. */
export function validateState(raw: unknown): RoadmapState {
  if (!isRecord(raw) || raw.version !== 1) return { ...EMPTY_STATE, completion: {}, grades: {} };

  const anadal = idOrNull(raw.anadal);
  const capRaw = idOrNull(raw.cap);
  const cap = capRaw !== null && capRaw !== anadal ? capRaw : null;

  let start: RoadmapState["start"] = null;
  if (isRecord(raw.start)) {
    const { year, season } = raw.start;
    if (typeof year === "number" && Number.isInteger(year) && year >= 0 && year <= 8 && (season === "guz" || season === "bahar")) {
      start = { year, season };
    }
  }

  const completion: Completion = {};
  if (isRecord(raw.completion)) {
    for (const [id, value] of Object.entries(raw.completion)) {
      if (value === true || (typeof value === "string" && value.trim() !== "")) completion[id] = value;
    }
  }

  // Notlar sonradan eklendi: eski kayıtlarda alan yok.
  const grades: Grades = {};
  if (isRecord(raw.grades)) {
    for (const [id, value] of Object.entries(raw.grades)) if (isGrade(value)) grades[id] = value;
  }

  const m = raw.maxCredits;
  const maxCredits =
    typeof m === "number" && Number.isFinite(m) && m >= MIN_CREDITS && m <= MAX_CREDITS ? Math.round(m) : DEFAULT_MAX_CREDITS;

  return { version: 1, anadal, cap, yandal: idOrNull(raw.yandal), start, completion, grades, maxCredits, erasmus: validErasmus(raw.erasmus) };
}

/** Erasmus sonradan eklendi: eski kayıtta alan yok; bozuksa null. */
function validErasmus(raw: unknown): RoadmapState["erasmus"] {
  if (!isRecord(raw) || !isRecord(raw.term)) return null;
  const { startYear, season } = raw.term;
  const { ects } = raw;
  if (typeof startYear !== "number" || !Number.isInteger(startYear) || startYear < 2000 || startYear > 2100) return null;
  if (season !== "guz" && season !== "bahar") return null;
  if (typeof ects !== "number" || !Number.isFinite(ects) || ects < ERASMUS_MIN_ECTS || ects > ERASMUS_MAX_ECTS) return null;
  return { term: { startYear, season }, ects: Math.round(ects) };
}

export function parseState(text: string | null): RoadmapState {
  if (!text) return validateState(null);
  try {
    return validateState(JSON.parse(text));
  } catch {
    return validateState(null);
  }
}

export function serializeState(state: RoadmapState): string {
  return JSON.stringify(state);
}

export function loadState(): RoadmapState {
  try {
    return parseState(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return validateState(null);
  }
}

export function saveState(state: RoadmapState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeState(state));
  } catch {
    /* gizli pencere, dolu depo vb.: sessizce geç */
  }
}

/**
 * Planın ilk takvim dönemi: şu anki dönemden itibaren seçilen mevsime ilk denk gelen dönem.
 * Şu an 2026-2027 Güz ise Güz -> 2026 Güz, Bahar -> 2026-2027 Bahar; şu an Bahar ise Güz bir sonraki yıla kayar.
 */
export function planStart(
  current: { startYear: number; season: TermSeason },
  season: StartSeason,
): { startYear: number; season: StartSeason } {
  if (current.season === "guz") return { startYear: current.startYear, season };
  if (current.season === "bahar") return { startYear: season === "guz" ? current.startYear + 1 : current.startYear, season };
  return { startYear: current.startYear + 1, season };
}

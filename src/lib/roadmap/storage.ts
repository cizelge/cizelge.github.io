// Yol haritası sayfasının tarayıcıda kalan durumu. Okurken her alan doğrulanır;
// bozuk ya da eski bir kayıt sayfayı kırmaz, varsayılana döner.
import type { TermSeason } from "../terms";
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
  maxCredits: number;
}

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
  maxCredits: DEFAULT_MAX_CREDITS,
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const idOrNull = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Bilinmeyen biçimi olabildiğince kurtarır; kurtarılamayan alan varsayılana döner. */
export function validateState(raw: unknown): RoadmapState {
  if (!isRecord(raw) || raw.version !== 1) return { ...EMPTY_STATE, completion: {} };

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

  const m = raw.maxCredits;
  const maxCredits =
    typeof m === "number" && Number.isFinite(m) && m >= MIN_CREDITS && m <= MAX_CREDITS ? Math.round(m) : DEFAULT_MAX_CREDITS;

  return { version: 1, anadal, cap, yandal: idOrNull(raw.yandal), start, completion, maxCredits };
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

// Planlayıcı durumu ve paylaşım linki biçimi.
// Link okunabilir kalsın diye sıkıştırma yok: ?d=CS101,MATH103&bos=5&kilit=CS101:B&haric=ENG101:C&w=21000&p=2
import type { Day, SectionRef, Weights } from "../engine";
import { normalizeCode } from "../engine";
import { parseTermLabel, SEASON_LABEL } from "../terms";

export interface PlannerState {
  /** Sepetteki ders kodları, eklenme sırasıyla ("CS 101"). */
  cart: string[];
  freeDays: Day[];
  locked: Record<string, string>;
  excluded: SectionRef[];
  weights: Weights;
  /** Seçili programın sıradaki yeri (0 = en iyi). */
  selected: number;
  /** Seçilen bölümün SIS program kodu ("BSCS"), seçilmediyse null. */
  program: string | null;
  /** Seçilen sınıf (0 = Hazırlık), seçilmediyse null. */
  year: number | null;
}

export const WEIGHT_KEYS = ["fewDays", "fewGaps", "lunchBreak", "noEarly", "noLate"] as const;

export const DEFAULT_WEIGHTS: Weights = { fewDays: 2, fewGaps: 2, lunchBreak: 1, noEarly: 1, noLate: 1 };

export const PRESETS: { id: string; label: string; weights: Weights }[] = [
  { id: "az-gun", label: "Az gün", weights: { fewDays: 3, fewGaps: 1, lunchBreak: 0, noEarly: 0, noLate: 0 } },
  { id: "sabah-yok", label: "Sabah yok", weights: { fewDays: 1, fewGaps: 1, lunchBreak: 1, noEarly: 3, noLate: 0 } },
  { id: "sikisik", label: "Boşluksuz", weights: { fewDays: 1, fewGaps: 3, lunchBreak: 0, noEarly: 0, noLate: 1 } },
];

export const EMPTY_STATE: PlannerState = {
  cart: [],
  freeDays: [],
  locked: {},
  excluded: [],
  weights: DEFAULT_WEIGHTS,
  selected: 0,
  program: null,
  year: null,
};

/** "CS101" ya da "cs 101" gibi yazımları verideki koda eşler. */
export function resolveCode(raw: string, knownCodes: readonly string[]): string | null {
  const key = normalizeCode(raw);
  return knownCodes.find((c) => normalizeCode(c) === key) ?? null;
}

const compact = (code: string) => code.replace(/\s+/g, "");

export function encodeState(s: PlannerState): string {
  const p = new URLSearchParams();
  if (s.cart.length) p.set("d", s.cart.map(compact).join(","));
  if (s.freeDays.length) p.set("bos", [...s.freeDays].sort().join(""));
  const locks = Object.entries(s.locked).filter(([code]) => s.cart.includes(code));
  if (locks.length) p.set("kilit", locks.map(([c, id]) => `${compact(c)}:${id}`).join(","));
  const ex = s.excluded.filter((e) => s.cart.includes(e.courseCode));
  if (ex.length) p.set("haric", ex.map((e) => `${compact(e.courseCode)}:${e.sectionId}`).join(","));
  const w = WEIGHT_KEYS.map((k) => s.weights[k]).join("");
  if (w !== WEIGHT_KEYS.map((k) => DEFAULT_WEIGHTS[k]).join("")) p.set("w", w);
  if (s.selected > 0) p.set("p", String(s.selected + 1));
  if (s.program) {
    p.set("bolum", s.program);
    if (s.year !== null) p.set("sinif", String(s.year));
  }
  return p.toString();
}

export interface DecodeResult {
  state: PlannerState;
  /** Linkte olup bu dönemde bulunamayan ders ya da şubeler. */
  missing: string[];
}

/**
 * `programs`: program kodu -> o programda bulunan yıllar. Verilmezse (müfredat verisi yok)
 * bolum/sinif sessizce yok sayılır.
 */
export function decodeState(
  query: string,
  sections: ReadonlyMap<string, readonly string[]>,
  programs?: ReadonlyMap<string, readonly number[]>,
): DecodeResult {
  const p = new URLSearchParams(query);
  const known = [...sections.keys()];
  const missing: string[] = [];

  const cart: string[] = [];
  for (const raw of (p.get("d") ?? "").split(",").filter(Boolean)) {
    const code = resolveCode(raw, known);
    if (!code) missing.push(raw);
    else if (!cart.includes(code)) cart.push(code);
  }

  const freeDays = [...new Set((p.get("bos") ?? "").split("").map(Number))].filter(
    (d): d is Day => d >= 1 && d <= 7,
  );

  const refs = (key: string): SectionRef[] => {
    const out: SectionRef[] = [];
    for (const pair of (p.get(key) ?? "").split(",").filter(Boolean)) {
      const [rawCode, sectionId] = pair.split(":");
      const code = rawCode ? resolveCode(rawCode, known) : null;
      if (code && sectionId && sections.get(code)?.includes(sectionId) && cart.includes(code)) {
        out.push({ courseCode: code, sectionId });
      } else {
        missing.push(pair);
      }
    }
    return out;
  };

  const locked = Object.fromEntries(refs("kilit").map((r) => [r.courseCode, r.sectionId]));
  const excluded = refs("haric");

  let weights = DEFAULT_WEIGHTS;
  const w = p.get("w");
  if (w && /^[0-3]{5}$/.test(w)) {
    weights = Object.fromEntries(WEIGHT_KEYS.map((k, i) => [k, Number(w[i])])) as unknown as Weights;
  }

  const pRaw = Number(p.get("p"));
  const selected = Number.isInteger(pRaw) && pRaw > 1 ? pRaw - 1 : 0;

  let program: string | null = null;
  let year: number | null = null;
  const bolum = p.get("bolum");
  if (bolum && programs) {
    const years = programs.get(bolum);
    if (!years) {
      missing.push(bolum);
    } else {
      program = bolum;
      const sinif = p.get("sinif");
      const y = sinif !== null && /^\d+$/.test(sinif) ? Number(sinif) : null;
      if (y !== null && years.includes(y)) year = y;
    }
  }

  return { state: { cart, freeDays, locked, excluded, weights, selected, program, year }, missing };
}

/**
 * Başka döneme geçerken taşınan link: dersler, boş günler, öncelikler, bölüm ve sınıf.
 * Şube kilitleri ve hariç tutulan şubeler döneme özgü olduğu için, seçili program sırası da anlamsız
 * kalacağı için taşınmaz.
 */
export function termSwitchQuery(s: PlannerState): string {
  return encodeState({ ...s, locked: {}, excluded: [], selected: 0 });
}

/** "CS101" -> "CS 101". */
const spacedCode = (raw: string) => raw.replace(/^(\p{Lu}+)\s*(\d.*)$/u, "$1 $2");

/**
 * decodeState'in `missing` listesinden kullanıcıya gösterilecek not. Ders kodları (rakam içerir),
 * şubeler ("CS101:B") ve bölüm kodları ayrı söylenir; açılmayan bir dersin şubeleri ayrıca sayılmaz.
 */
export function missingNotice(missing: readonly string[], termLabel: string): string | null {
  if (missing.length === 0) return null;
  const courses = missing.filter((m) => !m.includes(":") && /\d/.test(m));
  const missingKeys = new Set(courses.map(normalizeCode));
  const others = missing.filter(
    (m) => !courses.includes(m) && !(m.includes(":") && missingKeys.has(normalizeCode(m.split(":")[0]))),
  );

  let season: string | null = null;
  try {
    season = SEASON_LABEL[parseTermLabel(termLabel).season];
  } catch {
    season = null;
  }

  const parts: string[] = [];
  if (courses.length > 0) {
    parts.push(`${season ? `${season} döneminde` : "Bu dönem"} açılmayan dersler: ${courses.map(spacedCode).join(", ")}.`);
  }
  if (others.length > 0) parts.push(`Linkteki bazı şube ya da bölümler bu dönem yok: ${others.join(", ")}.`);
  parts.push("Geri kalanı yüklendi.");
  return parts.join(" ");
}

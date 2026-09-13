// Planlayıcı durumu ve paylaşım linki biçimi.
// Link okunabilir kalsın diye sıkıştırma yok: ?d=CS101,MATH103&bos=5&kilit=CS101:B&haric=ENG101:C&w=21000&p=2
import type { Day, SectionRef, Weights } from "../engine";
import { normalizeCode } from "../engine";

export interface PlannerState {
  /** Sepetteki ders kodları, eklenme sırasıyla ("CS 101"). */
  cart: string[];
  freeDays: Day[];
  locked: Record<string, string>;
  excluded: SectionRef[];
  weights: Weights;
  /** Seçili programın sıradaki yeri (0 = en iyi). */
  selected: number;
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
  return p.toString();
}

export interface DecodeResult {
  state: PlannerState;
  /** Linkte olup bu dönemde bulunamayan ders ya da şubeler. */
  missing: string[];
}

export function decodeState(
  query: string,
  sections: ReadonlyMap<string, readonly string[]>,
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

  return { state: { cart, freeDays, locked, excluded, weights, selected }, missing };
}

// Hangi ders hangi mevsimde açılır: dönem verisi, yoksa müfredattaki yer. Saf mantık.
import type { TermData } from "../types";
import { parseTermLabel, type TermSeason } from "../terms";
import { canonicalCode } from "./progress";
import type { OfferingMap, RoadmapProgram } from "./types";

const BOTH: TermSeason[] = ["guz", "bahar"];

function add(map: Map<string, Set<TermSeason>>, code: string, seasons: Iterable<TermSeason>) {
  let set = map.get(code);
  if (!set) map.set(code, (set = new Set()));
  for (const s of seasons) set.add(s);
}

/** Anahtarlar canonicalCode yazımıyla ("CS 101"). */
export function buildOfferingMap(terms: TermData[], programs: RoadmapProgram[]): OfferingMap {
  const fromData = new Map<string, Set<TermSeason>>();
  const covered = new Set<TermSeason>(); // verisi olan mevsimler
  for (const term of terms) {
    const season = parseTermLabel(term.termLabel).season;
    covered.add(season);
    // Saatsiz (yalnızca liste) dönem de "açılıyor" sayılır.
    for (const c of term.courses) add(fromData, canonicalCode(c.code), [season]);
  }

  // Müfredattaki yerden tahmin: slot mevsimi; slot yoksa ya da "other" ise Güz ve Bahar.
  const fallback = new Map<string, Set<TermSeason>>();
  for (const p of programs) {
    for (const r of p.requirements) {
      const seasons: TermSeason[] =
        r.slot && r.slot.season !== "other" ? [r.slot.season] : BOTH;
      if (r.kind === "course" && r.code) add(fallback, canonicalCode(r.code), seasons);
      for (const c of r.pool ?? []) add(fallback, canonicalCode(c.code), seasons);
    }
  }

  const out = new Map<string, Set<TermSeason>>();
  for (const [code, seasons] of fromData) out.set(code, new Set(seasons));
  for (const [code, seasons] of fallback) {
    const known = fromData.get(code);
    // Hiçbir dönemde yoksa tahmin; varsa tahmin yalnızca verisi olmayan mevsimleri tamamlar.
    add(out, code, known ? [...seasons].filter((s) => !covered.has(s)) : seasons);
  }
  return out;
}

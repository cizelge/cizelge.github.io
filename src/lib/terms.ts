// Dönem modeli: Özyeğin'in tutarsız dönem adlarını ("2026 - 2027 Güz", "2026 -2027 Bahar") okur,
// kimlik ve düzgün bir görünen ad üretir, dönemleri sıralar. Sunucuya da tarayıcıya da bağlı değildir.

export type TermSeason = "guz" | "bahar" | "yaz";

export const SEASONS: readonly TermSeason[] = ["guz", "bahar", "yaz"];

export const SEASON_LABEL: Record<TermSeason, string> = { guz: "Güz", bahar: "Bahar", yaz: "Yaz" };

export interface TermInfo {
  id: string;                    // "2026-2027-bahar"
  startYear: number;             // 2026
  season: TermSeason;
  label: string;                 // "2026 - 2027 Bahar"
}

export interface TermOption {
  id: string;
  label: string;
  /** Bu dönemin verisi yayında mı. */
  available: boolean;
  /** Varsayılan dönem (/<okul> adresinde gösterilen). */
  isDefault: boolean;
}

const LABEL_RE = /^(\d{4})\s*[-–—/]\s*(\d{4})\s+(\S+)$/;

const SEASON_WORDS: Record<string, TermSeason> = { güz: "guz", guz: "guz", bahar: "bahar", yaz: "yaz" };

export function academicYearLabel(startYear: number): string {
  return `${startYear} - ${startYear + 1}`;
}

export function termInfo(startYear: number, season: TermSeason): TermInfo {
  return {
    id: `${startYear}-${startYear + 1}-${season}`,
    startYear,
    season,
    label: `${academicYearLabel(startYear)} ${SEASON_LABEL[season]}`,
  };
}

/** "2026 -2027 Bahar" -> { id: "2026-2027-bahar", startYear: 2026, season: "bahar", label: "2026 - 2027 Bahar" }. */
export function parseTermLabel(label: string): TermInfo {
  const m = label.trim().replace(/\s+/g, " ").match(LABEL_RE);
  const season = m ? SEASON_WORDS[m[3].toLocaleLowerCase("tr")] : undefined;
  if (!m || !season) {
    throw new Error(`Dönem adı okunamadı: "${label}" (beklenen biçim: "2026 - 2027 Güz", "Bahar" ya da "Yaz")`);
  }
  const start = Number(m[1]);
  if (Number(m[2]) !== start + 1) {
    throw new Error(`Dönem adındaki yıllar ardışık değil: "${label}"`);
  }
  return termInfo(start, season);
}

export function compareTerms(a: TermInfo, b: TermInfo): number {
  return a.startYear - b.startYear || SEASONS.indexOf(a.season) - SEASONS.indexOf(b.season);
}

/** Sıralamada en son gelen dönem. */
export function defaultTerm(terms: readonly TermInfo[]): TermInfo {
  if (terms.length === 0) throw new Error("Hiç dönem yok");
  return [...terms].sort(compareTerms).at(-1)!;
}

/** Varsayılan dönem okulun ana sayfasında, diğerleri /<okul>/donem/<id> altında. */
export function termPath(schoolId: string, term: { id: string; isDefault: boolean }): string {
  return term.isDefault ? `/${schoolId}` : `/${schoolId}/donem/${term.id}`;
}

/**
 * Varsayılan dönemin akademik yılı için Güz, Bahar, Yaz; ardından başka yıllardan yayındaki dönemler
 * (eskiden yeniye).
 */
export function buildTermOptions(available: readonly TermInfo[]): TermOption[] {
  if (available.length === 0) return [];
  const def = defaultTerm(available);
  const ids = new Set(available.map((t) => t.id));
  const option = (t: TermInfo): TermOption => ({
    id: t.id,
    label: t.label,
    available: ids.has(t.id),
    isDefault: t.id === def.id,
  });
  const year = SEASONS.map((s) => option(termInfo(def.startYear, s)));
  const others = [...available]
    .filter((t) => t.startYear !== def.startYear)
    .sort(compareTerms)
    .map(option);
  return [...year, ...others];
}

/**
 * Dönem dosyalarını eskiden yeniye sıralar ve adlarını düzgün yazımla değiştirir.
 * Okunamayan ad, adla uyuşmayan kimlik ya da aynı döneme ait iki dosya hatadır.
 */
export function sortTermData<T extends { termId: string; termLabel: string }>(terms: readonly T[]): T[] {
  const seen = new Set<string>();
  const parsed = terms.map((t) => {
    const info = parseTermLabel(t.termLabel);
    if (info.id !== t.termId) {
      throw new Error(`Dönem kimliği "${t.termId}" dönem adıyla ("${t.termLabel}") uyuşmuyor, "${info.id}" olmalı`);
    }
    if (seen.has(info.id)) throw new Error(`${info.id} dönemi için birden çok dosya var`);
    seen.add(info.id);
    return { term: { ...t, termLabel: info.label }, info };
  });
  return parsed.sort((a, b) => compareTerms(a.info, b.info)).map((p) => p.term);
}

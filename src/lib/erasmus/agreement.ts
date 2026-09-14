// Erasmus ders eşleştirme taslağı (Learning Agreement öncesi çalışma). Tarayıcıda saklanır;
// okurken her alan doğrulanır, bozuk satır atılır, bozuk kayıt boş taslağa döner.
import type { AgreementDraft, AgreementRow } from "./types";

export const DRAFT_KEY = "erasmus:ozyegin";

export const emptyDraft = (): AgreementDraft => ({ version: 1, hostUniversity: "", term: null, rows: [] });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function validateMatch(raw: unknown): AgreementRow["match"] {
  if (!isRecord(raw)) return null;
  if (raw.kind === "requirement" && typeof raw.requirementId === "string" && raw.requirementId.trim() !== "") {
    return { kind: "requirement", requirementId: raw.requirementId };
  }
  if (raw.kind === "code" && typeof raw.code === "string" && raw.code.trim() !== "") {
    return { kind: "code", code: raw.code };
  }
  return null;
}

function validateRow(raw: unknown, index: number, seen: Set<string>): AgreementRow | null {
  if (!isRecord(raw)) return null;
  // id yoksa ya da tekrarlıyorsa yeni id verilir: satır kaybolmasın.
  let id = typeof raw.id === "string" && raw.id.trim() !== "" ? raw.id : `row-${index + 1}`;
  while (seen.has(id)) id = `${id}-${index + 1}`;
  seen.add(id);
  const e = raw.hostEcts;
  const hostEcts = typeof e === "number" && Number.isFinite(e) && e >= 0 && e <= 60 ? e : null;
  return { id, hostCode: str(raw.hostCode), hostTitle: str(raw.hostTitle), hostEcts, match: validateMatch(raw.match) };
}

/** Bilinmeyen biçimi olabildiğince kurtarır. */
export function validateDraft(raw: unknown): AgreementDraft {
  if (!isRecord(raw) || raw.version !== 1) return emptyDraft();

  let term: AgreementDraft["term"] = null;
  if (isRecord(raw.term)) {
    const { startYear, season } = raw.term;
    if (typeof startYear === "number" && Number.isInteger(startYear) && startYear >= 2000 && startYear <= 2100 && (season === "guz" || season === "bahar")) {
      term = { startYear, season };
    }
  }

  const rows: AgreementRow[] = [];
  if (Array.isArray(raw.rows)) {
    const seen = new Set<string>();
    raw.rows.forEach((r, i) => {
      const row = validateRow(r, i, seen);
      if (row) rows.push(row);
    });
  }
  return { version: 1, hostUniversity: str(raw.hostUniversity), term, rows };
}

export function loadDraft(): AgreementDraft {
  try {
    const text = window.localStorage.getItem(DRAFT_KEY);
    return text ? validateDraft(JSON.parse(text)) : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

export function saveDraft(d: AgreementDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* gizli pencere, dolu depo vb.: sessizce geç */
  }
}

/**
 * Toplamlar: karşı okulun AKTS'si, eşlenen Özyeğin derslerinin AKTS'si ve eşlenmemiş satır sayısı.
 * Aynı gereksinim/kod birden çok satırda eşlenirse bir kez sayılır; AKTS'si bilinmeyen eşleşme toplama girmez.
 */
export function draftTotals(
  d: AgreementDraft,
  lookupCredits: (m: NonNullable<AgreementRow["match"]>) => number | null,
): { hostEcts: number; matchedOzuEcts: number; unmatchedRows: number } {
  let hostEcts = 0;
  let matchedOzuEcts = 0;
  let unmatchedRows = 0;
  const counted = new Set<string>();
  for (const row of d.rows) {
    hostEcts += row.hostEcts ?? 0;
    if (!row.match) {
      unmatchedRows++;
      continue;
    }
    const key = row.match.kind === "requirement" ? `r:${row.match.requirementId}` : `c:${row.match.code.replace(/\s+/g, "").toUpperCase()}`;
    if (counted.has(key)) continue;
    counted.add(key);
    let credits: number | null = null;
    try {
      credits = lookupCredits(row.match);
    } catch {
      credits = null;
    }
    if (typeof credits === "number" && Number.isFinite(credits) && credits > 0) matchedOzuEcts += credits;
  }
  return { hostEcts: Math.round(hostEcts * 100) / 100, matchedOzuEcts: Math.round(matchedOzuEcts * 100) / 100, unmatchedRows };
}

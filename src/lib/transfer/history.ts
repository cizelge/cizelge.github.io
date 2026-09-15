/**
 * Historical application outcomes for Özyeğin internal transfer, central-score
 * transfer, double major (ÇAP) and minor (yandal).
 *
 * Data: data/ozyegin/transfer-history.json (aggregate counts only, no personal data).
 * Sources and parsing notes: scrapers/ozyegin/transfer-history-sources.md.
 */

export type TransferHistoryPath = "cap" | "yandal" | "internal" | "central";

export interface TransferHistoryProgram {
  /** programs.json `programs[].id`, or null when the name has no programme match. */
  programId: string | null;
  name: string;
  /** Rows for this programme; every preference row counts. */
  applications: number;
  /** Rows with preference order 1. Null when the source PDF has no preference column. */
  firstChoice: number | null;
  /** KABUL */
  accepted: number;
  /** ŞARTLI KABUL */
  conditional: number;
  /** RET / RED */
  rejected: number;
  /** Anything else (e.g. "DEĞERLENDİRME DEVAM EDİYOR", "UYGUN"). */
  other: number;
}

export interface TransferHistoryTerm {
  /** e.g. "2023-2024 Güz" */
  term: string;
  /** e.g. "202310" (YYYY10 = Güz, YYYY20 = Bahar of academic year YYYY-YYYY+1) */
  termCode: string;
  path: TransferHistoryPath;
  programs: TransferHistoryProgram[];
}

export interface TransferHistorySource {
  term: string;
  path: TransferHistoryPath;
  url: string;
}

export interface TransferHistoryData {
  schoolId: string;
  fetchedAt: string;
  sources: TransferHistorySource[];
  terms: TransferHistoryTerm[];
}

export interface TransferHistoryRow {
  term: string;
  termCode: string;
  path: TransferHistoryPath;
  name: string;
  applications: number;
  firstChoice: number | null;
  accepted: number;
  conditional: number;
  rejected: number;
  other: number;
  /** (accepted + conditional) / applications; null when applications is 0. */
  rate: number | null;
}

export interface TransferHistorySummary {
  terms: number;
  applications: number;
  accepted: number;
  conditional: number;
  rejected: number;
  rate: number | null;
}

function rateOf(accepted: number, conditional: number, applications: number): number | null {
  return applications > 0 ? (accepted + conditional) / applications : null;
}

/** Rows for one programme and path, newest term first. */
export function historyFor(
  programId: string,
  path: TransferHistoryPath,
  data: TransferHistoryData,
): TransferHistoryRow[] {
  const rows: TransferHistoryRow[] = [];
  for (const t of data.terms) {
    if (t.path !== path) continue;
    for (const p of t.programs) {
      if (p.programId !== programId) continue;
      rows.push({
        term: t.term,
        termCode: t.termCode,
        path: t.path,
        name: p.name,
        applications: p.applications,
        firstChoice: p.firstChoice,
        accepted: p.accepted,
        conditional: p.conditional,
        rejected: p.rejected,
        other: p.other,
        rate: rateOf(p.accepted, p.conditional, p.applications),
      });
    }
  }
  return rows.sort((a, b) => b.termCode.localeCompare(a.termCode));
}

/** Totals over all terms for one programme and path. */
export function summary(
  programId: string,
  path: TransferHistoryPath,
  data: TransferHistoryData,
): TransferHistorySummary {
  const rows = historyFor(programId, path, data);
  const s = rows.reduce(
    (acc, r) => {
      acc.applications += r.applications;
      acc.accepted += r.accepted;
      acc.conditional += r.conditional;
      acc.rejected += r.rejected;
      return acc;
    },
    { applications: 0, accepted: 0, conditional: 0, rejected: 0 },
  );
  return {
    terms: new Set(rows.map((r) => r.termCode)).size,
    ...s,
    rate: rateOf(s.accepted, s.conditional, s.applications),
  };
}

/** Sayfaya gönderilen küçük özet: bölüm -> yol -> toplamlar ve dönem satırları (yeniden eskiye). */
export type HistoryIndex = Record<
  string,
  Partial<Record<TransferHistoryPath, TransferHistorySummary & { rows: Pick<TransferHistoryRow, "term" | "applications" | "accepted" | "conditional" | "rate">[] }>>
>;

export function buildHistoryIndex(data: TransferHistoryData | null): HistoryIndex {
  const out: HistoryIndex = {};
  if (!data) return out;
  const paths: TransferHistoryPath[] = ["cap", "yandal", "internal", "central"];
  const ids = new Set<string>();
  for (const t of data.terms) for (const p of t.programs) if (p.programId) ids.add(p.programId);
  for (const id of ids) {
    for (const path of paths) {
      const rows = historyFor(id, path, data);
      if (rows.length === 0) continue;
      (out[id] ??= {})[path] = {
        ...summary(id, path, data),
        rows: rows.map(({ term, applications, accepted, conditional, rate }) => ({ term, applications, accepted, conditional, rate })),
      };
    }
  }
  return out;
}

"use client";

import type { HistoryIndex } from "@/lib/transfer/history";
import type { BaseScore, CheckStatus, PathResult, QuotaByYear, TransferProgram } from "@/lib/transfer/types";
import { verdictFor, type Verdict, type VerdictLevel } from "@/lib/transfer/verdict";

export type PathKey = "internal" | "central" | "cap" | "yandal";

export interface Evaluation {
  program: TransferProgram;
  internal: PathResult;
  central: PathResult;
  cap: PathResult;
  yandal: PathResult;
}

export const PATH_LABELS: Record<PathKey, string> = {
  internal: "Yatay geçiş",
  central: "Merkezi puan",
  cap: "Çift anadal",
  yandal: "Yandal",
};

/** Pildeki kısa cevap. */
export const VERDICT_SHORT: Record<VerdictLevel, string> = {
  likely: "büyük ihtimalle olur",
  maybe: "olabilir",
  hard: "zor",
  no: "olmaz",
  eligible: "şartlar tamam",
  unknown: "bilgi eksik",
};

const VERDICT_ICON: Record<VerdictLevel, string> = { likely: "✓", maybe: "✓", hard: "!", no: "✕", eligible: "✓", unknown: "?" };

const PATH_TITLES: Record<PathKey, string> = {
  internal: "Kurum içi yatay geçiş",
  central: "Merkezi puanla yatay geçiş",
  cap: "Çift anadal",
  yandal: "Yandal",
};

const ICONS: Record<CheckStatus, string> = { ok: "✓", fail: "✕", unknown: "?" };

export const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: "uygun",
  fail: "eksik şart",
  unknown: "kontrol edilemedi",
};

const num = (n: number, digits = 5) => n.toLocaleString("tr-TR", { maximumFractionDigits: digits });
/** YKS puanı: kaynaktaki gibi en fazla beş ondalık, uygunluk cümleleriyle aynı yazım. */
const score = (n: number) => num(n, 5);
const ALL_PATHS: PathKey[] = ["cap", "yandal", "internal", "central"];

const LEVELS: (keyof QuotaByYear)[] = ["hazirlik", "1", "2", "3", "4"];
const levelLabel = (l: keyof QuotaByYear) => (l === "hazirlik" ? "Hazırlık" : `${l}. sınıf`);

/** Puanı ya da sırası yayınlanmış en yeni yılın en düşük puanı ve en düşük (büyük) sırası, burs türlerinin hepsi arasından. */
function latestBase(rows: readonly BaseScore[]): { year: number; minScore: number | null; minRank: number | null } | null {
  const published = rows.filter((r) => r.minScore !== null || r.minRank !== null);
  if (published.length === 0) return null;
  const year = Math.max(...published.map((r) => r.year));
  const same = published.filter((r) => r.year === year);
  const scores = same.map((r) => r.minScore).filter((v): v is number => v !== null);
  const ranks = same.map((r) => r.minRank).filter((v): v is number => v !== null);
  return {
    year,
    minScore: scores.length ? Math.min(...scores) : null,
    minRank: ranks.length ? Math.max(...ranks) : null,
  };
}

function StatusPill({ path, result, verdict }: { path: PathKey; result: PathResult; verdict: Verdict }) {
  return (
    <span className="gc-pill gc-verdict" data-level={verdict.level}>
      <span className="gc-pill-icon" aria-hidden="true">
        {VERDICT_ICON[verdict.level]}
      </span>
      <span className="gc-pill-label">{PATH_LABELS[path]}: </span>
      {VERDICT_SHORT[verdict.level]}
      {result.quota !== null && (
        <span className="gc-pill-quota num">
          <span className="sr-only">, kontenjan </span>
          {num(result.quota)}
        </span>
      )}
    </span>
  );
}

function QuotaLine({ label, table }: { label: string; table: QuotaByYear | null }) {
  const parts = table ? LEVELS.filter((l) => table[l] !== undefined).map((l) => `${levelLabel(l)} ${num(table[l]!)}`) : [];
  return (
    <p className="hint gc-small">
      {label}: {parts.length > 0 ? parts.join(" · ") : "yayınlanmamış"}
    </p>
  );
}

const pct = (r: number | null) => (r === null ? "—" : `%${Math.round(r * 100)}`);

export function ResultRow({
  result,
  paths,
  history,
}: {
  result: Evaluation;
  paths: readonly PathKey[];
  history: HistoryIndex[string];
}) {
  const { program } = result;
  const verdicts = Object.fromEntries(
    ALL_PATHS.map((p) => [p, verdictFor(result[p], history[p] ?? null)]),
  ) as Record<PathKey, Verdict>;
  const base = latestBase(program.baseScores);
  // "2025 taban 374,7534 EA, 67.606. sıra"
  const baseText = base
    ? `${base.year} taban ` +
      [
        base.minScore !== null ? `${score(base.minScore)}${program.scoreType ? ` ${program.scoreType}` : ""}` : null,
        base.minRank !== null ? `${num(base.minRank)}. sıra` : null,
      ]
        .filter(Boolean)
        .join(", ")
    : null;
  const sortedScores = [...program.baseScores].sort((a, b) => b.year - a.year);

  return (
    <li className="gc-item">
      <details className="gc-row">
        <summary className="gc-summary">
          <span className="gc-name">
            <span className="gc-program">{program.name}</span>
            <span className="gc-meta">
              {program.faculty}
              {baseText && <span className="num"> · {baseText}</span>}
            </span>
          </span>
          <span className="gc-pills" data-count={paths.length}>
            {paths.map((p) => (
              <StatusPill key={p} path={p} result={result[p]} verdict={verdicts[p]} />
            ))}
          </span>
        </summary>

        <div className="gc-detail">
          {ALL_PATHS.map((p) => (
            <section key={p} className="gc-path">
              <h3 className="gc-path-title">
                {PATH_TITLES[p]}
                <span className="gc-verdict-title" data-level={verdicts[p].level}>
                  <span aria-hidden="true">{VERDICT_ICON[verdicts[p].level]} </span>
                  {verdicts[p].title}
                </span>
              </h3>
              <p className="gc-verdict-detail">{verdicts[p].detail}</p>
              <ul className="gc-checks">
                {result[p].checks.map((c, i) => (
                  <li key={`${c.id}-${i}`} data-status={c.status}>
                    <span className="gc-check-icon" aria-hidden="true">
                      {ICONS[c.status]}
                    </span>
                    <span>
                      <span className="sr-only">{STATUS_TEXT[c.status]}: </span>
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
              {history[p] && history[p]!.rows.length > 0 && (
                <p className="hint gc-small gc-history">
                  Geçmiş dönemler:{" "}
                  {history[p]!.rows.slice(0, 6).map((r, i) => (
                    <span key={r.term} className="num">
                      {i > 0 && "; "}
                      {r.term} {r.accepted + r.conditional}/{r.applications} kabul ({pct(r.rate)})
                    </span>
                  ))}
                </p>
              )}
              {p === "internal" && <QuotaLine label="Kontenjan" table={program.internalQuota} />}
              {p === "central" && <QuotaLine label="Kontenjan" table={program.centralQuota} />}
            </section>
          ))}

          {sortedScores.length > 0 && (
            <div className="gc-scores">
              <h3 className="gc-path-title">Özyeğin YKS yerleşme bilgisi{program.scoreType ? ` (${program.scoreType})` : ""}</h3>
              <div className="table-scroll">
                <table className="sections-table gc-table">
                  <thead>
                    <tr>
                      <th scope="col">Yıl</th>
                      <th scope="col">Burs</th>
                      <th scope="col">Kontenjan</th>
                      <th scope="col">En düşük puan</th>
                      <th scope="col">En düşük sıra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedScores.map((s, i) => (
                      <tr key={`${s.year}-${s.scholarship}-${i}`}>
                        <td className="num">{s.year}</td>
                        <td>{s.scholarshipLabel}</td>
                        <td className="num">{s.quota !== null ? num(s.quota) : "—"}</td>
                        <td className="num">{s.minScore !== null ? score(s.minScore) : "—"}</td>
                        <td className="num">{s.minRank !== null ? num(s.minRank) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {program.notes.length > 0 && (
            <div>
              <h3 className="gc-path-title">Notlar</h3>
              <ul className="gc-notes">
                {program.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}

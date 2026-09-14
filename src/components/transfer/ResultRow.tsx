"use client";

import type { BaseScore, CheckStatus, PathResult, QuotaByYear, TransferProgram } from "@/lib/transfer/types";

export type PathKey = "internal" | "central" | "cap";

export interface Evaluation {
  program: TransferProgram;
  internal: PathResult;
  central: PathResult;
  cap: PathResult;
}

export const PATH_LABELS: Record<PathKey, string> = {
  internal: "Yatay geçiş",
  central: "Merkezi puan",
  cap: "Çift anadal",
};

const PATH_TITLES: Record<PathKey, string> = {
  internal: "Kurum içi yatay geçiş",
  central: "Merkezi puanla yatay geçiş",
  cap: "Çift anadal",
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
const ALL_PATHS: PathKey[] = ["internal", "central", "cap"];

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

function StatusPill({ path, result }: { path: PathKey; result: PathResult }) {
  return (
    <span className="gc-pill" data-status={result.status}>
      <span className="gc-pill-icon" aria-hidden="true">
        {ICONS[result.status]}
      </span>
      {PATH_LABELS[path]}
      <span className="sr-only">: {STATUS_TEXT[result.status]}</span>
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

export function ResultRow({ result, paths }: { result: Evaluation; paths: readonly PathKey[] }) {
  const { program } = result;
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
          <span className="gc-pills">
            {paths.map((p) => (
              <StatusPill key={p} path={p} result={result[p]} />
            ))}
          </span>
        </summary>

        <div className="gc-detail">
          {ALL_PATHS.map((p) => (
            <section key={p} className="gc-path">
              <h3 className="gc-path-title">
                <span className="gc-pill-icon" data-status={result[p].status} aria-hidden="true">
                  {ICONS[result[p].status]}
                </span>
                {PATH_TITLES[p]}
                <span className="gc-path-status">{STATUS_TEXT[result[p].status]}</span>
              </h3>
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

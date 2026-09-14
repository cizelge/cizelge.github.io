"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CREDIT_CHOICES } from "@/lib/roadmap/storage";
import type { PlanResult, PlanTerm, Requirement, RoadmapProgram, RoadmapProgramKind } from "@/lib/roadmap/types";
import { creditsText, KIND_HL, KIND_LABEL } from "./shared";

interface Props {
  programs: RoadmapProgram[];
  plan: PlanResult;
  unreadableIds: string[];
  maxCredits: number;
  /** Ortalamaya göre yönetmelikteki dönem sınırı; not girilmediyse null. */
  loadLimit: number | null;
  onMaxCredits: (n: number) => void;
  anadalId: string | null;
}

const REASON: Record<PlanResult["unplaced"][number]["reason"], string> = {
  prerequisite: "Ön koşulu hiçbir dönemde sağlanamıyor.",
  notOffered: "Hiçbir dönemde açılmıyor görünüyor.",
  unknown: "Yerleştirilemedi, nedeni belli değil.",
};

interface Row {
  key: string;
  code: string | null;
  title: string;
  credits: number | null;
  kinds: RoadmapProgramKind[];
  unreadable: boolean;
}

export function TermPlan({ programs, plan, unreadableIds, maxCredits, onMaxCredits, anadalId, loadLimit }: Props) {
  const index = useMemo(() => {
    const m = new Map<string, { req: Requirement; kind: RoadmapProgramKind }>();
    for (const p of programs) for (const r of p.requirements) m.set(r.id, { req: r, kind: p.kind });
    return m;
  }, [programs]);
  const unreadable = useMemo(() => new Set(unreadableIds), [unreadableIds]);
  const showLegend = programs.length > 1;

  function rowsOf(ids: string[]): Row[] {
    const rows = new Map<string, Row>();
    for (const id of ids) {
      const hit = index.get(id);
      if (!hit) continue;
      const { req, kind } = hit;
      // Aynı kodlu gereksinimler (anadal ve çift anadalda ortak ders) tek satır.
      const key = req.kind === "course" && req.code ? `c:${req.code}` : `e:${id}`;
      const row = rows.get(key);
      if (row) {
        if (!row.kinds.includes(kind)) row.kinds.push(kind);
        row.unreadable ||= unreadable.has(id);
      } else {
        rows.set(key, {
          key,
          code: req.kind === "course" ? req.code : null,
          title: req.title,
          credits: req.credits,
          kinds: [kind],
          unreadable: unreadable.has(id),
        });
      }
    }
    return [...rows.values()];
  }

  return (
    <section aria-labelledby="rm-plan" className="rm-plan">
      <h2 className="group-title rm-h2" id="rm-plan">
        Dönem dönem plan
      </h2>

      <div className="tuning">
        <div className="tuning-group" role="group" aria-labelledby="rm-max">
          <span className="tuning-label" id="rm-max">
            Dönem başına en fazla AKTS
          </span>
          <div className="chips">
            {CREDIT_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                className="chip num"
                aria-pressed={maxCredits === n}
                aria-describedby={loadLimit !== null && n > loadLimit ? "rm-limit" : undefined}
                data-over={loadLimit !== null && n > loadLimit ? "" : undefined}
                onClick={() => onMaxCredits(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {loadLimit !== null && (
          <p className="hint rm-limit" id="rm-limit">
            {maxCredits > loadLimit
              ? `Yönetmeliğe göre en fazla ${loadLimit} AKTS alabilirsin; bu plan sınırın üstünde.`
              : `Yönetmeliğe göre sınırın ${loadLimit} AKTS.`}
          </p>
        )}
        {showLegend && (
          <ul className="rm-legend" aria-label="Renkler">
            {programs.map((p) => (
              <li key={`${p.kind}:${p.id}`} className={`hl-${KIND_HL[p.kind]}`}>
                <span className="rm-mark" aria-hidden="true" />
                {KIND_LABEL[p.kind]}
              </li>
            ))}
          </ul>
        )}
      </div>

      {plan.terms.length === 0 ? (
        <p className="hint">Plana konacak ders kalmadı.</p>
      ) : (
        <ol className="rm-terms">
          {plan.terms.map((t) => (
            <TermCard key={`${t.startYear}-${t.season}`} term={t} rows={rowsOf(t.requirementIds)} anadalId={anadalId} showKinds={showLegend} />
          ))}
        </ol>
      )}

      {plan.unplaced.length > 0 && (
        <div className="notice notice-danger rm-unplaced">
          <h3>Yerleşmeyen dersler</h3>
          <ul className="rm-list">
            {plan.unplaced.map((u) => {
              const hit = index.get(u.requirementId);
              if (!hit) return null;
              return (
                <li key={u.requirementId}>
                  <span className="rm-req-code num">{hit.req.code ?? hit.req.title}</span>{" "}
                  {hit.req.code && <span className="hint">{hit.req.title}. </span>}
                  <span>{REASON[u.reason]}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function TermCard({
  term,
  rows,
  anadalId,
  showKinds,
}: {
  term: PlanTerm;
  rows: Row[];
  anadalId: string | null;
  showKinds: boolean;
}) {
  const abroad = !!term.erasmus;
  const codes = rows.filter((r) => r.code).map((r) => r.code!.replace(/\s+/g, ""));
  const hasElectives = rows.some((r) => !r.code);
  const params = [codes.length ? `d=${codes.join(",")}` : "", anadalId ? `bolum=${encodeURIComponent(anadalId)}` : ""]
    .filter(Boolean)
    .join("&");

  return (
    <li className={abroad ? "rm-term rm-term-erasmus" : "rm-term"}>
      <div className="rm-term-head">
        <h3 className="rm-term-label">
          {term.label}
          {abroad && <span className="rm-erasmus-tag">Erasmus</span>}
        </h3>
        <span className="hint num">{term.credits} AKTS</span>
      </div>
      {abroad && rows.length === 0 && (
        <p className="hint rm-erasmus-empty">Bu dönem Özyeğin&apos;den ders yok; yurt dışına taşınacak seçmeli kalmadı.</p>
      )}
      <ul className="rm-rows">
        {rows.map((r) => (
          <li key={r.key} className="rm-row">
            {showKinds && (
              <span className="rm-marks">
                {r.kinds.map((k) => (
                  <span key={k} className={`rm-mark hl-${KIND_HL[k]}`} title={KIND_LABEL[k]}>
                    <span className="sr-only">{KIND_LABEL[k]}</span>
                  </span>
                ))}
              </span>
            )}
            <span className="rm-row-main">
              {r.code && <span className="rm-req-code num">{r.code}</span>}
              <span className="rm-req-title">{abroad ? `Yurt dışında alınacak: ${r.title}` : r.title}</span>
              {r.unreadable && <span className="hint rm-row-hint">koşulu SIS&apos;ten kontrol et</span>}
            </span>
            <span className="rm-req-credits num">{creditsText(r.credits)}</span>
          </li>
        ))}
      </ul>
      <div className="rm-term-foot">
        {abroad ? (
          <span className="hint">Dersler dönüşte saydırılır; eşleştirmeyi bölüm koordinatörüyle yap.</span>
        ) : (
          <>
            {codes.length > 0 && (
              <Link className="btn btn-small" href={`/ozyegin?${params}`}>
                Planlayıcıda aç
              </Link>
            )}
            {hasElectives && <span className="hint">Seçmeliler planlayıcıda aranarak eklenir.</span>}
          </>
        )}
      </div>
    </li>
  );
}

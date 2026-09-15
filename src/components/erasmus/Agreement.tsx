"use client";

import Link from "next/link";
import { useId, useMemo } from "react";
import { draftTotals } from "@/lib/erasmus/agreement";
import type { RemainingRequirement } from "@/lib/erasmus/prefill";
import type { AgreementDraft, AgreementRow } from "@/lib/erasmus/types";
import { findUniversity, universityDetail, type UniversityItem } from "@/lib/erasmus/universities";
import { canonicalCode } from "@/lib/roadmap/progress";
import { parseDecimalInput } from "@/lib/transfer/profile-storage";
import { formatNumber, NumberField } from "./NumberField";
import { UniversityCombobox, useEcheInstitutions } from "./UniversityCombobox";

interface Props {
  draft: AgreementDraft;
  onDraft: (next: AgreementDraft) => void;
  remaining: readonly RemainingRequirement[];
  hasRoadmap: boolean;
  programName: string | null;
  /** Elle yazılan kodun AKTS'si (müfredatlardan). */
  codeCredits: ReadonlyMap<string, number>;
  /** Özyeğin'in anlaşmalı olduğu okullar. */
  partners: readonly UniversityItem[];
}

/** Bir dönem için bundan az AKTS görünürse bilgi notu çıkar. */
const LOW_SEMESTER_ECTS = 20;

const newRowId = () => `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const emptyRow = (): AgreementRow => ({ id: newRowId(), hostCode: "", hostTitle: "", hostEcts: null, match: null });

function requirementText(r: RemainingRequirement): string {
  const name = r.code ? `${r.code} ${r.title}` : r.slotLabel ? `${r.title}, ${r.slotLabel}` : r.title;
  return r.credits !== null ? `${name} (${formatNumber(r.credits, 1)} AKTS)` : name;
}

function groupByProgram(list: readonly RemainingRequirement[]) {
  const groups = new Map<string, RemainingRequirement[]>();
  for (const r of list) {
    const g = groups.get(r.programName);
    if (g) g.push(r);
    else groups.set(r.programName, [r]);
  }
  return [...groups];
}

const matchValue = (m: AgreementRow["match"]) => (m === null ? "" : m.kind === "code" ? "code" : `r:${m.requirementId}`);

export function Agreement({ draft, onDraft, remaining, hasRoadmap, programName, codeCredits, partners }: Props) {
  const id = useId();
  const byId = useMemo(() => new Map(remaining.map((r) => [r.id, r])), [remaining]);
  const groups = useMemo(() => groupByProgram(remaining), [remaining]);
  const eche = useEcheInstitutions();
  // Kayıtta yalnızca ad tutulur; ülke ve kod listede bulunursa gösterilir.
  const host = useMemo(() => findUniversity(draft.hostUniversity, partners, eche.items), [draft.hostUniversity, partners, eche.items]);
  const hostName = draft.hostUniversity.trim();

  const lookupCredits = (m: NonNullable<AgreementRow["match"]>) =>
    m.kind === "requirement" ? (byId.get(m.requirementId)?.credits ?? null) : (codeCredits.get(canonicalCode(m.code)) ?? null);
  const totals = draftTotals(draft, lookupCredits);

  function updateRow(rowId: string, patch: Partial<AgreementRow>) {
    onDraft({ ...draft, rows: draft.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)) });
  }
  function removeRow(rowId: string) {
    onDraft({ ...draft, rows: draft.rows.filter((r) => r.id !== rowId) });
  }
  function addRow() {
    onDraft({ ...draft, rows: [...draft.rows, emptyRow()] });
  }

  function matchLabel(m: AgreementRow["match"]): string {
    if (m === null) return "Eşleşmedi";
    if (m.kind === "code") {
      const credits = m.code.trim() ? codeCredits.get(canonicalCode(m.code)) : undefined;
      return m.code.trim() ? (credits !== undefined ? `${m.code} (${formatNumber(credits, 1)} AKTS)` : m.code) : "Eşleşmedi";
    }
    const r = byId.get(m.requirementId);
    return r ? requirementText(r) : "Yol haritasında bulunamadı";
  }

  const totalsText =
    `Yurt dışında ${formatNumber(totals.hostEcts, 1)} AKTS, eşlenen Özyeğin karşılığı ${formatNumber(totals.matchedOzuEcts, 1)} AKTS, ` +
    (totals.unmatchedRows === 0 ? "bütün dersler eşlendi." : `${totals.unmatchedRows} ders eşlenmedi.`);

  return (
    <section aria-labelledby={id} className="er-section er-agreement">
      <div className="er-screen">
        <h2 className="group-title er-h2" id={id}>
          Ders eşleştirme taslağı
        </h2>
        <p className="hint">
          Karşı okulda alacağın dersleri yaz, her birini Özyeğin&apos;de kalan bir dersinle eşleştir. Koordinatörünle konuşurken
          elinde hazır bir liste olsun.
        </p>
        {!hasRoadmap && (
          <p className="hint gc-small er-roadmap-hint">
            Kalan derslerinle eşleştirmek için{" "}
            <Link className="link" href="/ozyegin/yol-haritasi">
              yol haritasında
            </Link>{" "}
            bölümünü seç ve geçtiğin dersleri işaretle. Şimdilik ders koduyla eşleştirebilirsin.
          </p>
        )}

        <UniversityCombobox
          label="Karşı üniversite"
          placeholder="Okul, şehir, ülke ya da Erasmus kodu"
          value={draft.hostUniversity}
          onChange={(v) => onDraft({ ...draft, hostUniversity: v })}
          partners={partners}
          others={eche.items}
          othersStatus={eche.status}
          onFirstFocus={eche.load}
          detail={universityDetail(host)}
        />

        {draft.rows.length > 0 && (
          <div className="er-rows-wrap">
            <div className="er-row-head" aria-hidden="true">
              <span>Ders kodu</span>
              <span>Ders adı</span>
              <span>AKTS</span>
              <span>Özyeğin karşılığı</span>
              <span />
            </div>
            <ol className="er-rows">
              {draft.rows.map((row, index) => {
                const value = matchValue(row.match);
                const unknownReq = row.match?.kind === "requirement" && !byId.has(row.match.requirementId);
                const n = index + 1;
                return (
                  <li key={row.id} className="er-row">
                    <span className="er-row-n" aria-hidden="true">
                      {n}. ders
                    </span>
                    <label className="field">
                      <span className="field-label er-cell-label">Ders kodu</span>
                      <input
                        className="select gc-input"
                        autoComplete="off"
                        placeholder="IN2064"
                        aria-label={`${n}. ders, kod`}
                        value={row.hostCode}
                        onChange={(e) => updateRow(row.id, { hostCode: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span className="field-label er-cell-label">Ders adı</span>
                      <input
                        className="select gc-input"
                        autoComplete="off"
                        placeholder="Machine Learning"
                        aria-label={`${n}. ders, ad`}
                        value={row.hostTitle}
                        onChange={(e) => updateRow(row.id, { hostTitle: e.target.value })}
                      />
                    </label>
                    <NumberField
                      label={
                        <>
                          AKTS<span className="sr-only">, {n}. ders</span>
                        </>
                      }
                      labelClassName="field-label er-cell-label"
                      value={row.hostEcts}
                      placeholder="6"
                      parse={parseDecimalInput}
                      format={(v) => formatNumber(v, 1)}
                      limits={{ min: 0, max: 60 }}
                      error="0 ile 60 arasında yaz."
                      onChange={(v) => updateRow(row.id, { hostEcts: v })}
                    />
                    <div className="er-match">
                      <label className="field">
                        <span className="field-label er-cell-label">Özyeğin karşılığı</span>
                        <select
                          className="select"
                          aria-label={`${n}. dersin Özyeğin karşılığı`}
                          value={value}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") updateRow(row.id, { match: null });
                            else if (v === "code")
                              updateRow(row.id, { match: { kind: "code", code: row.match?.kind === "code" ? row.match.code : "" } });
                            else updateRow(row.id, { match: { kind: "requirement", requirementId: v.slice(2) } });
                          }}
                        >
                          <option value="">Eşleşmedi</option>
                          {unknownReq && <option value={value}>Yol haritasında bulunamadı</option>}
                          {groups.map(([program, list]) => (
                            <optgroup key={program} label={program}>
                              {list.map((r) => (
                                <option key={r.id} value={`r:${r.id}`}>
                                  {requirementText(r)}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                          <option value="code">Başka ders kodu yaz…</option>
                        </select>
                      </label>
                      {row.match?.kind === "code" && (
                        <input
                          className="select gc-input er-code"
                          autoComplete="off"
                          placeholder="Özyeğin ders kodu, ör. CS 412"
                          aria-label={`${n}. dersin Özyeğin ders kodu`}
                          value={row.match.code}
                          onChange={(e) => updateRow(row.id, { match: { kind: "code", code: e.target.value } })}
                        />
                      )}
                    </div>
                    <button type="button" className="btn btn-small btn-quiet er-remove" onClick={() => removeRow(row.id)} aria-label={`${n}. dersi sil`}>
                      Sil
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="actions er-actions">
          <button type="button" className="btn" onClick={addRow}>
            Ders ekle
          </button>
          {draft.rows.length > 0 && (
            <button type="button" className="btn btn-quiet" onClick={() => window.print()}>
              Yazdır
            </button>
          )}
        </div>

        {draft.rows.length > 0 && (
          <>
            <p className="er-line num" aria-live="polite">
              {totalsText}
            </p>
            {totals.hostEcts < LOW_SEMESTER_ECTS && (
              <div className="notice er-notice">
                <p>
                  Bir dönem için yurt dışında {formatNumber(totals.hostEcts, 1)} AKTS görünüyor. Bir dönemde çoğunlukla 20 ile 30 AKTS
                  arası ders alınır; kaç AKTS gerektiğini koordinatörünle kontrol et.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Yazdırma: yalnızca taslak tablosu */}
      <div className="er-print">
        <h1>Ders eşleştirme taslağı</h1>
        <dl>
          {programName && (
            <div>
              <dt>Özyeğin programı</dt>
              <dd>{programName}</dd>
            </div>
          )}
          <div>
            <dt>Karşı üniversite</dt>
            <dd>{hostName ? (host?.country ? `${hostName} (${host.country})` : hostName) : "—"}</dd>
          </div>
        </dl>
        <table>
          <thead>
            <tr>
              <th>Ders kodu</th>
              <th>Ders adı</th>
              <th>AKTS</th>
              <th>Özyeğin karşılığı</th>
            </tr>
          </thead>
          <tbody>
            {draft.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.hostCode || "—"}</td>
                <td>{row.hostTitle || "—"}</td>
                <td className="num">{row.hostEcts !== null ? formatNumber(row.hostEcts, 1) : "—"}</td>
                <td>{matchLabel(row.match)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{totalsText}</p>
        <p>
          <b>Taslaktır; resmi Learning Agreement değildir.</b>
        </p>
      </div>
    </section>
  );
}

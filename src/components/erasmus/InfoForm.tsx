"use client";

import { useId } from "react";
import { formatGpa } from "@/lib/roadmap/gpa";
import { ERASMUS_LIMITS, type ErasmusProfile } from "@/lib/erasmus/prefill";
import type { ErasmusData } from "@/lib/erasmus/types";
import { parseDecimalInput, parseIntegerInput } from "@/lib/transfer/profile-storage";
import { formatNumber, formatSigned, NumberField } from "./NumberField";

interface Props {
  data: ErasmusData;
  /** Ekranda görünen değerler (kendi girdiğin ya da yol haritasından gelen). */
  gpa: number | null;
  ects: number | null;
  profile: ErasmusProfile;
  prefilled: boolean;
  onGpa: (v: number | null) => void;
  onEcts: (v: number | null) => void;
  onProfile: (patch: Partial<ErasmusProfile>) => void;
}

export function InfoForm({ data, gpa, ects, profile, prefilled, onGpa, onEcts, onProfile }: Props) {
  const id = useId();

  function setCriterion(key: string, count: number) {
    const next = { ...profile.criteria };
    if (count > 0) next[key] = count;
    else delete next[key];
    onProfile({ criteria: next });
  }

  return (
    <section aria-labelledby={`${id}-t`} className="gc-form">
      <div>
        <h2 className="group-title" id={`${id}-t`}>
          Bilgilerin
        </h2>
        <p className="hint">Hepsi isteğe bağlı. Doldurdukça sonuçlar değişir.</p>
        {prefilled && <p className="hint gc-prefill">Yol haritasındaki bilgilerden dolduruldu.</p>}
      </div>

      <div className="gc-pair">
        <NumberField
          label="GNO"
          value={gpa}
          placeholder="3,10"
          parse={parseDecimalInput}
          format={formatGpa}
          limits={ERASMUS_LIMITS.gpa}
          error="0 ile 4 arasında yaz."
          onChange={onGpa}
        />
        <NumberField
          label="Tamamladığın AKTS"
          value={ects}
          placeholder="84"
          parse={parseDecimalInput}
          format={(n) => formatNumber(n, 1)}
          limits={ERASMUS_LIMITS.ects}
          error="0 ile 400 arasında yaz."
          onChange={onEcts}
        />
      </div>

      <NumberField
        label="ELE puanın"
        value={profile.ele}
        placeholder="72"
        parse={parseDecimalInput}
        format={(n) => formatNumber(n)}
        limits={ERASMUS_LIMITS.ele}
        error="0 ile 100 arasında yaz."
        hint={`100 üzerinden. Başvuru için en az ${formatNumber(data.eligibility.minEle)}.`}
        onChange={(v) => onProfile({ ele: v })}
      />

      <fieldset className="gc-fieldset">
        <legend className="group-title gc-legend">Ek kriterler</legend>
        <p className="hint gc-small er-criteria-hint">Ulusal Ajans&apos;ın puana eklediği ya da düştüğü durumlar. Sana uyanları işaretle.</p>
        <ul className="er-criteria">
          {data.criteria.map((c) => {
            const count = profile.criteria[c.id] ?? 0;
            return (
              <li key={c.id}>
                <label className="er-check">
                  <input type="checkbox" checked={count > 0} onChange={(e) => setCriterion(c.id, e.target.checked ? 1 : 0)} />
                  <span>
                    {c.label}{" "}
                    <span className="er-points num">
                      ({formatSigned(c.points)}
                      {c.perCount ? " her biri" : ""})
                    </span>
                  </span>
                </label>
                {c.perCount && count > 0 && (
                  <NumberField
                    className="field er-count"
                    label="Kaç kez"
                    value={count}
                    parse={parseIntegerInput}
                    format={(n) => String(n)}
                    limits={{ min: 1, max: ERASMUS_LIMITS.count.max }}
                    error="1 ile 9 arasında yaz."
                    numeric
                    onChange={(v) => {
                      if (v !== null) setCriterion(c.id, v);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <NumberField
        label="Hedef Erasmus puanı"
        value={profile.target}
        placeholder="80"
        parse={parseDecimalInput}
        format={(n) => formatNumber(n)}
        limits={ERASMUS_LIMITS.target}
        error="0 ile 200 arasında yaz."
        hint="İsteğe bağlı. ELE'den kaç alman gerektiğini hesaplar."
        onChange={(v) => onProfile({ target: v })}
      />

      <p className="hint gc-small">Bilgilerin yalnızca bu tarayıcıda kalır.</p>
    </section>
  );
}

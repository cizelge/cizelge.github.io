"use client";

import { useId, useMemo, useState } from "react";
import { formatGpa } from "@/lib/roadmap/gpa";
import { LIMITS, parseDecimalInput, parseIntegerInput, SCORE_TYPES } from "@/lib/transfer/profile-storage";
import type { ScoreType, StudentProfile } from "@/lib/transfer/types";

export interface ProgramOption {
  id: string;
  name: string;
  faculty: string;
}

interface Props {
  programs: readonly ProgramOption[];
  profile: StudentProfile;
  /** Yol haritası kaydından en az bir alan dolduruldu mu. */
  prefilled: boolean;
  entryYears: readonly number[];
  onField: <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => void;
}

const collator = new Intl.Collator("tr");
const SEMESTERS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const formatNumber = (n: number, digits = 5) => n.toLocaleString("tr-TR", { maximumFractionDigits: digits });

function groupByFaculty(programs: readonly ProgramOption[]) {
  const groups = new Map<string, ProgramOption[]>();
  for (const p of programs) {
    const list = groups.get(p.faculty);
    if (list) list.push(p);
    else groups.set(p.faculty, [p]);
  }
  return [...groups]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([faculty, list]) => ({ faculty, programs: [...list].sort((a, b) => collator.compare(a.name, b.name)) }));
}

const boolValue = (v: boolean | null) => (v === null ? "" : v ? "evet" : "hayir");
const parseBool = (v: string) => (v === "evet" ? true : v === "hayir" ? false : null);

export function ProfileForm({ programs, profile, prefilled, entryYears, onField }: Props) {
  const id = useId();
  const groups = useMemo(() => groupByFaculty(programs), [programs]);
  const years =
    profile.entryYear !== null && !entryYears.includes(profile.entryYear)
      ? [...entryYears, profile.entryYear].sort((a, b) => b - a)
      : entryYears;

  return (
    <section aria-labelledby={`${id}-t`} className="gc-form">
      <div>
        <h2 className="group-title" id={`${id}-t`}>
          Bilgilerin
        </h2>
        <p className="hint">Hepsi isteğe bağlı. Doldurdukça sonuçlar değişir.</p>
        {prefilled && <p className="hint gc-prefill">Yol haritasındaki bilgilerden dolduruldu.</p>}
      </div>

      <label className="field">
        <span className="field-label">Bölümün</span>
        <select className="select" value={profile.programId ?? ""} onChange={(e) => onField("programId", e.target.value || null)}>
          <option value="">Seçilmedi</option>
          {groups.map((g) => (
            <optgroup key={g.faculty} label={g.faculty}>
              {g.programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="gc-pair">
        <NumberField
          label="GNO"
          value={profile.gpa}
          placeholder="2,72"
          parse={parseDecimalInput}
          format={formatGpa}
          limits={LIMITS.gpa}
          error="0 ile 4 arasında yaz."
          onChange={(v) => onField("gpa", v)}
        />
        <NumberField
          label="Tamamladığın AKTS"
          value={profile.completedCredits}
          placeholder="84"
          parse={parseDecimalInput}
          format={(n) => formatNumber(n, 1)}
          limits={LIMITS.completedCredits}
          error="0 ile 400 arasında yaz."
          onChange={(v) => onField("completedCredits", v)}
        />
      </div>

      <label className="field">
        <span className="field-label">Tamamladığın dönem</span>
        <select
          className="select"
          value={profile.completedSemesters ?? ""}
          aria-describedby={`${id}-sem`}
          onChange={(e) => onField("completedSemesters", e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">Seçilmedi</option>
          {SEMESTERS.map((n) => (
            <option key={n} value={n}>
              {n} dönem
            </option>
          ))}
        </select>
        <span className="hint gc-small" id={`${id}-sem`}>
          Hazırlık ve yaz hariç.
        </span>
      </label>

      <div className="gc-pair">
        <label className="field">
          <span className="field-label">Kaldığın ders var mı</span>
          <select
            className="select"
            value={boolValue(profile.hasFailedCourse)}
            onChange={(e) => onField("hasFailedCourse", parseBool(e.target.value))}
          >
            <option value="">—</option>
            <option value="evet">Evet</option>
            <option value="hayir">Hayır</option>
          </select>
        </label>
        <label className="field">
          <span className="field-label">Sınıfının ilk %20&apos;si</span>
          <select className="select" value={boolValue(profile.top20)} onChange={(e) => onField("top20", parseBool(e.target.value))}>
            <option value="">Bilmiyorum</option>
            <option value="evet">Evet</option>
            <option value="hayir">Hayır</option>
          </select>
        </label>
      </div>

      <fieldset className="gc-fieldset">
        <legend className="group-title gc-legend">YKS</legend>
        <div className="gc-pair">
          <label className="field">
            <span className="field-label">Kayıt yılı</span>
            <select
              className="select"
              value={profile.entryYear ?? ""}
              onChange={(e) => onField("entryYear", e.target.value === "" ? null : Number(e.target.value))}
            >
              <option value="">Seçilmedi</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Puan türü</span>
            <select
              className="select"
              value={profile.scoreType ?? ""}
              onChange={(e) => onField("scoreType", (SCORE_TYPES as readonly string[]).includes(e.target.value) ? (e.target.value as ScoreType) : null)}
            >
              <option value="">Seçilmedi</option>
              {SCORE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Yerleşme puanı"
            value={profile.score}
            placeholder="450,5"
            parse={parseDecimalInput}
            format={(n) => formatNumber(n)}
            limits={LIMITS.score}
            error="0 ile 600 arasında yaz."
            onChange={(v) => onField("score", v)}
          />
          <NumberField
            label="Başarı sırası"
            value={profile.rank}
            placeholder="125.000"
            parse={parseIntegerInput}
            format={(n) => formatNumber(n)}
            limits={LIMITS.rank}
            error="Tam sayı yaz."
            numeric
            onChange={(v) => onField("rank", v)}
          />
        </div>
      </fieldset>

      <p className="hint gc-small">Bilgilerin yalnızca bu tarayıcıda kalır.</p>
    </section>
  );
}

interface NumberFieldProps {
  label: string;
  value: number | null;
  placeholder: string;
  parse: (text: string) => number | null;
  format: (n: number) => string;
  limits: { min: number; max: number };
  error: string;
  /** Tam sayı klavyesi. */
  numeric?: boolean;
  onChange: (value: number | null) => void;
}

/** Yazarken metin olduğu gibi kalır; geçerli sayı her tuşta bildirilir, alan bırakılınca Türkçe yazımla gösterilir. */
function NumberField({ label, value, placeholder, parse, format, limits, error, numeric, onChange }: NumberFieldProps) {
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : format(value));
  const parsed = draft === null || draft.trim() === "" ? null : parse(draft);
  const invalid = draft !== null && draft.trim() !== "" && (parsed === null || parsed < limits.min || parsed > limits.max);

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="select gc-input num"
        inputMode={numeric ? "numeric" : "decimal"}
        autoComplete="off"
        placeholder={placeholder}
        value={shown}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = text.trim() === "" ? null : parse(text);
          onChange(n !== null && n >= limits.min && n <= limits.max ? n : null);
        }}
        onBlur={() => {
          if (!invalid) setDraft(null);
        }}
      />
      {invalid && (
        <span className="hint gc-small gc-error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}

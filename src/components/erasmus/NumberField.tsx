"use client";

import { useId, useState, type ReactNode } from "react";

/** Türkçe sayı yazımı: 7,5 · 2.400 */
export const formatNumber = (n: number, digits = 2) => n.toLocaleString("tr-TR", { maximumFractionDigits: digits });
/** İki ondalıklı puan: 37,50 */
export const formatScore = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** İşaretli tam puan, gerçek eksi işaretiyle: −10, +15 */
export const formatSigned = (n: number) => (n < 0 ? `−${formatNumber(-n)}` : `+${formatNumber(n)}`);
export const formatEuro = (n: number) => `${formatNumber(n)} €`;

interface Props {
  label: ReactNode;
  value: number | null;
  placeholder?: string;
  parse: (text: string) => number | null;
  format: (n: number) => string;
  limits: { readonly min: number; readonly max: number };
  error: string;
  /** Tam sayı klavyesi. */
  numeric?: boolean;
  hint?: string;
  /** Etiketin ekrandaki sınıfı (satır içi alanlarda masaüstünde gizlenir). */
  labelClassName?: string;
  className?: string;
  onChange: (value: number | null) => void;
}

/** Yazarken metin olduğu gibi kalır; geçerli sayı her tuşta bildirilir, alan bırakılınca Türkçe yazımla gösterilir. */
export function NumberField({
  label,
  value,
  placeholder,
  parse,
  format,
  limits,
  error,
  numeric,
  hint,
  labelClassName = "field-label",
  className = "field",
  onChange,
}: Props) {
  const errorId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : format(value));
  const parsed = draft === null || draft.trim() === "" ? null : parse(draft);
  const invalid = draft !== null && draft.trim() !== "" && (parsed === null || parsed < limits.min || parsed > limits.max);
  const describedBy = [hint ? hintId : null, invalid ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <label className={className}>
      <span className={labelClassName}>{label}</span>
      <input
        className="select gc-input num"
        inputMode={numeric ? "numeric" : "decimal"}
        autoComplete="off"
        placeholder={placeholder}
        value={shown}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
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
      {hint && (
        <span className="hint gc-small" id={hintId}>
          {hint}
        </span>
      )}
      {invalid && (
        <span className="hint gc-small gc-error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}

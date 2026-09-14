"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { ErasmusSuggestion } from "@/lib/roadmap/erasmus";
import { planTermLabel } from "@/lib/roadmap/plan";
import { ERASMUS_MAX_ECTS, ERASMUS_MIN_ECTS, type RoadmapState } from "@/lib/roadmap/storage";
import type { PlanTerm } from "@/lib/roadmap/types";

type ErasmusTerm = { startYear: number; season: "guz" | "bahar" };

interface Props {
  /** Erasmussuz plandaki dönemler: seçilebilecek Erasmus dönemleri. */
  terms: PlanTerm[];
  value: RoadmapState["erasmus"];
  ects: number;
  /** En az zararlıdan başlayarak birkaç öneri. */
  suggestions: ErasmusSuggestion[];
  onTerm: (term: ErasmusTerm | null) => void;
  onEcts: (ects: number) => void;
}

const keyOf = (t: ErasmusTerm) => `${t.startYear}-${t.season}`;

/** "A", "A ve B", "A, B ve C", "A, B, C ve 2 ders daha". */
function listText(codes: string[]): string {
  const shown = codes.length > 4 ? codes.slice(0, 3) : codes;
  const rest = codes.length - shown.length;
  const items = rest > 0 ? [...shown, `${rest} ders daha`] : shown;
  return items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} ve ${items[items.length - 1]}`;
}

function suggestionText(s: ErasmusSuggestion): string {
  // Erasmus mezuniyeti gerçekte öne getirmez; eksi değer plandaki mevsim kısıtlarından kaynaklanır, "değişmez" denir.
  const delay = s.delayTerms <= 0 ? "mezuniyet değişmez" : `mezuniyet ${s.delayTerms} dönem gecikir`;
  const abroad = s.electivesAbroad > 0 ? `${s.electivesAbroad} AKTS seçmeli yurt dışında` : "yurt dışında saydırılacak seçmeli yok";
  const pushed = s.pushedRequired.length > 0 ? `; ${listText(s.pushedRequired)} kayar` : "";
  return `${delay}, ${abroad}${pushed}`;
}

export function ErasmusPlanner({ terms, value, ects, suggestions, onTerm, onEcts }: Props) {
  const id = useId();
  const [text, setText] = useState(String(ects));
  const [shownEcts, setShownEcts] = useState(ects);
  // Değer dışarıdan değişirse (kayıt okundu) kutu da güncellenir.
  if (shownEcts !== ects) {
    setShownEcts(ects);
    setText(String(ects));
  }

  const options: { key: string; label: string; term: ErasmusTerm }[] = terms.map((t) => ({
    key: keyOf(t),
    label: t.label,
    term: { startYear: t.startYear, season: t.season },
  }));
  if (value && !options.some((o) => o.key === keyOf(value.term))) {
    options.push({ key: keyOf(value.term), label: `${planTermLabel(value.term.startYear, value.term.season)} (planın dışında)`, term: value.term });
  }
  const selected = value ? keyOf(value.term) : "";

  return (
    <section aria-labelledby={`${id}-t`} className="rm-erasmus">
      <h2 className="group-title rm-h2" id={`${id}-t`}>
        Erasmus
      </h2>

      <div className="rm-erasmus-fields">
        <label className="field">
          <span className="field-label">Erasmus dönemi</span>
          <select
            className="select"
            value={selected}
            onChange={(e) => onTerm(options.find((o) => o.key === e.target.value)?.term ?? null)}
          >
            <option value="">Yok</option>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Yurt dışında saydırılacak AKTS</span>
          <input
            className="select rm-erasmus-ects num"
            type="number"
            inputMode="numeric"
            min={ERASMUS_MIN_ECTS}
            max={ERASMUS_MAX_ECTS}
            step={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const n = Number(e.target.value);
              if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= ERASMUS_MIN_ECTS && n <= ERASMUS_MAX_ECTS) {
                const rounded = Math.round(n);
                setShownEcts(rounded);
                onEcts(rounded);
              }
            }}
            onBlur={() => setText(String(ects))}
          />
        </label>
      </div>

      {suggestions.length > 0 && (
        <div className="rm-erasmus-suggest">
          <h3 className="rm-h3">Önerilen dönemler</h3>
          <ul className="rm-list">
            {suggestions.map((s) => {
              const isSelected = selected === keyOf(s.term);
              return (
                <li key={keyOf(s.term)} className="rm-erasmus-item">
                  <span>
                    <strong className="num">{s.label}:</strong> {suggestionText(s)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={isSelected}
                    onClick={() => onTerm(s.term)}
                  >
                    {isSelected ? "Seçili" : "Bu dönemi seç"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="hint rm-erasmus-note">
        Erasmus döneminde Özyeğin&apos;den ders alınmaz; zorunlu dersler sonraki dönemlere kayar.{" "}
        <Link className="link" href="/ozyegin/erasmus">
          Erasmus şartları, puan ve hibe hesabı
        </Link>
      </p>
    </section>
  );
}

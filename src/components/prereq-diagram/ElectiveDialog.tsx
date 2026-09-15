"use client";

// Seçmeli kutusuna hangi dersin geleceğini seçtiren küçük pencere (yerel <dialog>).
import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface PoolOption {
  code: string;
  title: string;
  credits: number | null;
}

interface Props {
  /** Açık pencere için seçmeli etiketi; null = kapalı. */
  label: string | null;
  options: readonly PoolOption[];
  /** Havuz yok, bütün dersler listeleniyor. */
  free: boolean;
  current: string | null;
  /** "Aldığım dersler" kipinde: kutu alındı mı; diğer kiplerde null (düğme gizlenir). */
  taken: boolean | null;
  onPick: (code: string) => void;
  onClear: () => void;
  onToggleTaken: () => void;
  onClose: () => void;
}

const LIMIT = 150;
const fold = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, "");

export function ElectiveDialog({ label, options, free, current, taken, onPick, onClear, onToggleTaken, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [query, setQuery] = useState("");
  const open = label !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const matches = useMemo(() => {
    const q = fold(query);
    const list = q ? options.filter((o) => fold(`${o.code} ${o.title}`).includes(q) || fold(o.code).includes(q)) : options;
    return list;
  }, [options, query]);
  const shown = matches.slice(0, LIMIT);

  return (
    <dialog
      ref={ref}
      className="osd-dialog"
      aria-labelledby={`${id}-t`}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      onClick={(e) => {
        // Arka plana tıklayınca kapanır.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
    >
      {open && (
        <div className="osd-dialog-body">
          <div className="osd-dialog-head">
            <h2 className="group-title osd-dialog-title" id={`${id}-t`}>
              Seçmeli ders seç
            </h2>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => ref.current?.close()}>
              Kapat
            </button>
          </div>
          <p className="hint">{label}</p>

          <label className="field">
            <span className="field-label">{free ? "Ders ara (bütün dersler)" : "Havuzda ara"}</span>
            <input
              type="search"
              className="select osd-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kod ya da ad"
              autoComplete="off"
            />
          </label>

          {shown.length === 0 ? (
            <p className="hint">Aramana uyan ders yok.</p>
          ) : (
            <ul className="osd-options" aria-label="Dersler">
              {shown.map((o) => {
                const on = o.code === current;
                return (
                  <li key={o.code}>
                    <button
                      type="button"
                      className="osd-option"
                      aria-pressed={on}
                      onClick={() => {
                        onPick(o.code);
                        ref.current?.close();
                      }}
                    >
                      <span className="osd-option-code">
                        {on && <span aria-hidden="true">✓ </span>}
                        {o.code}
                      </span>
                      <span className="osd-option-title">{o.title}</span>
                      {o.credits !== null && <span className="osd-option-ects num">{o.credits} AKTS</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {matches.length > LIMIT && (
            <p className="hint">
              İlk {LIMIT} ders gösteriliyor. Aramayı daraltınca diğerleri görünür.
            </p>
          )}

          <div className="osd-dialog-actions">
            {taken !== null && (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => {
                  onToggleTaken();
                  ref.current?.close();
                }}
              >
                {taken ? "Alındı işaretini kaldır" : current === null ? "Seçmeden alındı işaretle" : "Alındı işaretle"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-small"
              disabled={current === null}
              onClick={() => {
                onClear();
                ref.current?.close();
              }}
            >
              Seçimi kaldır
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

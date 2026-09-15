"use client";
// "Finalden kaç almalıyım": notlar ve ağırlıklar girilir, her harf notu için kalanlardan gereken puan gösterilir.
// Girilenler yalnızca bu tarayıcıda saklanır.

import { useEffect, useId, useMemo, useState } from "react";
import { DEFAULT_CUTOFFS, gradeState, neededScore, projected, type GradeItem, type LetterCutoff } from "@/lib/grades/final";
import styles from "./FinalCalculator.module.css";

const STORAGE_KEY = "final-hesabi:v1";

interface Row {
  key: number;
  name: string;
  weight: string;
  score: string;
}

interface Saved {
  rows: Row[];
  cutoffs: LetterCutoff[];
  target: string;
}

const START: Saved = {
  rows: [
    { key: 1, name: "Vize", weight: "30", score: "" },
    { key: 2, name: "Ödevler", weight: "20", score: "" },
    { key: 3, name: "Final", weight: "50", score: "" },
  ],
  cutoffs: DEFAULT_CUTOFFS.map((c) => ({ ...c })),
  target: "B",
};

function load(): Saved | null {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Partial<Saved>;
    if (!Array.isArray(r.rows) || !Array.isArray(r.cutoffs) || typeof r.target !== "string") return null;
    const rows = r.rows.filter(
      (x): x is Row =>
        typeof x === "object" && x !== null && typeof x.key === "number" && [x.name, x.weight, x.score].every((v) => typeof v === "string"),
    );
    const cutoffs = r.cutoffs.filter(
      (x): x is LetterCutoff => typeof x === "object" && x !== null && typeof x.letter === "string" && typeof x.min === "number",
    );
    if (rows.length === 0 || cutoffs.length !== DEFAULT_CUTOFFS.length) return null;
    return { rows, cutoffs, target: r.target };
  } catch {
    return null;
  }
}

function save(state: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* gizli pencere vb.: sessizce geç */
  }
}

/** "78,5" ve "78.5" kabul edilir; boş ya da geçersizse null. */
function parseNumber(value: string): number | null {
  const t = value.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const fmt = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export function FinalCalculator() {
  const id = useId();
  const [state, setState] = useState<Saved>(START);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = load();
    // Kayıt tarayıcıda; sunucu çiziminden sonra bir kez okunur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setState(saved);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) save(state);
  }, [state, loaded]);

  const items: GradeItem[] = useMemo(
    () =>
      state.rows.map((r) => {
        const score = parseNumber(r.score);
        return { name: r.name, weight: parseNumber(r.weight) ?? 0, score: score === null ? null : score };
      }),
    [state.rows],
  );
  const grade = useMemo(() => gradeState(items), [items]);
  const pending = state.rows.filter((r, i) => items[i].weight > 0 && items[i].score === null).map((r) => r.name.trim() || "adsız kalem");
  const invalidScore = state.rows.some((r) => {
    const n = parseNumber(r.score);
    return r.score.trim() !== "" && (n === null || n < 0 || n > 100);
  });
  const cutoffs = [...state.cutoffs].sort((a, b) => b.min - a.min);
  const target = cutoffs.find((c) => c.letter === state.target) ?? cutoffs[0];
  const targetNeed = neededScore(grade, target.min);
  const weightOk = Math.abs(grade.totalWeight - 100) < 0.01;

  const setRow = (key: number, patch: Partial<Row>) =>
    setState((s) => ({ ...s, rows: s.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const addRow = () =>
    setState((s) => ({ ...s, rows: [...s.rows, { key: Math.max(0, ...s.rows.map((r) => r.key)) + 1, name: "", weight: "", score: "" }] }));
  const removeRow = (key: number) => setState((s) => ({ ...s, rows: s.rows.filter((r) => r.key !== key) }));
  const setCutoff = (letter: string, value: string) => {
    const n = parseNumber(value);
    if (n === null) return;
    setState((s) => ({ ...s, cutoffs: s.cutoffs.map((c) => (c.letter === letter ? { ...c, min: n } : c)) }));
  };

  const pendingText = pending.length === 0 ? "" : pending.length === 1 ? pending[0] : `${pending.slice(0, -1).join(", ")} ve ${pending.at(-1)}`;

  return (
    <main id="icerik" className={`page ${styles.root}`}>
      <header className={styles.head}>
        <h1 className="board-title">Finalden kaç almalıyım</h1>
        <p className={styles.lede}>
          Aldığın notları ve yüzdelerini gir. Notu henüz belli olmayanları (final gibi) boş bırak; her harf notu için onlardan kaç
          alman gerektiğini gösterir.
        </p>
      </header>

      <section className={styles.card} aria-labelledby={`${id}-notlar`}>
        <h2 id={`${id}-notlar`} className="group-title">
          Notların
        </h2>
        <div className={styles.table}>
          <div className={styles.rowHead} aria-hidden="true">
            <span>Kalem</span>
            <span>Yüzde</span>
            <span>Notun</span>
            <span />
          </div>
          {state.rows.map((r, i) => {
            const n = parseNumber(r.score);
            const bad = r.score.trim() !== "" && (n === null || n < 0 || n > 100);
            return (
              <div key={r.key} className={styles.row}>
                <input
                  className={styles.input}
                  value={r.name}
                  placeholder="Quiz, proje…"
                  aria-label={`${i + 1}. kalemin adı`}
                  onChange={(e) => setRow(r.key, { name: e.target.value })}
                />
                <span className={styles.suffixWrap}>
                  <input
                    className={`${styles.input} ${styles.num} num`}
                    value={r.weight}
                    inputMode="decimal"
                    aria-label={`${r.name || `${i + 1}. kalem`} yüzdesi`}
                    onChange={(e) => setRow(r.key, { weight: e.target.value })}
                  />
                  <span className={styles.suffix} aria-hidden="true">
                    %
                  </span>
                </span>
                <input
                  className={`${styles.input} ${styles.num} num`}
                  value={r.score}
                  inputMode="decimal"
                  placeholder="yok"
                  aria-label={`${r.name || `${i + 1}. kalem`} notu (100 üzerinden)`}
                  aria-invalid={bad || undefined}
                  onChange={(e) => setRow(r.key, { score: e.target.value })}
                />
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => removeRow(r.key)}
                  disabled={state.rows.length === 1}
                  aria-label={`${r.name || `${i + 1}. kalem`} satırını sil`}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        <div className={styles.tableFoot}>
          <button type="button" className="btn btn-small" onClick={addRow}>
            Kalem ekle
          </button>
          <span className={`${styles.total} num`} data-ok={weightOk} aria-live="polite">
            Yüzdelerin toplamı %{fmt(grade.totalWeight)}
            {!weightOk && (grade.totalWeight < 100 ? `, %${fmt(100 - grade.totalWeight)} eksik` : `, %${fmt(grade.totalWeight - 100)} fazla`)}
          </span>
        </div>
        {invalidScore && <p className={styles.warn}>Notlar 0 ile 100 arasında olmalı.</p>}
      </section>

      <section className={styles.card} aria-labelledby={`${id}-sonuc`}>
        <h2 id={`${id}-sonuc`} className="group-title">
          {pending.length === 0 ? "Ders puanın" : `${pendingText} için gereken puan`}
        </h2>

        {pending.length === 0 ? (
          <p className={styles.final}>
            <span className="num">{fmt(grade.earned)}</span> puan, harf notu{" "}
            <strong>{projected(grade, 0, cutoffs).letter}</strong>.
          </p>
        ) : (
          <>
            <p className={styles.headline} aria-live="polite">
              <label className={styles.targetPick}>
                <span className="sr-only">Hedef harf notu</span>
                <select className={styles.select} value={target.letter} onChange={(e) => setState((s) => ({ ...s, target: e.target.value }))}>
                  {cutoffs.map((c) => (
                    <option key={c.letter} value={c.letter}>
                      {c.letter}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {targetNeed.kind === "secured"
                  ? " garanti, kalanlardan 0 alsan da."
                  : targetNeed.kind === "impossible"
                    ? ` için yetişmiyor. Hepsinden 100 alsan en fazla ${fmt(targetNeed.best)} puan olur.`
                    : ` için ${pending.length > 1 ? "her birinden" : ""} en az `}
                {targetNeed.kind === "score" && <strong className={`${styles.big} num`}>{fmt(targetNeed.score)}</strong>}
              </span>
            </p>

            <ol className={styles.letters}>
              {cutoffs.map((c) => {
                const need = neededScore(grade, c.min);
                const width = need.kind === "secured" ? 0 : need.kind === "impossible" ? 100 : need.score;
                return (
                  <li key={c.letter} className={styles.letter} data-target={c.letter === target.letter} data-kind={need.kind}>
                    <button
                      type="button"
                      className={styles.letterBtn}
                      onClick={() => setState((s) => ({ ...s, target: c.letter }))}
                      aria-pressed={c.letter === target.letter}
                    >
                      <span className={styles.letterName}>{c.letter}</span>
                      <span className={styles.bar} aria-hidden="true">
                        <span className={styles.fill} style={{ width: `${width}%` }} />
                      </span>
                      <span className={`${styles.need} num`}>
                        {need.kind === "secured" ? "garanti" : need.kind === "impossible" ? "yetişmez" : fmt(need.score)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className={styles.fine}>
              Şu an <span className="num">{fmt(grade.earned)}</span> puanın var, kalan kalemler %{fmt(grade.remainingWeight)} ediyor.
            </p>
          </>
        )}
      </section>

      <details className={styles.cutoffs}>
        <summary className={styles.cutoffsSummary}>Harf notu sınırları</summary>
        <div className={styles.cutoffsBody}>
          <p className={styles.fine}>
            Sınırları dersin hocası belirler; ders izlencesinde (syllabus) yazanları gir. Buradakiler yalnızca başlangıç değeri.
          </p>
          <div className={styles.cutoffGrid}>
            {state.cutoffs.map((c) => (
              <label key={c.letter} className={styles.cutoff}>
                <span className={styles.cutoffLetter}>{c.letter}</span>
                <input
                  className={`${styles.input} ${styles.num} num`}
                  defaultValue={String(c.min)}
                  key={`${c.letter}-${c.min}`}
                  inputMode="decimal"
                  aria-label={`${c.letter} için en düşük puan`}
                  onBlur={(e) => setCutoff(c.letter, e.target.value)}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-small btn-quiet"
            onClick={() => setState((s) => ({ ...s, cutoffs: DEFAULT_CUTOFFS.map((c) => ({ ...c })) }))}
          >
            Varsayılan sınırlara dön
          </button>
        </div>
      </details>

      <button type="button" className={`btn btn-small btn-quiet ${styles.reset}`} onClick={() => setState(START)}>
        Hepsini temizle
      </button>
    </main>
  );
}

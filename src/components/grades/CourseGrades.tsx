"use client";
// Ders sayfasındaki not dağılımı: öğrenciler aldıkları harf notunu isimsiz bildirir,
// yeterince bildirim toplanınca dağılım çubuk olarak görünür. Hoca kırılımı ayrı eşikle açılır.

import { useEffect, useMemo, useRef, useState } from "react";
import { RATINGS_API } from "@/lib/ratings/client";
import { personName } from "@/lib/format";
import { instructorSlug } from "@/lib/ratings/instructors";
import {
  fetchCourseGrades,
  forgetMyGrade,
  readMyGrades,
  removeGrade,
  saveMyGrade,
  sendGrade,
  type MyGrade,
} from "@/lib/grades/client";
import { LETTER_HINT, LETTER_ORDER, MIN_GRADES, recentTerms, termLabel, type CourseGrades as Summary, type Letter } from "@/lib/grades/types";
import styles from "./grades.module.css";

interface Props {
  school: string;
  /** Ders kodu ("CS 201"); sunucu anahtarı boşluksuz hâlidir. */
  code: string;
  /** Bu dersi veren hocalar (kaynaktaki yazımıyla). */
  instructors: readonly string[];
}

const key = (code: string) => code.replace(/\s+/g, "").toUpperCase();

/** Bir harfin yüzdesi; toplam sıfırsa 0. */
const share = (count: number, total: number) => (total > 0 ? (count / total) * 100 : 0);

export function CourseGrades({ school, code, instructors }: Props) {
  const course = key(code);
  const terms = useMemo(() => recentTerms(), []);
  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const name of instructors) seen.set(instructorSlug(name), name);
    return [...seen].map(([slug, name]) => ({ slug, name: personName(name) }));
  }, [instructors]);

  const [summary, setSummary] = useState<Summary | null>(null);
  const [ready, setReady] = useState(false);
  const [mine, setMine] = useState<MyGrade | null>(null);
  const [letter, setLetter] = useState<Letter | "">("");
  const [who, setWho] = useState("");
  // Varsayılan: notu çıkmış en yakın güz/bahar dönemi (yaz okulu azınlıktır).
  const [term, setTerm] = useState(terms.slice(1).find((t) => !t.endsWith("-yaz")) ?? terms[0]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = readMyGrades()[course];
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMine(saved);
      setLetter(saved.letter);
      setWho(saved.instructor ?? "");
      setTerm(saved.term);
    }
    fetchCourseGrades(school, course).then((data) => {
      setSummary(data);
      setReady(true);
    });
  }, [school, course]);

  if (!RATINGS_API) return null;

  const shown = pickedSlug ? summary?.instructors.find((i) => i.slug === pickedSlug) : null;
  const letters = shown ? shown.letters : (summary?.letters ?? {});
  const total = shown ? shown.n : (summary?.n ?? 0);
  const gpa = shown ? shown.gpa : (summary?.gpa ?? null);
  const pass = shown ? shown.pass : (summary?.pass ?? null);
  const max = Math.max(1, ...LETTER_ORDER.map((l) => letters[l] ?? 0));
  const hidden = summary?.hidden ?? true;
  const need = Math.max(0, MIN_GRADES - (summary?.n ?? 0));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!letter || busy) return;
    setBusy(true);
    setNote("");
    const grade: MyGrade = { letter, instructor: who || null, term };
    const res = await sendGrade(school, course, grade);
    setBusy(false);
    if (!res.ok) {
      setNote(res.error);
      return;
    }
    saveMyGrade(course, grade);
    setMine(grade);
    setSummary(res.grades);
    setNote("Notun eklendi, teşekkürler.");
  }

  async function drop() {
    if (busy) return;
    setBusy(true);
    setNote("");
    const res = await removeGrade(school, course);
    setBusy(false);
    if (!res.ok) {
      setNote(res.error);
      return;
    }
    forgetMyGrade(course);
    setMine(null);
    setLetter("");
    setWho("");
    setSummary(res.grades);
    setNote("Notun kaldırıldı.");
  }

  return (
    <section className={styles.root} aria-labelledby="not-dagilimi">
      <h2 className="group-title" style={{ fontSize: "1.25rem" }} id="not-dagilimi">
        Not dağılımı
      </h2>

      {!ready ? (
        <p className="hint">Yükleniyor…</p>
      ) : hidden ? (
        <p className={styles.empty}>
          {(summary?.n ?? 0) === 0
            ? "Bu ders için henüz not bildirilmedi."
            : `${summary?.n} kişi notunu bildirdi.`}{" "}
          Dağılımın görünmesi için {need} bildirim daha gerekiyor. Az sayıda bildirimde kimin ne aldığı belli
          olabileceği için dağılım gizli tutulur.
        </p>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={`${styles.big} num`}>{gpa?.toLocaleString("tr-TR", { minimumFractionDigits: 2 }) ?? "—"}</span>
              <span className={styles.statLabel}>Ortalama (4 üzerinden)</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.big} num`}>{pass === null ? "—" : `%${pass}`}</span>
              <span className={styles.statLabel}>Geçme oranı</span>
            </div>
            <div className={styles.stat}>
              <span className={`${styles.big} num`}>{total}</span>
              <span className={styles.statLabel}>Bildirim</span>
            </div>
          </div>

          {summary && summary.instructors.length > 0 && (
            <div className={styles.filter} role="group" aria-label="Hocaya göre">
              <button
                type="button"
                className={styles.chip}
                data-on={pickedSlug === null}
                onClick={() => setPickedSlug(null)}
              >
                Hepsi
              </button>
              {summary.instructors.map((row) => (
                <button
                  key={row.slug}
                  type="button"
                  className={styles.chip}
                  data-on={pickedSlug === row.slug}
                  onClick={() => setPickedSlug(row.slug)}
                >
                  {people.find((p) => p.slug === row.slug)?.name ?? row.slug} <span className="num">({row.n})</span>
                </button>
              ))}
            </div>
          )}

          <ul className={styles.bars}>
            {LETTER_ORDER.map((l) => {
              const count = letters[l] ?? 0;
              return (
                <li key={l} className={styles.bar} data-zero={count === 0}>
                  <span className={styles.barFill} style={{ height: `${(count / max) * 100}%` }} aria-hidden="true" />
                  <span className={`${styles.barCount} num`}>{count || ""}</span>
                  <span className={styles.barLabel} title={LETTER_HINT[l]}>
                    {l}
                  </span>
                  <span className="sr-only">
                    {l}: {count} kişi, yüzde {Math.round(share(count, total))}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <form className={styles.form} onSubmit={submit}>
        <h3 className={styles.formTitle}>{mine ? "Bildirdiğin not" : "Bu dersi aldıysan notunu ekle"}</h3>
        <p className="hint">İsimsizdir, kimliğin saklanmaz. Sonradan değiştirebilir ya da kaldırabilirsin.</p>

        <fieldset className={styles.letters}>
          <legend className={styles.legend}>Harf notun</legend>
          {LETTER_ORDER.map((l) => (
            <label key={l} className={styles.letter} data-on={letter === l}>
              <input type="radio" name="harf" value={l} checked={letter === l} onChange={() => setLetter(l)} />
              <span>{l}</span>
            </label>
          ))}
        </fieldset>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Hocan</span>
            <select className="select" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Hatırlamıyorum</option>
              {people.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Dönem</span>
            <select className="select" value={term} onChange={(e) => setTerm(e.target.value)}>
              {terms.map((t) => (
                <option key={t} value={t}>
                  {termLabel(t)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button type="submit" className="btn btn-pen" disabled={!letter || busy}>
            {mine ? "Güncelle" : "Gönder"}
          </button>
          {mine && (
            <button type="button" className="btn btn-small" onClick={drop} disabled={busy}>
              Notumu kaldır
            </button>
          )}
          {note && (
            <span className={styles.note} role="status">
              {note}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

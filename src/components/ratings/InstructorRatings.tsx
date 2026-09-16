"use client";
// Hoca sayfasının puan bölümü: özet sayılar, kriter çubukları ve yıldızlı puanlama formu.

import { useEffect, useState } from "react";
import { personName } from "@/lib/format";
import { RATINGS_API, readMyVotes, saveMyVote, sendVote, TURNSTILE_SITE_KEY, type MyVote } from "@/lib/ratings/client";
import { CRITERION_INFO, INSTRUCTOR_CRITERIA, oneDecimal, type Criteria, type InstructorSummary } from "@/lib/ratings/types";
import { clearRatingsCache, useRatings } from "@/lib/ratings/useRatings";
import { StarInput, Stars } from "./Stars";
import { Turnstile } from "./Turnstile";
import styles from "./hoca.module.css";

interface Props {
  school: string;
  slug: string;
  /** Hoca adı, kaynakta yazıldığı gibi. */
  name: string;
  /** Bu dönem verdiği ders sayısı. */
  courseCount: number;
}

export function InstructorRatings({ school, slug, name, courseCount }: Props) {
  const { summaries, ready } = useRatings(school);
  const [mine, setMine] = useState<MyVote | null>(null);
  const [fresh, setFresh] = useState<InstructorSummary | null>(null);
  const [open, setOpen] = useState(false);
  const [again, setAgain] = useState<boolean | null>(null);
  const [criteria, setCriteria] = useState<Criteria>({});
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"" | "sending" | "done" | string>("");

  useEffect(() => {
    const saved = readMyVotes()[slug];
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(saved);
    setAgain(saved.again);
    setCriteria(saved.criteria ?? {});
  }, [slug]);

  if (!RATINGS_API) return null;

  const summary = fresh ?? summaries?.instructors.find((i) => i.slug === slug);
  const answered = INSTRUCTOR_CRITERIA.filter((c) => criteria[c]).length;
  const complete = again !== null && answered > 0 && (!TURNSTILE_SITE_KEY || token);
  const display = personName(name);
  const myAnswers = mine ? INSTRUCTOR_CRITERIA.filter((c) => mine.criteria[c]) : [];

  async function submit() {
    if (!complete) return;
    setStatus("sending");
    const result = await sendVote({ school, slug, instructor: name, again: again === true, criteria, turnstile: token || undefined });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const vote: MyVote = { again: again === true, criteria };
    saveMyVote(slug, vote);
    clearRatingsCache(school);
    setMine(vote);
    setFresh(result.summary);
    setOpen(false);
    setStatus("done");
  }

  return (
    <>
      <section className={styles.stats} aria-label="Puan özeti">
        <div className={styles.stat}>
          <span className={styles.statValue}>
            <Stars score={summary?.score ?? null} size="m" />
          </span>
          <span className={styles.statLabel}>Genel puan</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{summary?.n ?? 0}</span>
          <span className={styles.statLabel}>Değerlendirme</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{summary ? `%${summary.again}` : "—"}</span>
          <span className={styles.statLabel}>Yine alırdım</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{courseCount}</span>
          <span className={styles.statLabel}>Bu dönem dersi</span>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="hoca-kriter">
          <h2 id="hoca-kriter" className={styles.cardTitle}>
            Değerlendirme kırılımı
          </h2>
          {summary && Object.keys(summary.criteria).length > 0 ? (
            <>
              <CriteriaBars criteria={summary.criteria} />
              <p className={styles.note}>
                <span className="num">{summary.n}</span> kişi puanladı.
              </p>
            </>
          ) : (
            <p className={styles.empty}>{!ready ? "Puanlar yükleniyor." : `${display} için henüz puan yok. İlk puanı sen ver.`}</p>
          )}
        </section>

        <section className={styles.card} aria-labelledby="hoca-puanla">
          <h2 id="hoca-puanla" className={styles.cardTitle}>
            {display} hocayı puanla
          </h2>

          {mine && !open && (
            <p className={styles.note}>
              Oyun kaydedildi: {mine.again ? "yine alırdın" : "yine almazdın"}
              {myAnswers.length > 0 &&
                `, ${myAnswers.map((c) => `${CRITERION_INFO[c].label.toLocaleLowerCase("tr")} ${mine.criteria[c]}/5`).join(", ")}`}
              .
            </p>
          )}

          {!open ? (
            <button type="button" className="btn btn-pen" onClick={() => setOpen(true)}>
              {mine ? "Oyumu değiştir" : "Puanla"}
            </button>
          ) : (
            <div className={styles.form}>
              {INSTRUCTOR_CRITERIA.map((key) => (
                <fieldset key={key} className={styles.field}>
                  <legend className={styles.legend}>{CRITERION_INFO[key].question}</legend>
                  <StarInput
                    value={criteria[key] ?? 0}
                    onChange={(v) => setCriteria((c) => ({ ...c, [key]: v || undefined }))}
                    label={CRITERION_INFO[key].label}
                    scale={CRITERION_INFO[key].scale}
                  />
                </fieldset>
              ))}

              <fieldset className={styles.field}>
                <legend className={styles.legend}>Baştan seçsen yine bu hocadan alır mıydın?</legend>
                <div className={styles.choices}>
                  <button type="button" className={styles.choice} aria-pressed={again === true} onClick={() => setAgain(true)}>
                    Alırdım
                  </button>
                  <button type="button" className={styles.choice} aria-pressed={again === false} onClick={() => setAgain(false)}>
                    Almazdım
                  </button>
                </div>
              </fieldset>

              {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} />}

              <div className={styles.actions}>
                <button type="button" className="btn btn-pen" disabled={!complete || status === "sending"} onClick={submit}>
                  {status === "sending" ? "Gönderiliyor" : mine ? "Oyumu güncelle" : "Oyumu gönder"}
                </button>
                <button type="button" className="btn btn-quiet" onClick={() => setOpen(false)}>
                  Vazgeç
                </button>
              </div>
              <p className={styles.note}>
                En az bir yıldız ve son soru gerekli. Adın, numaran ya da notun sorulmaz; yazılı yorum alınmaz. Oyunu
                sonra değiştirebilirsin.
              </p>
            </div>
          )}

          <p className={styles.status} role="status" aria-live="polite">
            {status === "done" ? "Oyun kaydedildi, teşekkürler." : status && status !== "sending" ? status : ""}
          </p>
        </section>
      </div>
    </>
  );
}

/** Kriterler: etiket, puan ve çubuk. Cevaplanmayan kriter listede görünmez. */
function CriteriaBars({ criteria }: { criteria: Criteria }) {
  return (
    <ul className={styles.bars}>
      {INSTRUCTOR_CRITERIA.filter((name) => typeof criteria[name] === "number").map((name) => {
        const value = criteria[name]!;
        return (
          <li key={name} className={styles.bar}>
            <span className={styles.barLabel}>{CRITERION_INFO[name].label}</span>
            <span className={`${styles.barValue} num`}>{oneDecimal(value)}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={{ width: `${(value / 5) * 100}%` }} />
            </span>
            <span className={styles.barNote}>{CRITERION_INFO[name].scale[Math.round(value) - 1]}</span>
          </li>
        );
      })}
    </ul>
  );
}

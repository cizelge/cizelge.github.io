"use client";
// Ders oylaması: zorluk, haftalık iş yükü ve "tekrar alır mıydın". İsim ve yazılı yorum alınmaz.
// Servis adresi verilmediyse bileşen hiç görünmez.

import { useEffect, useState } from "react";
import { personName } from "@/lib/format";
import { RATINGS_API, readMyVotes, saveMyVote, sendVote, TURNSTILE_SITE_KEY, type MyVote } from "@/lib/ratings/client";
import { CLARITY_LABELS, DIFFICULTY_LABELS, FAIRNESS_LABELS, WORKLOAD_SHORT, type CourseSummary } from "@/lib/ratings/types";
import { clearRatingsCache, useRatings } from "@/lib/ratings/useRatings";
import { CourseRating } from "./CourseRating";
import { Turnstile } from "./Turnstile";
import styles from "./ratings.module.css";

interface Props {
  school: string;
  code: string;
  /** Dersi veren hocalar; öğrenci hangisinden aldığını seçer. */
  instructors: string[];
}

export function RateCourse({ school, code, instructors }: Props) {
  const { summaries, ready } = useRatings(school);
  const [mine, setMine] = useState<MyVote | null>(null);
  const [open, setOpen] = useState(false);
  const [difficulty, setDifficulty] = useState(0);
  const [workload, setWorkload] = useState(0);
  const [again, setAgain] = useState<boolean | null>(null);
  const [instructor, setInstructor] = useState("");
  const [clarity, setClarity] = useState(0);
  const [fairness, setFairness] = useState(0);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"" | "sending" | "done" | string>("");
  const [fresh, setFresh] = useState<CourseSummary | null>(null);

  useEffect(() => {
    const vote = readMyVotes()[code];
    if (!vote) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(vote);
    setDifficulty(vote.difficulty);
    setWorkload(vote.workload);
    setAgain(vote.again);
    setInstructor(vote.instructor ?? "");
    setClarity(vote.clarity ?? 0);
    setFairness(vote.fairness ?? 0);
  }, [code]);

  if (!RATINGS_API) return null;

  const summary = fresh ?? summaries?.courses[code];
  const complete = difficulty > 0 && workload > 0 && again !== null && (!TURNSTILE_SITE_KEY || token);

  async function submit() {
    if (!complete) return;
    setStatus("sending");
    const result = await sendVote({
      school,
      code,
      instructor: instructor || null,
      difficulty,
      workload,
      again: again === true,
      clarity: instructor && clarity ? clarity : null,
      fairness: instructor && fairness ? fairness : null,
      turnstile: token || undefined,
    });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const vote: MyVote = {
      difficulty,
      workload,
      again: again === true,
      instructor: instructor || null,
      clarity: instructor && clarity ? clarity : null,
      fairness: instructor && fairness ? fairness : null,
    };
    saveMyVote(code, vote);
    setMine(vote);
    setFresh(result.summary);
    clearRatingsCache(school);
    setOpen(false);
    setStatus("done");
  }

  return (
    <section className={styles.root} aria-labelledby={`oy-${code}`}>
      <h2 id={`oy-${code}`} className="group-title">
        Öğrenciler ne diyor
      </h2>

      {summary ? (
        <CourseRating summary={summary} />
      ) : (
        <p className={styles.empty}>
          {ready ? "Bu ders için henüz yeterli oy yok. İlk oylayan sen ol." : "Oylar yükleniyor."}
        </p>
      )}

      {mine && !open && (
        <p className={styles.mine}>
          Oyun kaydedildi: zorluk {mine.difficulty}/5, {WORKLOAD_SHORT[mine.workload - 1]},{" "}
          {mine.again ? "tekrar alırdın" : "tekrar almazdın"}.{" "}
          <button type="button" className={styles.linkBtn} onClick={() => setOpen(true)}>
            Değiştir
          </button>
        </p>
      )}

      {!open && !mine && (
        <button type="button" className="btn btn-pen" onClick={() => setOpen(true)}>
          Bu dersi oyla
        </button>
      )}

      {open && (
        <div className={styles.form}>
          <fieldset className={styles.field}>
            <legend className={styles.legend}>Ders ne kadar zordu?</legend>
            <div className={styles.choices}>
              {DIFFICULTY_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={styles.choice}
                  aria-pressed={difficulty === i + 1}
                  onClick={() => setDifficulty(i + 1)}
                >
                  <span className="num">{i + 1}</span> {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.legend}>Ders dışında haftada ne kadar çalıştın?</legend>
            <div className={styles.choices}>
              {WORKLOAD_SHORT.map((label, i) => (
                <button key={label} type="button" className={styles.choice} aria-pressed={workload === i + 1} onClick={() => setWorkload(i + 1)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.field}>
            <legend className={styles.legend}>Baştan seçsen yine alır mıydın?</legend>
            <div className={styles.choices}>
              <button type="button" className={styles.choice} aria-pressed={again === true} onClick={() => setAgain(true)}>
                Alırdım
              </button>
              <button type="button" className={styles.choice} aria-pressed={again === false} onClick={() => setAgain(false)}>
                Almazdım
              </button>
            </div>
          </fieldset>

          {instructors.length > 0 && (
            <label className={styles.field}>
              <span className={styles.legend}>Kimden aldın? (isteğe bağlı)</span>
              <select className={styles.select} value={instructor} onChange={(e) => setInstructor(e.target.value)}>
                <option value="">Söylemek istemiyorum</option>
                {instructors.map((name) => (
                  <option key={name} value={name}>
                    {personName(name)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {instructor && (
            <>
              <fieldset className={styles.field}>
                <legend className={styles.legend}>
                  Anlatımı anlaşılır mıydı? <span className={styles.optional}>isteğe bağlı</span>
                </legend>
                <div className={styles.choices}>
                  {CLARITY_LABELS.map((label, i) => (
                    <button key={label} type="button" className={styles.choice} aria-pressed={clarity === i + 1} onClick={() => setClarity(clarity === i + 1 ? 0 : i + 1)}>
                      <span className="num">{i + 1}</span> {label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className={styles.field}>
                <legend className={styles.legend}>
                  Notlandırması adil miydi? <span className={styles.optional}>isteğe bağlı</span>
                </legend>
                <div className={styles.choices}>
                  {FAIRNESS_LABELS.map((label, i) => (
                    <button key={label} type="button" className={styles.choice} aria-pressed={fairness === i + 1} onClick={() => setFairness(fairness === i + 1 ? 0 : i + 1)}>
                      <span className="num">{i + 1}</span> {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}

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
            Yalnızca bu cevaplar gönderilir. Adın, numaran ya da notun sorulmaz; yazılı yorum alınmaz. Oyunu sonra
            değiştirebilirsin.
          </p>
        </div>
      )}

      <p className={styles.status} role="status" aria-live="polite">
        {status === "done" ? "Oyun kaydedildi, teşekkürler." : status && status !== "sending" ? status : ""}
      </p>
    </section>
  );
}

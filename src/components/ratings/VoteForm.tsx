"use client";
// Oylama formu: zorluk, haftalık iş yükü, "tekrar alır mıydın" ve hoca seçilirse iki soru daha.
// Ders sayfasında ve Oylar sayfasında aynı form kullanılır.

import { useEffect, useState } from "react";
import { personName } from "@/lib/format";
import { readMyVotes, saveMyVote, sendVote, TURNSTILE_SITE_KEY, type MyVote } from "@/lib/ratings/client";
import { CLARITY_LABELS, DIFFICULTY_LABELS, FAIRNESS_LABELS, WORKLOAD_SHORT, type CourseSummary } from "@/lib/ratings/types";
import { clearRatingsCache } from "@/lib/ratings/useRatings";
import { Turnstile } from "./Turnstile";
import styles from "./ratings.module.css";

interface Props {
  school: string;
  code: string;
  /** Dersi veren hocalar; öğrenci hangisinden aldığını seçer. */
  instructors: string[];
  /** Hoca listesinden gelindiyse o hoca seçili başlar. */
  presetInstructor?: string;
  /** Bu tarayıcıda daha önce verilmiş oy; alanlar dolu gelir. */
  initial?: MyVote | null;
  onDone: (vote: MyVote, summary: CourseSummary | null) => void;
  onCancel: () => void;
}

export function VoteForm({ school, code, instructors, presetInstructor, initial, onDone, onCancel }: Props) {
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 0);
  const [workload, setWorkload] = useState(initial?.workload ?? 0);
  const [again, setAgain] = useState<boolean | null>(initial ? initial.again : null);
  const [instructor, setInstructor] = useState(initial?.instructor ?? presetInstructor ?? "");
  const [clarity, setClarity] = useState(initial?.clarity ?? 0);
  const [fairness, setFairness] = useState(initial?.fairness ?? 0);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"" | "sending" | string>("");

  useEffect(() => {
    if (initial) return;
    const saved = readMyVotes()[code];
    if (!saved) return;
    // Kayıt yalnızca tarayıcıda bilinir; form açıldıktan sonra bir kez doldurulur.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDifficulty(saved.difficulty);
    setWorkload(saved.workload);
    setAgain(saved.again);
    setInstructor(saved.instructor ?? presetInstructor ?? "");
    setClarity(saved.clarity ?? 0);
    setFairness(saved.fairness ?? 0);
  }, [code, initial, presetInstructor]);

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
    clearRatingsCache(school);
    setStatus("");
    onDone(vote, result.summary);
  }

  return (
    <div className={styles.form}>
      <fieldset className={styles.field}>
        <legend className={styles.legend}>{code} ne kadar zordu?</legend>
        <div className={styles.choices}>
          {DIFFICULTY_LABELS.map((label, i) => (
            <button key={label} type="button" className={styles.choice} aria-pressed={difficulty === i + 1} onClick={() => setDifficulty(i + 1)}>
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
          <span className={styles.legend}>
            Kimden aldın? <span className={styles.optional}>isteğe bağlı</span>
          </span>
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
              {personName(instructor)} anlaşılır anlatıyor muydu? <span className={styles.optional}>isteğe bağlı</span>
            </legend>
            <div className={styles.choices}>
              {CLARITY_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={styles.choice}
                  aria-pressed={clarity === i + 1}
                  onClick={() => setClarity(clarity === i + 1 ? 0 : i + 1)}
                >
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
                <button
                  key={label}
                  type="button"
                  className={styles.choice}
                  aria-pressed={fairness === i + 1}
                  onClick={() => setFairness(fairness === i + 1 ? 0 : i + 1)}
                >
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
          {status === "sending" ? "Gönderiliyor" : initial ? "Oyumu güncelle" : "Oyumu gönder"}
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          Vazgeç
        </button>
        {status && status !== "sending" && (
          <span className={styles.error} role="status">
            {status}
          </span>
        )}
      </div>
      <p className={styles.note}>
        Yalnızca bu cevaplar gönderilir. Adın, numaran ya da notun sorulmaz; yazılı yorum alınmaz. Oyunu sonra
        değiştirebilirsin.
      </p>
    </div>
  );
}

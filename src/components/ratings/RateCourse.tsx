"use client";
// Ders sayfasındaki oy bölümü: özet, kendi oyun ve oylama formu.
// Servis adresi verilmediyse bileşen hiç görünmez.

import { useEffect, useState } from "react";
import { RATINGS_API, readMyVotes, type MyVote } from "@/lib/ratings/client";
import { WORKLOAD_SHORT, type CourseSummary } from "@/lib/ratings/types";
import { useRatings } from "@/lib/ratings/useRatings";
import { CourseRating } from "./CourseRating";
import { VoteForm } from "./VoteForm";
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
  const [done, setDone] = useState(false);
  const [fresh, setFresh] = useState<CourseSummary | null>(null);

  useEffect(() => {
    const vote = readMyVotes()[code];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (vote) setMine(vote);
  }, [code]);

  if (!RATINGS_API) return null;

  const summary = fresh ?? summaries?.courses[code];

  return (
    <section className={styles.root} aria-labelledby={`oy-${code}`}>
      <h2 id={`oy-${code}`} className="group-title">
        Öğrenciler ne diyor
      </h2>

      {summary ? (
        <CourseRating summary={summary} />
      ) : (
        <p className={styles.empty}>{ready ? "Bu ders için henüz yeterli oy yok. İlk oylayan sen ol." : "Oylar yükleniyor."}</p>
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
        <VoteForm
          school={school}
          code={code}
          instructors={instructors}
          initial={mine}
          onCancel={() => setOpen(false)}
          onDone={(vote, summaryAfter) => {
            setMine(vote);
            setFresh(summaryAfter);
            setOpen(false);
            setDone(true);
          }}
        />
      )}

      <p className={styles.status} role="status" aria-live="polite">
        {done && !open ? "Oyun kaydedildi, teşekkürler." : ""}
      </p>
    </section>
  );
}

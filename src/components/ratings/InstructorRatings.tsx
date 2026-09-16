"use client";
// Hoca sayfasının oy bölümü: özet sayılar, kriter çubukları, ders kırılımı ve puanlama paneli.

import Link from "next/link";
import { useEffect, useState } from "react";
import { personName } from "@/lib/format";
import { RATINGS_API, readMyVotes, type MyVote } from "@/lib/ratings/client";
import { instructorScore, oneDecimal, type CourseSummary, type InstructorSummary } from "@/lib/ratings/types";
import { instructorSlug } from "@/lib/ratings/instructors";
import { useRatings } from "@/lib/ratings/useRatings";
import { CriteriaBars, ScoreBadge } from "./ScoreBits";
import { VoteForm } from "./VoteForm";
import styles from "./hoca.module.css";

export interface TaughtCourse {
  code: string;
  title: string;
  slug: string;
  instructors: string[];
}

interface Props {
  school: string;
  slug: string;
  name: string;
  /** Hocanın bu dönemki dersleri. */
  courses: TaughtCourse[];
}

export function InstructorRatings({ school, slug, name, courses }: Props) {
  const { summaries, ready } = useRatings(school);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Record<string, CourseSummary | null>>({});
  const [thanks, setThanks] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyVotes(readMyVotes());
  }, []);

  if (!RATINGS_API) return null;

  const summary: InstructorSummary | undefined = summaries?.instructors?.find((i) => instructorSlug(i.name) === slug);
  const score = summary ? instructorScore(summary.criteria) : null;
  const voted = courses.filter((c) => myVotes[c.code]).length;

  return (
    <>
      <section className={styles.stats} aria-label="Puan özeti">
        <div className={styles.stat}>
          <span className={styles.statValue}>
            <ScoreBadge score={score} size="l" />
          </span>
          <span className={styles.statLabel}>Genel puan</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{summary?.n ?? 0}</span>
          <span className={styles.statLabel}>Değerlendirme</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{courses.length}</span>
          <span className={styles.statLabel}>Bu dönem dersi</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{summary ? oneDecimal(summary.difficulty) : "—"}</span>
          <span className={styles.statLabel}>Ders zorluğu</span>
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.card} aria-labelledby="hoca-kriter">
          <h2 id="hoca-kriter" className={styles.cardTitle}>
            Değerlendirme kırılımı
          </h2>
          {summary ? (
            <>
              <CriteriaBars criteria={summary.criteria} />
              <p className={styles.note}>
                %<span className="num">{summary.again}</span> &ldquo;bu dersi yine alırdım&rdquo; dedi.{" "}
                <span className="num">{summary.n}</span> oy, bütün dersleri birlikte.
              </p>
            </>
          ) : (
            <p className={styles.empty}>
              {!ready ? "Oylar yükleniyor." : `${personName(name)} için henüz yeterli oy yok. Puanlar 5 oydan sonra görünür.`}
            </p>
          )}
        </section>

        <section className={styles.card} aria-labelledby="hoca-dersler">
          <h2 id="hoca-dersler" className={styles.cardTitle}>
            Bu dönem verdiği dersler
          </h2>
          {courses.length === 0 ? (
            <p className={styles.empty}>Bu dönem dersi görünmüyor.</p>
          ) : (
            <ul className={styles.courses}>
              {courses.map((course) => {
                const courseSummary = fresh[course.code] ?? summaries?.courses[course.code];
                const mine = myVotes[course.code];
                const isOpen = open === course.code;
                return (
                  <li key={course.code} className={styles.course}>
                    <div className={styles.courseHead}>
                      <Link href={`/ozyegin/${course.slug}`} className={`${styles.code} num`}>
                        {course.code}
                      </Link>
                      <span className={styles.courseTitle}>{course.title}</span>
                      <button
                        type="button"
                        className={`btn btn-small ${mine ? "btn-quiet" : "btn-pen"} ${styles.action}`}
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : course.code)}
                      >
                        {isOpen ? "Kapat" : mine ? "Oyumu değiştir" : "Puanla"}
                      </button>
                    </div>
                    <p className={styles.courseMeta}>
                      {courseSummary
                        ? `Zorluk ${oneDecimal(courseSummary.difficulty)}/5, %${courseSummary.again} tekrar alır (${courseSummary.n} oy)`
                        : "henüz yeterli oy yok"}
                    </p>
                    {isOpen && (
                      <VoteForm
                        school={school}
                        code={course.code}
                        instructors={course.instructors}
                        presetInstructor={name}
                        initial={mine ?? null}
                        onCancel={() => setOpen(null)}
                        onDone={(vote, summaryAfter) => {
                          setMyVotes((v) => ({ ...v, [course.code]: vote }));
                          setFresh((f) => ({ ...f, [course.code]: summaryAfter }));
                          setOpen(null);
                          setThanks(`${course.code} oyun kaydedildi, teşekkürler.`);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.note}>
            {voted > 0 ? `Bu hocadan ${voted} dersi oyladın.` : "Aldığın dersi seçip puanla; oylar isimsizdir."}
          </p>
        </section>
      </div>

      <p className={styles.status} role="status" aria-live="polite">
        {thanks}
      </p>
    </>
  );
}

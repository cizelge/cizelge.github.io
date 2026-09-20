"use client";
// Ders sayfasının puanlama bölümü: özet sayılar, kriter çubukları, isimsiz yorumlar ve puanlama paneli.
// Hoca sayfasıyla aynı düzeni kullanır (hoca.module.css), kriterler derse göredir.

import { useEffect, useRef, useState } from "react";
import { RATINGS_API, TURNSTILE_SITE_KEY } from "@/lib/ratings/client";
import {
  forgetMyCourseVote,
  readMyCourseVotes,
  removeCourseVote,
  reportCourseComment,
  saveMyCourseVote,
  sendCourseVote,
  type MyCourseVote,
} from "@/lib/ratings/course-client";
import {
  COURSE_CRITERIA,
  COURSE_CRITERION_INFO,
  courseKey,
  type CourseCriteria,
  type CourseSummary,
} from "@/lib/ratings/course-types";
import { clearCourseRatingsCache, useCourseRatings } from "@/lib/ratings/useCourseRatings";
import { MAX_COMMENT, oneDecimal, sinceLabel, type Comment } from "@/lib/ratings/types";
import { Stars, StarInput } from "./Stars";
import { Turnstile } from "./Turnstile";
import styles from "./hoca.module.css";

interface Props {
  school: string;
  /** Ders kodu ("CS 201"). */
  code: string;
  title: string;
}

export function CourseRatings({ school, code, title }: Props) {
  const key = courseKey(code);
  const { summaries, ready } = useCourseRatings(school);
  const [mine, setMine] = useState<MyCourseVote | null>(null);
  // undefined: sunucudan gelen listeyi kullan. null: bu dersin hiç oyu kalmadı.
  const [fresh, setFresh] = useState<CourseSummary | null | undefined>(undefined);
  const [again, setAgain] = useState<boolean | null>(null);
  const [criteria, setCriteria] = useState<CourseCriteria>({});
  const [comment, setComment] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = readMyCourseVotes()[key];
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(saved);
    setAgain(saved.again);
    setCriteria(saved.criteria ?? {});
    setComment(saved.comment ?? "");
  }, [key]);

  if (!RATINGS_API) return null;

  const summary = fresh !== undefined ? (fresh ?? undefined) : summaries?.courses.find((c) => c.course === key);
  const answered = COURSE_CRITERIA.filter((c) => criteria[c]).length;
  const complete = again !== null && answered > 0 && (!TURNSTILE_SITE_KEY || token);
  const myAnswers = mine ? COURSE_CRITERIA.filter((c) => mine.criteria[c]) : [];

  async function submit() {
    if (!complete) return;
    setStatus("sending");
    const result = await sendCourseVote(school, code, title, {
      again: again === true,
      criteria,
      comment: comment.trim() || null,
    });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const vote: MyCourseVote = { again: again === true, criteria, comment: comment.trim() || null };
    saveMyCourseVote(code, vote);
    clearCourseRatingsCache(school);
    setMine(vote);
    setFresh(result.summary);
    setStatus("done");
  }

  async function drop() {
    setStatus("removing");
    const result = await removeCourseVote(school, code);
    if (!result.ok) {
      setStatus("Oy kaldırılamadı, sonra dene");
      return;
    }
    forgetMyCourseVote(code);
    clearCourseRatingsCache(school);
    setMine(null);
    setFresh(result.summary);
    setAgain(null);
    setCriteria({});
    setComment("");
    setStatus("removed");
  }

  return (
    <section aria-labelledby="ders-puani" className={styles.courseBlock}>
      <h2 className="group-title" style={{ fontSize: "1.25rem" }} id="ders-puani">
        Ders puanı
      </h2>

      <section className={styles.stats} aria-label="Puan özeti">
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{summary?.n ?? 0}</span>
          <span className={styles.statLabel}>Değerlendirme</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{summary?.comments.length ?? 0}</span>
          <span className={styles.statLabel}>Yorum</span>
        </div>
        <div className={styles.stat}>
          <span className={`${styles.statValue} num`}>{summary ? `%${summary.again}` : "—"}</span>
          <span className={styles.statLabel}>Yine alırdım</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            <Stars score={summary?.score ?? null} size="m" />
          </span>
          <span className={styles.statLabel}>Ortalama puan</span>
        </div>
      </section>

      <div className={styles.courseTop}>
        <div className={styles.left}>
          <section className={styles.card} aria-labelledby="ders-kriter">
            <h3 id="ders-kriter" className={styles.cardTitle}>
              Değerlendirme kırılımı
            </h3>
            {summary && Object.keys(summary.criteria).length > 0 ? (
              <>
                <ul className={styles.bars}>
                  {COURSE_CRITERIA.filter((name) => typeof summary.criteria[name] === "number").map((name) => {
                    const value = summary.criteria[name]!;
                    return (
                      <li key={name} className={styles.bar}>
                        <span className={styles.barLabel}>{COURSE_CRITERION_INFO[name].label}</span>
                        <span className={`${styles.barValue} num`}>{oneDecimal(value)}</span>
                        <span className={styles.track} aria-hidden="true">
                          <span className={styles.fill} style={{ width: `${(value / 5) * 100}%` }} />
                        </span>
                        <span className={styles.barNote}>{COURSE_CRITERION_INFO[name].scale[Math.round(value) - 1]}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className={styles.note}>
                  <span className="num">{summary.n}</span> kişi puanladı. Ortalama puan yalnızca faydası ve ilgi
                  çekiciliğinden gelir; zorluk ile iş yükü ayrı gösterilir.
                </p>
              </>
            ) : (
              <p className={styles.empty}>
                {!ready ? "Puanlar yükleniyor." : "Bu ders için henüz puan yok. İlk puanı sen ver."}
              </p>
            )}
          </section>

        </div>

        <div className={styles.right}>
          <div className={styles.stickyTop}>
            <section className={styles.card} aria-labelledby="ders-puanla">
              <h3 id="ders-puanla" className={styles.cardTitle}>
                Bu dersi puanla
              </h3>

              {mine && (
                <p className={styles.mineLine}>
                  <span>
                    Oyun kaydedildi: {mine.again ? "yine alırdın" : "yine almazdın"}
                    {myAnswers.length > 0 &&
                      `, ${myAnswers
                        .map((c) => `${COURSE_CRITERION_INFO[c].label.toLocaleLowerCase("tr")} ${mine.criteria[c]}/5`)
                        .join(", ")}`}
                    .
                  </span>
                  <button type="button" className={styles.remove} disabled={status === "removing"} onClick={drop}>
                    {status === "removing" ? "Kaldırılıyor" : "Oyumu kaldır"}
                  </button>
                </p>
              )}

              <div className={styles.form}>
                {COURSE_CRITERIA.map((name) => (
                  <fieldset key={name} className={styles.field}>
                    <legend className={styles.legend}>
                      {COURSE_CRITERION_INFO[name].label}{" "}
                      <span className={styles.optional}>{COURSE_CRITERION_INFO[name].hint}</span>
                    </legend>
                    <StarInput
                      value={criteria[name] ?? 0}
                      onChange={(v) => setCriteria((c) => ({ ...c, [name]: v || undefined }))}
                      label={COURSE_CRITERION_INFO[name].label}
                      scale={COURSE_CRITERION_INFO[name].scale}
                    />
                  </fieldset>
                ))}

                <fieldset className={styles.field}>
                  <legend className={styles.legend}>Baştan seçsen yine bu dersi alır mıydın?</legend>
                  <div className={styles.choices} role="radiogroup" aria-label="Yine alır mıydın">
                    <ThumbChoice picked={again === true} up onClick={() => setAgain(true)} label="Alırdım" note="yine seçerdim" />
                    <ThumbChoice picked={again === false} onClick={() => setAgain(false)} label="Almazdım" note="uzak dururdum" />
                  </div>
                </fieldset>

                <label className={styles.field}>
                  <span className={styles.legend}>
                    Yorumun <span className={styles.optional}>isteğe bağlı, isimsiz</span>
                  </span>
                  <textarea
                    className={styles.textarea}
                    value={comment}
                    maxLength={MAX_COMMENT}
                    rows={3}
                    placeholder="Bu dersi alacak birine ne söylerdin?"
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <span className={styles.counter}>
                    <span className="num">{comment.trim().length}</span>/{MAX_COMMENT}
                    {comment.trim().length > 0 && comment.trim().length < 10 ? " · en az 10 karakter" : ""}
                  </span>
                </label>

                {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} />}

                <button
                  type="button"
                  className={`btn btn-pen ${styles.send}`}
                  disabled={!complete || status === "sending"}
                  onClick={submit}
                >
                  {status === "sending" ? "Gönderiliyor" : mine ? "Oyumu güncelle" : "Oyumu gönder"}
                </button>
                <p className={styles.note}>
                  En az bir yıldız ve &ldquo;yine alır mıydın&rdquo; gerekli. Adın, numaran ya da notun sorulmaz.
                </p>
              </div>

              <p className={styles.status} role="status" aria-live="polite">
                {status === "done"
                  ? "Oyun kaydedildi, teşekkürler."
                  : status === "removed"
                    ? "Oyun kaldırıldı."
                    : status && status !== "sending" && status !== "removing"
                      ? status
                      : ""}
              </p>
            </section>
          </div>
        </div>
      </div>

      <CourseComments school={school} code={code} comments={summary?.comments ?? []} ready={ready} />
    </section>
  );
}

/** Ders yorumları; her yorumun yanında bildirme bağlantısı. */
function CourseComments({ school, code, comments, ready }: { school: string; code: string; comments: Comment[]; ready: boolean }) {
  const [reported, setReported] = useState<Record<string, boolean>>({});

  return (
    <section className={styles.card} aria-labelledby="ders-yorumlar">
      <h3 id="ders-yorumlar" className={styles.cardTitle}>
        Yorumlar {comments.length > 0 && <span className={`${styles.count} num`}>{comments.length}</span>}
      </h3>
      {comments.length === 0 ? (
        <p className={styles.empty}>{ready ? "Henüz yorum yok. İlk yazan sen ol." : "Yorumlar yükleniyor."}</p>
      ) : (
        <ul className={styles.comments}>
          {comments.map((c) => (
            <li key={c.id} className={styles.comment}>
              <div className={styles.commentHead}>
                <Stars score={c.score} size="s" showValue={false} />
                <span className={styles.commentTag}>{c.again ? "yine alırdı" : "yine almazdı"}</span>
                <span className={styles.commentWhen}>{sinceLabel(c.at)}</span>
              </div>
              <p className={styles.commentText}>{c.text}</p>
              <button
                type="button"
                className={styles.report}
                disabled={reported[c.id]}
                onClick={async () => {
                  const ok = await reportCourseComment(school, code, c.id);
                  if (ok) setReported((r) => ({ ...r, [c.id]: true }));
                }}
              >
                {reported[c.id] ? "Bildirildi" : "Bildir"}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        Yorumlar isimsizdir ve öğrencilerden gelir. Hakaret içeren bir yorum görürsen bildir; yeterince bildirim alan
        yorum kendiliğinden gizlenir.
      </p>
    </section>
  );
}

/** "Alırdım / Almazdım": başparmak simgeli iki eşit kutu. */
function ThumbChoice({
  picked,
  up = false,
  label,
  note,
  onClick,
}: {
  picked: boolean;
  up?: boolean;
  label: string;
  note: string;
  onClick: () => void;
}) {
  return (
    <button type="button" role="radio" aria-checked={picked} className={styles.thumb} data-picked={picked} onClick={onClick}>
      <span className={styles.thumbIcon} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" style={up ? undefined : { transform: "rotate(180deg)" }}>
          <path
            d="M8.5 10.5L12 3.8c1.4 0 2.4 1.1 2.4 2.5v2.6h4c1.2 0 2.1 1.1 1.8 2.3l-1.4 6c-.2.9-1 1.5-1.9 1.5H8.5z"
            fill={picked ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="3.4" y="10.5" width="3.6" height="8.2" rx="1.1" fill={picked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </span>
      <span className={styles.thumbText}>
        <span className={styles.thumbLabel}>{label}</span>
        <span className={styles.thumbNote}>{note}</span>
      </span>
    </button>
  );
}

"use client";
// Hoca sayfasının puan bölümü: özet sayılar, kriter çubukları, isimsiz yorumlar ve yıldızlı puanlama paneli.

import { useEffect, useState } from "react";
import { personName } from "@/lib/format";
import {
  RATINGS_API,
  readMyVotes,
  removeVote,
  reportComment,
  saveMyVote,
  sendVote,
  TURNSTILE_SITE_KEY,
  type MyVote,
} from "@/lib/ratings/client";
import {
  CRITERION_INFO,
  INSTRUCTOR_CRITERIA,
  MAX_COMMENT,
  oneDecimal,
  sinceLabel,
  type Comment,
  type Criteria,
  type InstructorSummary,
} from "@/lib/ratings/types";
import { clearRatingsCache, useRatings } from "@/lib/ratings/useRatings";
import { StarInput, Stars } from "./Stars";
import { Turnstile } from "./Turnstile";
import styles from "./hoca.module.css";

interface Props {
  school: string;
  slug: string;
  /** Hoca adı, kaynakta yazıldığı gibi. */
  name: string;
  /** Başlık bandının içeriği: geri bağlantısı, ad ve alt satırlar. */
  heading: React.ReactNode;
  /** Sol sütunda gösterilecek "Hoca hakkında" kartı. */
  about: React.ReactNode;
  /** Sol sütunda gösterilecek ders listesi. */
  courses: React.ReactNode;
}

export function InstructorRatings({ school, slug, name, heading, about, courses }: Props) {
  const { summaries, ready } = useRatings(school);
  const [mine, setMine] = useState<MyVote | null>(null);
  const [fresh, setFresh] = useState<InstructorSummary | null>(null);
  const [again, setAgain] = useState<boolean | null>(null);
  const [criteria, setCriteria] = useState<Criteria>({});
  const [comment, setComment] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"" | "sending" | "removing" | "done" | "removed" | string>("");

  useEffect(() => {
    const saved = readMyVotes()[slug];
    if (!saved) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMine(saved);
    setAgain(saved.again);
    setCriteria(saved.criteria ?? {});
    setComment(saved.comment ?? "");
  }, [slug]);

  const summary = fresh ?? summaries?.instructors.find((i) => i.slug === slug);
  const answered = INSTRUCTOR_CRITERIA.filter((c) => criteria[c]).length;
  const complete = again !== null && answered > 0 && (!TURNSTILE_SITE_KEY || token);
  const display = personName(name);
  const myAnswers = mine ? INSTRUCTOR_CRITERIA.filter((c) => mine.criteria[c]) : [];

  async function submit() {
    if (!complete) return;
    setStatus("sending");
    const result = await sendVote({
      school,
      slug,
      instructor: name,
      again: again === true,
      criteria,
      comment: comment.trim() || null,
      turnstile: token || undefined,
    });
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const vote: MyVote = { again: again === true, criteria, comment: comment.trim() || null };
    saveMyVote(slug, vote);
    clearRatingsCache(school);
    setMine(vote);
    setFresh(result.summary);
    setStatus("done");
  }

  const panel = !RATINGS_API ? null : (
    <section className={styles.card} aria-labelledby="hoca-puanla">
      <h2 id="hoca-puanla" className={styles.cardTitle}>
        {display} hocayı puanla
      </h2>

      {mine && (
        <p className={styles.mineLine}>
          <span>
            Oyun kaydedildi: {mine.again ? "yine alırdın" : "yine almazdın"}
            {myAnswers.length > 0 &&
              `, ${myAnswers.map((c) => `${CRITERION_INFO[c].label.toLocaleLowerCase("tr")} ${mine.criteria[c]}/5`).join(", ")}`}
            .
          </span>
          <button
            type="button"
            className={styles.remove}
            disabled={status === "removing"}
            onClick={async () => {
              setStatus("removing");
              const result = await removeVote(school, slug);
              if (!result.ok) {
                setStatus("Oy kaldırılamadı, sonra dene");
                return;
              }
              setMine(null);
              setFresh(result.summary);
              setAgain(null);
              setCriteria({});
              setComment("");
              clearRatingsCache(school);
              setStatus("removed");
            }}
          >
            {status === "removing" ? "Kaldırılıyor" : "Oyumu kaldır"}
          </button>
        </p>
      )}

      <div className={styles.form}>
        {INSTRUCTOR_CRITERIA.map((key) => (
          <fieldset key={key} className={styles.field}>
            <legend className={styles.legend}>
              {CRITERION_INFO[key].label} <span className={styles.optional}>{CRITERION_INFO[key].hint}</span>
            </legend>
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
            placeholder="Dersi alacak birine ne söylerdin?"
            onChange={(e) => setComment(e.target.value)}
          />
          <span className={styles.counter}>
            <span className="num">{comment.trim().length}</span>/{MAX_COMMENT}
            {comment.trim().length > 0 && comment.trim().length < 10 ? " · en az 10 karakter" : ""}
          </span>
        </label>

        {TURNSTILE_SITE_KEY && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} />}

        <button type="button" className={`btn btn-pen ${styles.send}`} disabled={!complete || status === "sending"} onClick={submit}>
          {status === "sending" ? "Gönderiliyor" : mine ? "Oyumu güncelle" : "Oyumu gönder"}
        </button>
        <p className={styles.note}>
          En az bir yıldız ve &ldquo;yine alır mıydın&rdquo; gerekli. Adın, numaran ya da notun sorulmaz. Yorumun isimsiz
          yayımlanır; hakaret içeren yorumlar kabul edilmez.
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
  );

  return (
    <>
      <div className={styles.band}>
        <div className={styles.bandInner}>
          {heading}
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
        </div>
      </div>

      <div className={styles.body}>
      <div className={styles.grid}>
        <div className={styles.left}>
          {about}
          {courses}
          {RATINGS_API && <Comments school={school} slug={slug} comments={summary?.comments ?? []} ready={ready} />}
        </div>

        <div className={styles.right}>
          <div className={styles.sticky}>
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
                <p className={styles.empty}>
                  {!RATINGS_API
                    ? "Puanlama kapalı."
                    : !ready
                      ? "Puanlar yükleniyor."
                      : `${display} için henüz puan yok. İlk puanı sen ver.`}
                </p>
              )}
            </section>
            {panel}
          </div>
        </div>
      </div>
      <p className={styles.note}>Puanlar ve yorumlar öğrencilerden gelir, isimsizdir. Resmi bir değerlendirme değildir.</p>
      </div>
    </>
  );
}

/** İsimsiz yorumlar; her yorumun yanında bildirme bağlantısı. */
function Comments({ school, slug, comments, ready }: { school: string; slug: string; comments: Comment[]; ready: boolean }) {
  const [reported, setReported] = useState<Record<string, boolean>>({});

  return (
    <section className={styles.card} aria-labelledby="hoca-yorumlar">
      <h2 id="hoca-yorumlar" className={styles.cardTitle}>
        Yorumlar {comments.length > 0 && <span className={`${styles.count} num`}>{comments.length}</span>}
      </h2>
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
                  const ok = await reportComment(school, slug, c.id);
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

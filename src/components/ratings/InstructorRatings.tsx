"use client";
// Hoca sayfasındaki oy toplamı: zorluk, anlatım, notlandırma, "tekrar alır" ve ders kırılımı.
// Oylar tarayıcıdan okunur; yeterli oy yoksa yalnızca kısa bir not görünür.

import Link from "next/link";
import { RATINGS_API } from "@/lib/ratings/client";
import { instructorSlug } from "@/lib/ratings/instructors";
import type { InstructorSummary } from "@/lib/ratings/types";
import { useRatings } from "@/lib/ratings/useRatings";
import styles from "./ratings.module.css";

const num = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1 });

export function InstructorRatings({ school, slug, name }: { school: string; slug: string; name: string }) {
  const { summaries, ready } = useRatings(school);
  if (!RATINGS_API) return null;

  const summary: InstructorSummary | undefined = summaries?.instructors?.find((i) => instructorSlug(i.name) === slug);

  return (
    <section className={styles.root} aria-labelledby="hoca-oylar">
      <h2 id="hoca-oylar" className="group-title">
        Öğrenciler ne diyor
      </h2>
      {!summary ? (
        <p className={styles.empty}>
          {!ready
            ? "Oylar yükleniyor."
            : `${name} için henüz yeterli oy yok. Ders sayfasından oy verirken hocayı seçersen burada toplanır.`}
        </p>
      ) : (
        <>
          <div className={styles.card}>
            <dl className={styles.grid}>
              <div className={styles.cell}>
                <dt>Zorluk</dt>
                <dd>
                  <span className={`${styles.big} num`}>{num(summary.difficulty)}</span>
                  <span className={styles.unit}>/5</span>
                </dd>
              </div>
              <div className={styles.cell}>
                <dt>Anlatım</dt>
                <dd>
                  {summary.clarity === null ? (
                    <span className={styles.unit}>yeterli cevap yok</span>
                  ) : (
                    <>
                      <span className={`${styles.big} num`}>{num(summary.clarity)}</span>
                      <span className={styles.unit}>/5</span>
                    </>
                  )}
                </dd>
              </div>
              <div className={styles.cell}>
                <dt>Notlandırma</dt>
                <dd>
                  {summary.fairness === null ? (
                    <span className={styles.unit}>yeterli cevap yok</span>
                  ) : (
                    <>
                      <span className={`${styles.big} num`}>{num(summary.fairness)}</span>
                      <span className={styles.unit}>/5</span>
                    </>
                  )}
                </dd>
              </div>
              <div className={styles.cell}>
                <dt>Tekrar alır</dt>
                <dd>
                  <span className={`${styles.big} num`}>%{summary.again}</span>
                </dd>
              </div>
            </dl>
            <p className={styles.count}>{summary.n} oy, bütün dersleri birlikte.</p>
            {summary.courses.length > 0 && (
              <ul className={styles.instructors}>
                {summary.courses.map((c) => (
                  <li key={c.code}>
                    <Link href={`/ozyegin/${c.code.toLowerCase().replace(/\s+/g, "-")}`} className={styles.who}>
                      {c.code}
                    </Link>{" "}
                    <span className="num">{num(c.difficulty)}/5</span> zorluk, %<span className="num">{c.again}</span> tekrar alır
                    <span className={styles.count}> ({c.n} oy)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

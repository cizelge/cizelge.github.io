"use client";
// Hocalar sayfası: arama, sıralama ve kart listesi. Puanlama hoca sayfasında yapılır.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { personName } from "@/lib/format";
import { RATINGS_API, readMyVotes, type MyVote } from "@/lib/ratings/client";
import { instructorSlug } from "@/lib/ratings/instructors";
import { instructorScore, type InstructorSummary } from "@/lib/ratings/types";
import { useRatings } from "@/lib/ratings/useRatings";
import { Stars } from "./Stars";
import styles from "./list.module.css";

export interface ListCourse {
  code: string;
  title: string;
  slug: string;
}

export interface ListInstructor {
  name: string;
  slug: string;
  courses: ListCourse[];
}

type Sort = "puan" | "oy" | "ad" | "ders";

const SORTS: { id: Sort; label: string }[] = [
  { id: "puan", label: "Puana göre" },
  { id: "oy", label: "Oy sayısına göre" },
  { id: "ad", label: "Ada göre" },
  { id: "ders", label: "Ders sayısına göre" },
];

const PAGE = 24;
const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, "");

export function InstructorList({ school, instructors }: { school: string; instructors: ListInstructor[] }) {
  const { summaries } = useRatings(school);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("puan");
  const [limit, setLimit] = useState(PAGE);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyVotes(readMyVotes());
  }, []);

  const summaryOf = useMemo(() => {
    const map = new Map<string, InstructorSummary>();
    for (const i of summaries?.instructors ?? []) map.set(instructorSlug(i.name), i);
    return map;
  }, [summaries]);

  const q = norm(query);
  const shown = useMemo(() => {
    const list = instructors.filter(
      (i) => !q || norm(personName(i.name)).includes(q) || i.courses.some((c) => norm(c.code).includes(q) || norm(c.title).includes(q)),
    );
    const score = (i: ListInstructor) => instructorScore(summaryOf.get(i.slug)?.criteria ?? {}) ?? -1;
    const votes = (i: ListInstructor) => summaryOf.get(i.slug)?.n ?? 0;
    return [...list].sort((a, b) => {
      if (sort === "ad") return personName(a.name).localeCompare(personName(b.name), "tr");
      if (sort === "ders") return b.courses.length - a.courses.length || personName(a.name).localeCompare(personName(b.name), "tr");
      if (sort === "oy") return votes(b) - votes(a) || personName(a.name).localeCompare(personName(b.name), "tr");
      return score(b) - score(a) || votes(b) - votes(a) || personName(a.name).localeCompare(personName(b.name), "tr");
    });
  }, [instructors, q, sort, summaryOf]);

  const rated = summaries?.instructors?.length ?? 0;

  return (
    <main id="icerik" className={styles.root}>
      <section className={styles.hero}>
        <span className={styles.heroMark} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4l9 4.5-9 4.5-9-4.5z" />
            <path d="M6.5 10.8V15c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.2" />
            <path d="M21 8.5v5" />
          </svg>
        </span>
        <h1 className={styles.heroTitle}>Özyeğin Hocaları</h1>
        <p className={styles.heroLede}>
          <span className="num">{instructors.length}</span> hoca arasından ara, puanları gör, aldığın dersin hocasını
          puanla.
        </p>

        <div className={styles.search}>
          <label className={styles.searchField}>
            <span className="sr-only">Hoca ya da ders ara</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.searchIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              className={styles.input}
              type="search"
              value={query}
              placeholder="Hoca adı ya da ders kodu"
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <label className={styles.sort}>
            <span className="sr-only">Sıralama</span>
            <select className={styles.select} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {RATINGS_API && (
          <p className={styles.heroNote}>
            {rated > 0 ? `${rated} hoca puanlandı.` : "Henüz puan yok. İlk puanlayan sen ol."}
          </p>
        )}
      </section>

      <section className={styles.body} aria-label="Hocalar">
        {shown.length === 0 ? (
          <p className={styles.empty}>Arama sonucu yok.</p>
        ) : (
          <>
            <ul className={styles.grid}>
              {shown.slice(0, limit).map((teacher) => {
                const summary = summaryOf.get(teacher.slug);
                const mine = teacher.courses.filter((c) => myVotes[c.code]).length;
                return (
                  <li key={teacher.slug} className={styles.card}>
                    <Link href={`/ozyegin/hoca/${teacher.slug}`} className={styles.cardLink}>
                      <span className={styles.cardHead}>
                        <span className={styles.cardName}>{personName(teacher.name)}</span>
                        <Stars score={summary ? instructorScore(summary.criteria) : null} size="s" />
                      </span>
                      <span className={styles.cardStats}>
                        <span className={styles.stat}>
                          <span className="num">{teacher.courses.length}</span> ders
                        </span>
                        <span className={styles.stat}>
                          <span className="num">{summary?.n ?? 0}</span> değerlendirme
                        </span>
                        {mine > 0 && <span className={styles.statMine}>oyun var</span>}
                      </span>
                      <span className={styles.cardCourses}>
                        {teacher.courses
                          .slice(0, 3)
                          .map((c) => c.code)
                          .join(", ")}
                        {teacher.courses.length > 3 ? ` +${teacher.courses.length - 3}` : ""}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {shown.length > limit && (
              <button type="button" className={`btn btn-quiet ${styles.more}`} onClick={() => setLimit(limit + PAGE)}>
                Daha fazla göster ({shown.length - limit})
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}

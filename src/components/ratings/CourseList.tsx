"use client";
// Dersler sayfası: arama, sıralama ve kart listesi. Puanlama ders sayfasında yapılır.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RATINGS_API } from "@/lib/ratings/client";
import { readMyCourseVotes, type MyCourseVote } from "@/lib/ratings/course-client";
import { courseKey, type CourseSummary } from "@/lib/ratings/course-types";
import { useCourseRatings } from "@/lib/ratings/useCourseRatings";
import { Stars } from "./Stars";
import styles from "./list.module.css";

export interface ListCourseItem {
  code: string;
  title: string;
  slug: string;
  ects: number | null;
  sections: number;
  /** Dersi veren hocalar (aramada kullanılır). */
  instructors: string[];
}

type Sort = "puan" | "oy" | "kod" | "kolay";

const SORTS: { id: Sort; label: string }[] = [
  { id: "puan", label: "Puana göre" },
  { id: "oy", label: "Oy sayısına göre" },
  { id: "kod", label: "Ders koduna göre" },
  { id: "kolay", label: "Kolaydan zora" },
];

const PAGE = 24;
const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, "");

export function CourseList({ school, courses }: { school: string; courses: ListCourseItem[] }) {
  const { summaries } = useCourseRatings(school);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("puan");
  // "" = bütün AKTS değerleri.
  const [ects, setEcts] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [myVotes, setMyVotes] = useState<Record<string, MyCourseVote>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyVotes(readMyCourseVotes());
  }, []);

  const summaryOf = useMemo(() => {
    const map = new Map<string, CourseSummary>();
    for (const c of summaries?.courses ?? []) map.set(c.course, c);
    return map;
  }, [summaries]);

  // Veride geçen AKTS değerleri, küçükten büyüğe; yanında kaç ders olduğu.
  const ectsOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const c of courses) {
      if (c.ects === null) continue;
      counts.set(c.ects, (counts.get(c.ects) ?? 0) + 1);
    }
    return [...counts].sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count }));
  }, [courses]);

  const q = norm(query);
  const shown = useMemo(() => {
    const wanted = ects === "" ? null : Number(ects);
    const list = courses.filter(
      (c) =>
        (wanted === null || c.ects === wanted) &&
        (!q || norm(c.code).includes(q) || norm(c.title).includes(q) || c.instructors.some((i) => norm(i).includes(q))),
    );
    const of = (c: ListCourseItem) => summaryOf.get(courseKey(c.code));
    const score = (c: ListCourseItem) => of(c)?.score ?? -1;
    const votes = (c: ListCourseItem) => of(c)?.n ?? 0;
    const hard = (c: ListCourseItem) => of(c)?.criteria.difficulty ?? 99;
    return [...list].sort((a, b) => {
      if (sort === "kod") return a.code.localeCompare(b.code, "tr");
      if (sort === "oy") return votes(b) - votes(a) || a.code.localeCompare(b.code, "tr");
      if (sort === "kolay") return hard(a) - hard(b) || a.code.localeCompare(b.code, "tr");
      return score(b) - score(a) || votes(b) - votes(a) || a.code.localeCompare(b.code, "tr");
    });
  }, [courses, q, sort, ects, summaryOf]);

  const rated = summaries?.courses?.length ?? 0;

  return (
    <main id="icerik" className={styles.root}>
      <section className={styles.hero}>
        <span className={styles.heroMark} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
            <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
          </svg>
        </span>
        <h1 className={styles.heroTitle}>Özyeğin Dersleri</h1>
        <p className={styles.heroLede}>
          <span className="num">{courses.length}</span> ders arasından ara, puanları ve yorumları gör, aldığın dersi
          puanla.
        </p>

        <div className={styles.search}>
          <label className={styles.searchField}>
            <span className="sr-only">Ders ya da hoca ara</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.searchIcon} fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" strokeLinecap="round" />
            </svg>
            <input
              className={styles.input}
              type="search"
              value={query}
              placeholder="Ders kodu, ders adı ya da hoca"
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <label className={styles.sort}>
            <span className="sr-only">AKTS</span>
            <select
              className={styles.select}
              value={ects}
              onChange={(e) => {
                setEcts(e.target.value);
                setLimit(PAGE);
              }}
            >
              <option value="">Her AKTS</option>
              {ectsOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value} AKTS ({o.count})
                </option>
              ))}
            </select>
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
          <p className={styles.heroNote}>{rated > 0 ? `${rated} ders puanlandı.` : "Henüz puan yok. İlk puanlayan sen ol."}</p>
        )}
      </section>

      <section className={styles.body} aria-label="Dersler">
        {shown.length === 0 ? (
          <p className={styles.empty}>
            {ects === "" ? "Arama sonucu yok." : `${ects} AKTS'lik böyle bir ders bulunamadı.`}
          </p>
        ) : (
          <>
            {(q !== "" || ects !== "") && (
              <p className={styles.found}>
                <span className="num">{shown.length}</span> ders
                {ects !== "" && `, ${ects} AKTS`}
              </p>
            )}
            <ul className={styles.grid}>
              {shown.slice(0, limit).map((course) => {
                const summary = summaryOf.get(courseKey(course.code));
                const mine = !!myVotes[courseKey(course.code)];
                return (
                  <li key={course.code} className={styles.card}>
                    <Link href={`/ozyegin/${course.slug}`} className={styles.cardLink}>
                      <span className={styles.cardHead}>
                        <span className={`${styles.cardName} num`}>{course.code}</span>
                        <Stars score={summary?.score ?? null} size="s" />
                      </span>
                      <span className={styles.cardCourses}>{course.title}</span>
                      <span className={styles.cardStats}>
                        {course.ects !== null && (
                          <span className={styles.stat}>
                            <span className="num">{course.ects}</span> AKTS
                          </span>
                        )}
                        <span className={styles.stat}>
                          <span className="num">{summary?.n ?? 0}</span> değerlendirme
                        </span>
                        {summary?.criteria.difficulty !== undefined && (
                          <span className={styles.stat}>
                            zorluk <span className="num">{summary.criteria.difficulty}</span>
                          </span>
                        )}
                        {mine && <span className={styles.statMine}>oyun var</span>}
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

"use client";
// Oylar sayfası: ders ders ya da hoca hoca oy verme. Arama, süzme ve satır içinde oylama formu.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { personName } from "@/lib/format";
import { RATINGS_API, readMyVotes, type MyVote } from "@/lib/ratings/client";
import { instructorSlug } from "@/lib/ratings/instructors";
import { instructorScore, oneDecimal, WORKLOAD_SHORT, type CourseSummary, type InstructorSummary } from "@/lib/ratings/types";
import { useRatings } from "@/lib/ratings/useRatings";
import { CourseRating } from "./CourseRating";
import { ScoreBadge } from "./ScoreBits";
import { VoteForm } from "./VoteForm";
import styles from "./browser.module.css";

export interface BrowserCourse {
  code: string;
  title: string;
  slug: string;
  instructors: string[];
}

interface Props {
  school: string;
  courses: BrowserCourse[];
}

type Tab = "dersler" | "hocalar";
const PAGE = 25;

/** "cs201", "veri yapıları" gibi aramalar için: boşluklar atılır, Türkçe küçük harfe çevrilir. */
const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/\s+/g, "");

export function RatingsBrowser({ school, courses }: Props) {
  const { summaries, ready } = useRatings(school);
  const [tab, setTab] = useState<Tab>("dersler");
  const [query, setQuery] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({});
  const [fresh, setFresh] = useState<Record<string, CourseSummary | null>>({});
  const [thanks, setThanks] = useState("");

  // Kendi oyların yalnızca bu tarayıcıda; ilk çizimden sonra okunur.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyVotes(readMyVotes());
  }, []);

  const summaryOf = (code: string) => fresh[code] ?? summaries?.courses[code];

  const instructors = useMemo(() => {
    const map = new Map<string, BrowserCourse[]>();
    for (const course of courses) {
      for (const name of course.instructors) {
        const list = map.get(name);
        if (list) list.push(course);
        else map.set(name, [course]);
      }
    }
    return [...map]
      .map(([name, list]) => ({ name, courses: list }))
      .sort((a, b) => personName(a.name).localeCompare(personName(b.name), "tr"));
  }, [courses]);

  const q = norm(query);
  const visibleCourses = useMemo(() => {
    const list = courses.filter((c) => (q ? norm(c.code).includes(q) || norm(c.title).includes(q) : true));
    return onlyMine ? list.filter((c) => myVotes[c.code]) : list;
  }, [courses, q, onlyMine, myVotes]);

  const visibleInstructors = useMemo(() => {
    const list = instructors.filter((i) => (q ? norm(personName(i.name)).includes(q) || i.courses.some((c) => norm(c.code).includes(q)) : true));
    return onlyMine ? list.filter((i) => i.courses.some((c) => myVotes[c.code])) : list;
  }, [instructors, q, onlyMine, myVotes]);

  function finishVote(code: string) {
    return (vote: MyVote, summary: CourseSummary | null) => {
      setMyVotes((v) => ({ ...v, [code]: vote }));
      setFresh((f) => ({ ...f, [code]: summary }));
      setOpen(null);
      setThanks(`${code} oyun kaydedildi, teşekkürler.`);
    };
  }

  if (!RATINGS_API) {
    return (
      <main id="icerik" className={`page ${styles.root}`}>
        <h1 className="board-title">Oylar</h1>
        <p className={styles.lede}>Oylama şu an kapalı.</p>
      </main>
    );
  }

  const list = tab === "dersler" ? visibleCourses : visibleInstructors;
  const myCount = Object.keys(myVotes).length;

  return (
    <main id="icerik" className={`page ${styles.root}`}>
      <header className={styles.head}>
        <h1 className="board-title">Oylar</h1>
        <p className={styles.lede}>
          Aldığın dersleri ve hocaları oyla: zorluk, haftalık iş yükü ve &ldquo;tekrar alır mıydın&rdquo;. Oylar isimsiz,
          yazılı yorum yok. Bir dersin özeti 3 oydan, hoca puanı 5 oydan sonra görünür.
        </p>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Liste">
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === "dersler"} onClick={() => { setTab("dersler"); setOpen(null); setLimit(PAGE); }}>
          Dersler
        </button>
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === "hocalar"} onClick={() => { setTab("hocalar"); setOpen(null); setLimit(PAGE); }}>
          Hocalar
        </button>
      </div>

      <div className={styles.controls}>
        <label className={styles.search}>
          <span className="sr-only">{tab === "dersler" ? "Ders ara" : "Hoca ara"}</span>
          <input
            className={styles.input}
            type="search"
            value={query}
            placeholder={tab === "dersler" ? "CS 201 ya da ders adı" : "Hoca adı"}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
          />
        </label>
        <button type="button" className={styles.chip} aria-pressed={onlyMine} onClick={() => { setOnlyMine(!onlyMine); setLimit(PAGE); }}>
          Oyladıklarım <span className="num">({myCount})</span>
        </button>
      </div>

      <p className={styles.status} role="status" aria-live="polite">
        {thanks}
      </p>

      {list.length === 0 ? (
        <p className={styles.empty}>
          {onlyMine ? "Henüz oy vermedin." : "Arama sonucu yok."}
        </p>
      ) : (
        <>
          <ul className={styles.list} data-cards={tab === "hocalar"}>
            {tab === "dersler"
              ? visibleCourses.slice(0, limit).map((course) => (
                  <CourseRow
                    key={course.code}
                    school={school}
                    course={course}
                    summary={summaryOf(course.code)}
                    ready={ready}
                    mine={myVotes[course.code]}
                    open={open === course.code}
                    onOpen={() => setOpen(open === course.code ? null : course.code)}
                    onDone={finishVote(course.code)}
                  />
                ))
              : visibleInstructors.slice(0, limit).map((teacher) => (
                  <InstructorCard
                    key={teacher.name}
                    name={teacher.name}
                    courses={teacher.courses}
                    summary={summaries?.instructors?.find((i) => i.name === teacher.name)}
                    votedCount={teacher.courses.filter((c) => myVotes[c.code]).length}
                  />
                ))}
          </ul>
          {list.length > limit && (
            <button type="button" className="btn btn-quiet" onClick={() => setLimit(limit + PAGE)}>
              Daha fazla göster ({list.length - limit})
            </button>
          )}
        </>
      )}
    </main>
  );
}

function MyVoteLine({ mine }: { mine: MyVote }) {
  return (
    <p className={styles.mine}>
      Oyun: zorluk <span className="num">{mine.difficulty}</span>/5, {WORKLOAD_SHORT[mine.workload - 1]},{" "}
      {mine.again ? "tekrar alırdın" : "tekrar almazdın"}
      {mine.instructor ? `, ${personName(mine.instructor)}` : ""}.
    </p>
  );
}

function CourseRow({
  school,
  course,
  summary,
  ready,
  mine,
  open,
  onOpen,
  onDone,
}: {
  school: string;
  course: BrowserCourse;
  summary: CourseSummary | undefined | null;
  ready: boolean;
  mine: MyVote | undefined;
  open: boolean;
  onOpen: () => void;
  onDone: (vote: MyVote, summary: CourseSummary | null) => void;
}) {
  return (
    <li className={styles.row} data-open={open}>
      <div className={styles.rowHead}>
        <div className={styles.rowMain}>
          <Link href={`/ozyegin/${course.slug}`} className={`${styles.code} num`}>
            {course.code}
          </Link>
          <span className={styles.name}>{course.title}</span>
          {summary ? (
            <CourseRating summary={summary} compact />
          ) : (
            <span className={styles.none}>{ready ? "henüz yeterli oy yok" : "oylar yükleniyor"}</span>
          )}
          {mine && !open && <MyVoteLine mine={mine} />}
        </div>
        <button type="button" className={`btn btn-small ${mine ? "btn-quiet" : "btn-pen"} ${styles.action}`} onClick={onOpen} aria-expanded={open}>
          {open ? "Kapat" : mine ? "Değiştir" : "Oyla"}
        </button>
      </div>
      {open && (
        <VoteForm school={school} code={course.code} instructors={course.instructors} initial={mine ?? null} onCancel={onOpen} onDone={onDone} />
      )}
    </li>
  );
}

function InstructorCard({
  name,
  courses,
  summary,
  votedCount,
}: {
  name: string;
  courses: BrowserCourse[];
  summary: InstructorSummary | undefined;
  votedCount: number;
}) {
  return (
    <li className={styles.card}>
      <Link href={`/ozyegin/hoca/${instructorSlug(name)}`} className={styles.cardLink}>
        <span className={styles.cardHead}>
          <span className={styles.cardName}>{personName(name)}</span>
          <ScoreBadge score={summary ? instructorScore(summary.criteria) : null} size="s" />
        </span>
        <span className={styles.cardMeta}>
          {summary ? (
            <>
              <span className="num">{summary.n}</span> değerlendirme, ders zorluğu{" "}
              <span className="num">{oneDecimal(summary.difficulty)}/5</span>, %<span className="num">{summary.again}</span> tekrar alır
            </>
          ) : (
            "henüz yeterli oy yok"
          )}
        </span>
        <span className={styles.cardCourses}>
          {courses.length} ders: {courses.slice(0, 4).map((c) => c.code).join(", ")}
          {courses.length > 4 ? "…" : ""}
        </span>
        <span className={styles.cardAction}>{votedCount > 0 ? `${votedCount} dersini oyladın, aç` : "Puanla"} →</span>
      </Link>
    </li>
  );
}

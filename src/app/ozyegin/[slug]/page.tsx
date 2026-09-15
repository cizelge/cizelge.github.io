import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { WeekGrid } from "@/components/planner/WeekGrid";
import type { PlacedMeeting } from "@/components/planner/placed";
import { tightRange } from "@/components/planner/placed";
import { PrereqChain } from "@/components/course/PrereqChain";
import { findCourse, loadPrograms, loadTerm, loadTerms } from "@/lib/data";
import { DAY_NAMES as DAY, visibleDays } from "@/lib/days";
import { personName } from "@/lib/format";
import type { Program } from "@/lib/types";

export const dynamicParams = false;

// loadPrograms dosyayı her çağrıda okur; derlemede bütün ders sayfaları aynı listeyi paylaşır.
let programsCache: Program[] | null = null;
function allPrograms(): Program[] {
  programsCache ??= loadPrograms("ozyegin")?.programs ?? [];
  return programsCache;
}

export function generateStaticParams() {
  return loadTerm("ozyegin").courses.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/ozyegin/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const term = loadTerm("ozyegin");
  const course = findCourse(term, slug);
  if (!course) return {};
  return {
    title: `${course.code} ${course.title}, Özyeğin ${term.termLabel}`,
    description: `${course.code} ${course.title}: ${course.sections.length} şube, gün ve saatleri, hocaları. Çakışmasız programına ekle.`,
    alternates: { canonical: `/ozyegin/${course.slug}` },
  };
}

export default async function CoursePage(props: PageProps<"/ozyegin/[slug]">) {
  const { slug } = await props.params;
  const term = loadTerm("ozyegin");
  const course = findCourse(term, slug);
  if (!course) notFound();

  const hasCapacity = course.sections.some((s) => s.capacity !== null);
  const planQuery =[course.code, ...course.corequisites].map((c) => c.replace(/\s+/g, "")).join(",");
  const meetings: PlacedMeeting[] = course.sections.flatMap((s, i) =>
    s.meetings.map((m) => ({
      courseCode: course.code,
      sectionId: s.id,
      day: m.day,
      start: m.start,
      end: m.end,
      instructor: s.instructors[0] ?? null,
      room: m.room,
      color: i % 6,
    })),
  );

  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <main id="icerik" className="page">
        <p className="hint" style={{ marginBottom: "1rem" }}>
          <Link href="/ozyegin" className="link">
            Planlayıcı
          </Link>
        </p>
        <h1 className="course-code num">{course.code}</h1>
        <p className="course-title">{course.title}</p>

        <dl className="facts" style={{ marginBottom: "1.5rem" }}>
          {course.ects !== null && (
            <div className="fact">
              <dt>AKTS</dt>
              <dd className="num">{course.ects}</dd>
            </div>
          )}
          <div className="fact">
            <dt>Şube</dt>
            <dd className="num">{course.sections.length}</dd>
          </div>
          {course.corequisites.length > 0 && (
            <div className="fact">
              <dt>Birlikte alınır</dt>
              <dd>
                {course.corequisites.map((c, i) => {
                  const co = term.courses.find((x) => x.code === c);
                  return (
                    <span key={c}>
                      {i > 0 && ", "}
                      {co ? (
                        <Link className="link" href={`/ozyegin/${co.slug}`}>
                          {c}
                        </Link>
                      ) : (
                        c
                      )}
                    </span>
                  );
                })}
              </dd>
            </div>
          )}
        </dl>

        {course.prerequisites && (
          <p className="course-prereq">
            <span className="field-label">Ön koşul</span> {course.prerequisites}
          </p>
        )}

        <PrereqChain
          code={course.code}
          programs={allPrograms()}
          terms={loadTerms("ozyegin")}
          currentTerm={term}
        />

        <p style={{ marginBottom: "2.5rem" }}>
          <Link href={`/ozyegin?d=${planQuery}`} className="btn btn-pen">
            Programıma ekle
          </Link>
        </p>

        <h2 className="group-title" style={{ fontSize: "1.25rem" }}>
          Şubeler
        </h2>
        <div className="table-scroll" style={{ marginBottom: "2.5rem" }}>
          <table className="sections-table">
            <thead>
              <tr>
                <th scope="col">Şube</th>
                <th scope="col">Hoca</th>
                <th scope="col">Gün, saat ve derslik</th>
                {hasCapacity && <th scope="col">Kota</th>}
              </tr>
            </thead>
            <tbody>
              {course.sections.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <span className={`section-tag hl-${i % 6}`}>{s.id}</span>
                  </td>
                  <td>{s.instructors.map(personName).join(", ") || "Belirtilmemiş"}</td>
                  <td className="num">
                    {s.meetings.length === 0
                      ? "Saat yok"
                      : s.meetings.map((m, k) => (
                          <span key={k} className="meeting-line">
                            {DAY[m.day]} {m.start}–{m.end}
                            {m.room && <span className="hint"> {m.room}</span>}
                          </span>
                        ))}
                  </td>
                  {hasCapacity && <td className="num">{s.capacity ?? "–"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="group-title" style={{ fontSize: "1.25rem" }}>
          Bütün şubeler haftada
        </h2>
        <WeekGrid
          meetings={meetings}
          freeDays={[]}
          range={tightRange(meetings)}
          days={visibleDays(meetings)}
        />
      </main>
      <footer className="site-footer">
        <span>Resmi bir Özyeğin hizmeti değildir. Kaydından önce bilgileri SIS üzerinden kontrol et.</span>
      </footer>
    </>
  );
}

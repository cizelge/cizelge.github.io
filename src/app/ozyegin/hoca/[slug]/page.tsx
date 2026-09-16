// Hoca sayfası: bu dönem verdiği dersler (veriden) ve öğrenci oylarının toplamı (tarayıcıda okunur).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { InstructorRatings } from "@/components/ratings/InstructorRatings";
import { loadTerm } from "@/lib/data";
import { DAY_SHORT } from "@/lib/days";
import { personName } from "@/lib/format";
import { instructorSlug } from "@/lib/ratings/instructors";
import type { Course, Section } from "@/lib/types";

export const dynamicParams = false;

const SCHOOL = "ozyegin";

interface Taught {
  course: Course;
  sections: Section[];
}

/** Adı bu adrese denk gelen hocanın bu dönemki dersleri. */
function taughtBy(slug: string): { name: string; courses: Taught[] } | null {
  const term = loadTerm(SCHOOL);
  let name = "";
  const courses: Taught[] = [];
  for (const course of term.courses) {
    const sections = course.sections.filter((s) => s.instructors.some((i) => instructorSlug(i) === slug));
    if (sections.length === 0) continue;
    name ||= sections[0].instructors.find((i) => instructorSlug(i) === slug) ?? "";
    courses.push({ course, sections });
  }
  return name ? { name, courses } : null;
}

export function generateStaticParams() {
  const slugs = new Set<string>();
  for (const course of loadTerm(SCHOOL).courses) {
    for (const section of course.sections) {
      for (const instructor of section.instructors) {
        const slug = instructorSlug(instructor);
        if (slug) slugs.add(slug);
      }
    }
  }
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/ozyegin/hoca/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const found = taughtBy(slug);
  if (!found) return {};
  const name = personName(found.name);
  return {
    title: `${name}, Özyeğin`,
    description: `${name} hangi dersleri veriyor, hangi saatlerde? Öğrencilerin zorluk, anlatım ve notlandırma oyları.`,
    alternates: { canonical: `/${SCHOOL}/hoca/${slug}` },
  };
}

export default async function InstructorPage(props: PageProps<"/ozyegin/hoca/[slug]">) {
  const { slug } = await props.params;
  const found = taughtBy(slug);
  if (!found) notFound();
  const term = loadTerm(SCHOOL);
  const name = personName(found.name);

  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <main id="icerik" className="page">
        <p className="hint" style={{ marginBottom: "1rem" }}>
          <Link href="/ozyegin" className="link">
            Planlayıcı
          </Link>
        </p>
        <h1 className="course-title" style={{ fontSize: "2rem", fontWeight: 800 }}>
          {name}
        </h1>
        <p className="hint">
          {term.termLabel} döneminde {found.courses.length} ders veriyor.
        </p>

        <InstructorRatings school={SCHOOL} slug={slug} name={name} />

        <h2 className="group-title" style={{ fontSize: "1.25rem" }}>
          Bu dönem verdiği dersler
        </h2>
        <ul className="results" aria-label={`${name} dersleri`}>
          {found.courses.map(({ course, sections }) => (
            <li key={course.code} className="result">
              <span className="result-code num">{course.code}</span>
              <span className="result-title">
                <Link href={`/ozyegin/${course.slug}`} className="link">
                  {course.title}
                </Link>
              </span>
              <span className="result-status num">
                {sections
                  .map((s) => `${s.id}: ${s.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}`).join(", ") || "saatsiz"}`)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>

        <p className="hint" style={{ marginTop: "2rem" }}>
          Oylar öğrencilerden gelir ve isimsizdir. Resmi bir değerlendirme değildir.
        </p>
      </main>
    </>
  );
}

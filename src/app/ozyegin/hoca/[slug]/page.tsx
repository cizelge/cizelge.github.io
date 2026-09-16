// Hoca sayfası: bu dönem verdiği dersler (veriden) ve öğrenci oyları (tarayıcıda okunur).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { InstructorRatings } from "@/components/ratings/InstructorRatings";
import styles from "@/components/ratings/hoca.module.css";
import { loadTerm } from "@/lib/data";
import { DAY_SHORT } from "@/lib/days";
import { personName } from "@/lib/format";
import { instructorSlug } from "@/lib/ratings/instructors";

export const dynamicParams = false;

const SCHOOL = "ozyegin";

interface Taught {
  code: string;
  title: string;
  slug: string;
  /** "A: Çar 16:40" gibi kısa saat özeti. */
  when: string;
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
    courses.push({
      code: course.code,
      title: course.title,
      slug: course.slug,
      when: sections
        .map((s) => `${s.id}: ${s.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}`).join(", ") || "saatsiz"}`)
        .join(" · "),
    });
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
    description: `${name} hangi dersleri veriyor? Öğrencilerin ders anlatımı, notlandırma, yardımseverlik ve yoklama puanları.`,
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
      <main id="icerik" className={`page ${styles.root}`}>
        <p className={`hint ${styles.back}`}>
          <Link href="/ozyegin/hocalar" className="link">
            ← Bütün hocalar
          </Link>
        </p>

        <header className={styles.hero}>
          <h1 className={styles.heroName}>{name}</h1>
          <p className={styles.heroMeta}>
            {term.termLabel} döneminde {found.courses.length} ders veriyor
            {found.courses.length > 0 && `: ${found.courses.map((c) => c.code).join(", ")}`}
          </p>
        </header>

        <InstructorRatings school={SCHOOL} slug={slug} name={found.name} courseCount={found.courses.length} />

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Bu dönem verdiği dersler</h2>
          {found.courses.length === 0 ? (
            <p className={styles.empty}>Bu dönem dersi görünmüyor.</p>
          ) : (
            <ul className={styles.courses}>
              {found.courses.map((course) => (
                <li key={course.code} className={styles.course}>
                  <div className={styles.courseHead}>
                    <Link href={`/ozyegin/${course.slug}`} className={`${styles.code} num`}>
                      {course.code}
                    </Link>
                    <span className={styles.courseTitle}>{course.title}</span>
                  </div>
                  <p className={styles.courseMeta}>{course.when}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className={styles.note}>Oylar öğrencilerden gelir ve isimsizdir. Resmi bir değerlendirme değildir.</p>
      </main>
    </>
  );
}

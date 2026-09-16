// Hoca sayfası: bu dönem verdiği dersler (veriden), bölüm bilgisi ve öğrenci puanları (tarayıcıda okunur).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { InstructorRatings } from "@/components/ratings/InstructorRatings";
import styles from "@/components/ratings/hoca.module.css";
import { loadPrograms, loadTerm } from "@/lib/data";
import { DAY_SHORT } from "@/lib/days";
import { normalizeCode } from "@/lib/engine";
import { personName } from "@/lib/format";
import { instructorSlug } from "@/lib/ratings/instructors";
import type { Program } from "@/lib/types";

export const dynamicParams = false;

const SCHOOL = "ozyegin";

interface Taught {
  code: string;
  title: string;
  slug: string;
  /** "A: Çar 16:40" gibi kısa saat özeti. */
  when: string;
  /** Kaç şubesini veriyor. */
  sections: number;
}

// loadPrograms dosyayı her çağrıda okur; derlemede bütün hoca sayfaları aynı listeyi paylaşır.
let programsCache: Program[] | null = null;
function allPrograms(): Program[] {
  programsCache ??= loadPrograms(SCHOOL)?.programs ?? [];
  return programsCache;
}

/** Ders kodu hangi bölümlerin müfredatında geçiyorsa o fakülteler. */
function facultiesFor(codes: readonly string[]): string[] {
  const wanted = new Set(codes.map(normalizeCode));
  const faculties = new Set<string>();
  for (const program of allPrograms()) {
    const inProgram = program.semesters.some((s) =>
      s.items.some((item) => (item.kind === "course" ? wanted.has(normalizeCode(item.code)) : false)),
    );
    if (inProgram && program.faculty) faculties.add(program.faculty);
  }
  return [...faculties].sort((a, b) => a.localeCompare(b, "tr"));
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
      sections: sections.length,
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
    description: `${name} hangi dersleri veriyor? Öğrencilerin ders anlatımı, notlandırma, yardımseverlik ve yoklama puanları, isimsiz yorumlar.`,
    alternates: { canonical: `/${SCHOOL}/hoca/${slug}` },
  };
}

export default async function InstructorPage(props: PageProps<"/ozyegin/hoca/[slug]">) {
  const { slug } = await props.params;
  const found = taughtBy(slug);
  if (!found) notFound();
  const term = loadTerm(SCHOOL);
  const name = personName(found.name);
  const faculties = facultiesFor(found.courses.map((c) => c.code));
  const sectionCount = found.courses.reduce((n, c) => n + c.sections, 0);

  const facts: { label: string; value: string; icon: React.ReactNode }[] = [
    {
      label: "Fakülte",
      value: faculties.length > 0 ? faculties.join(", ") : "Veride yok",
      icon: <path d="M4 20V7l8-3 8 3v13M9 20v-5h6v5M4 20h16" />,
    },
    { label: "Verdiği ders sayısı", value: String(found.courses.length), icon: <path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2zM7 4.5V18h11" /> },
    { label: "Şube sayısı", value: String(sectionCount), icon: <path d="M4 6h16M4 12h16M4 18h10" /> },
    { label: "Dönem", value: term.termLabel, icon: <path d="M4.5 6.5h15v13h-15zM8 4v4M16 4v4M4.5 11h15" /> },
  ];

  const about = (
    <section className={styles.card} aria-labelledby="hoca-hakkinda">
      <h2 id="hoca-hakkinda" className={styles.cardTitle}>
        Hoca hakkında
      </h2>
      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <span className={styles.factIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                {fact.icon}
              </svg>
            </span>
            <dt className={styles.factLabel}>{fact.label}</dt>
            <dd className={styles.factValue}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>
        Fakülte, verdiği derslerin geçtiği bölüm müfredatlarından çıkarıldı. Ünvan bilgisi açık veride yok.
      </p>
    </section>
  );

  const courses = (
    <section className={styles.card} aria-labelledby="hoca-dersler">
      <h2 id="hoca-dersler" className={styles.cardTitle}>
        Bu dönem verdiği dersler
      </h2>
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
  );

  const heading = (
    <>
      <p className={`hint ${styles.back}`}>
        <Link href="/ozyegin/hocalar" className="link">
          ← Bütün hocalar
        </Link>
      </p>
      <h1 className={styles.heroName}>{name}</h1>
      {faculties.length > 0 && <p className={styles.heroFaculty}>{faculties.join(", ")}</p>}
      <p className={styles.heroMeta}>
        {term.termLabel} döneminde {found.courses.length} ders
      </p>
    </>
  );

  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <main id="icerik" className={styles.root}>
        <InstructorRatings school={SCHOOL} slug={slug} name={found.name} heading={heading} about={about} courses={courses} />
      </main>
    </>
  );
}

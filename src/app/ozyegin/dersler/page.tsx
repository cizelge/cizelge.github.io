// Dersler sayfası: bu dönem açılan dersler, puanları ve arama.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { CourseList, type ListCourseItem } from "@/components/ratings/CourseList";
import { loadTerm } from "@/lib/data";
import { personName } from "@/lib/format";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Özyeğin dersleri ve puanları",
  description:
    "Özyeğin derslerini ara: faydası, ilgi çekiciliği, zorluğu ve iş yükü puanları, öğrenci yorumları. Aldığın dersi isimsiz puanla.",
  alternates: { canonical: `/${SCHOOL}/dersler` },
};

export default function CoursesPage() {
  const term = loadTerm(SCHOOL);
  const courses: ListCourseItem[] = term.courses.map((c) => ({
    code: c.code,
    title: c.title,
    slug: c.slug,
    ects: c.ects,
    sections: c.sections.length,
    instructors: [...new Set(c.sections.flatMap((s) => s.instructors))].map(personName),
  }));

  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <CourseList school={SCHOOL} courses={courses} />
      <footer className="site-footer">
        <span>Puanlar öğrencilerden gelir ve isimsizdir. Resmi bir değerlendirme değildir.</span>
      </footer>
    </>
  );
}

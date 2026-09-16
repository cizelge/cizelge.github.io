// Hocalar sayfası: bu dönem ders veren hocalar, puanları ve arama.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { InstructorList, type ListInstructor } from "@/components/ratings/InstructorList";
import { loadTerm } from "@/lib/data";
import { instructorSlug } from "@/lib/ratings/instructors";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Özyeğin hocaları ve puanları",
  description:
    "Özyeğin hocalarını ara: ders anlatımı, notlandırma, yardımseverlik ve yoklama puanları. Aldığın dersin hocasını isimsiz puanla.",
  alternates: { canonical: `/${SCHOOL}/hocalar` },
};

export default function InstructorsPage() {
  const term = loadTerm(SCHOOL);
  const byName = new Map<string, ListInstructor>();
  for (const course of term.courses) {
    for (const name of new Set(course.sections.flatMap((s) => s.instructors))) {
      const slug = instructorSlug(name);
      if (!slug) continue;
      const entry = byName.get(name) ?? { name, slug, courses: [] };
      entry.courses.push({ code: course.code, title: course.title, slug: course.slug });
      byName.set(name, entry);
    }
  }
  const instructors = [...byName.values()];

  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <InstructorList school={SCHOOL} instructors={instructors} />
      <footer className="site-footer">
        <span>Puanlar öğrencilerden gelir ve isimsizdir. Resmi bir değerlendirme değildir.</span>
      </footer>
    </>
  );
}

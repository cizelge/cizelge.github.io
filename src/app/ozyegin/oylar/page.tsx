// Oylar sayfası: ders ve hoca listesi derlemede hazırlanır, oylar tarayıcıda okunur ve gönderilir.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { RatingsBrowser, type BrowserCourse } from "@/components/ratings/RatingsBrowser";
import { loadTerm } from "@/lib/data";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Ders ve hoca oyları",
  description:
    "Aldığın dersleri ve hocaları oyla: zorluk, haftalık iş yükü, tekrar alır mıydın, anlatım ve notlandırma. Oylar isimsizdir.",
  alternates: { canonical: `/${SCHOOL}/oylar` },
};

export default function RatingsPage() {
  const term = loadTerm(SCHOOL);
  const courses: BrowserCourse[] = term.courses.map((c) => ({
    code: c.code,
    title: c.title,
    slug: c.slug,
    instructors: [...new Set(c.sections.flatMap((s) => s.instructors))],
  }));

  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <RatingsBrowser school={SCHOOL} courses={courses} />
      <footer className="site-footer">
        <span>Oylar öğrencilerden gelir ve isimsizdir. Resmi bir değerlendirme değildir.</span>
      </footer>
    </>
  );
}

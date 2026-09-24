import type { MetadataRoute } from "next";

// Statik dışa aktarımda (GitHub Pages) derleme sırasında dosyaya yazılır.
export const dynamic = "force-static";
import { loadErasmus, loadTerm, loadTerms, loadTransfer } from "@/lib/data";
import { instructorSlug } from "@/lib/ratings/instructors";
import { GUIDES } from "@/lib/guides/ozyegin";
import type { TermData } from "@/lib/types";

function instructorSlugs(term: TermData): string[] {
  const slugs = new Set<string>();
  for (const course of term.courses) {
    for (const section of course.sections) {
      for (const instructor of section.instructors) {
        const slug = instructorSlug(instructor);
        if (slug) slugs.add(slug);
      }
    }
  }
  return [...slugs];
}

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

/**
 * lastmod yalnızca gün olarak yazılır ("2026-09-23"). Date nesnesi milisaniyeli ISO üretiyor;
 * bu biçim standarda uygun olsa da arama motorlarının örneklerinde yok, gereksiz risk.
 */
const day = (value: Date | string | number) => new Date(value).toISOString().slice(0, 10);

export default function sitemap(): MetadataRoute.Sitemap {
  const term = loadTerm("ozyegin");
  const updated = new Date(term.fetchedAt);
  const transfer = loadTransfer("ozyegin");
  const erasmus = loadErasmus("ozyegin");
  // Varsayılan dönem /ozyegin'de; diğer yayındaki dönemler /ozyegin/donem/<id>.
  const otherTerms = loadTerms("ozyegin").filter((t) => t.termId !== term.termId);
  return [
    { url: `${siteUrl}/`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin`, lastModified: day(updated) },
    ...otherTerms.map((t) => ({ url: `${siteUrl}/ozyegin/donem/${t.termId}`, lastModified: day(t.fetchedAt) })),
    { url: `${siteUrl}/ozyegin/yol-haritasi`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/on-sart-diyagrami`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/basvurular`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/gecis`, lastModified: day(transfer ? transfer.fetchedAt : updated) },
    { url: `${siteUrl}/ozyegin/hocalar`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/dersler`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/bos-saat`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/rehber`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/geri-bildirim` },
    ...GUIDES.map((g) => ({ url: `${siteUrl}/ozyegin/rehber/${g.slug}`, lastModified: day(updated) })),
    { url: `${siteUrl}/ozyegin/takvim`, lastModified: day(updated) },
    { url: `${siteUrl}/ozyegin/erasmus`, lastModified: day(erasmus ? erasmus.fetchedAt : updated) },
    { url: `${siteUrl}/hakkinda` },
    ...term.courses.map((c) => ({ url: `${siteUrl}/ozyegin/${c.slug}`, lastModified: day(updated) })),
    ...instructorSlugs(term).map((slug) => ({ url: `${siteUrl}/ozyegin/hoca/${slug}`, lastModified: day(updated) })),
  ];
}

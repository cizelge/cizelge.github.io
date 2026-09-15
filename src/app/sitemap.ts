import type { MetadataRoute } from "next";

// Statik dışa aktarımda (GitHub Pages) derleme sırasında dosyaya yazılır.
export const dynamic = "force-static";
import { loadErasmus, loadTerm, loadTerms, loadTransfer } from "@/lib/data";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const term = loadTerm("ozyegin");
  const updated = new Date(term.fetchedAt);
  const transfer = loadTransfer("ozyegin");
  const erasmus = loadErasmus("ozyegin");
  // Varsayılan dönem /ozyegin'de; diğer yayındaki dönemler /ozyegin/donem/<id>.
  const otherTerms = loadTerms("ozyegin").filter((t) => t.termId !== term.termId);
  return [
    { url: `${siteUrl}/`, lastModified: updated },
    { url: `${siteUrl}/ozyegin`, lastModified: updated },
    ...otherTerms.map((t) => ({ url: `${siteUrl}/ozyegin/donem/${t.termId}`, lastModified: new Date(t.fetchedAt) })),
    { url: `${siteUrl}/ozyegin/yol-haritasi`, lastModified: updated },
    { url: `${siteUrl}/ozyegin/on-sart-diyagrami`, lastModified: updated },
    { url: `${siteUrl}/ozyegin/gecis`, lastModified: transfer ? new Date(transfer.fetchedAt) : updated },
    { url: `${siteUrl}/ozyegin/erasmus`, lastModified: erasmus ? new Date(erasmus.fetchedAt) : updated },
    { url: `${siteUrl}/hakkinda` },
    ...term.courses.map((c) => ({ url: `${siteUrl}/ozyegin/${c.slug}`, lastModified: updated })),
  ];
}

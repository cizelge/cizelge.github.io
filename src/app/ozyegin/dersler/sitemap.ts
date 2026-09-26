import type { MetadataRoute } from "next";

// Ders sayfalarının ayrı site haritası: /ozyegin/dersler/sitemap.xml
// Tek büyük dosya yerine bölmek, arama motorunun okuyamadığı durumlarda kaybı sınırlar.
export const dynamic = "force-static";

import { loadTerm } from "@/lib/data";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const day = (value: Date | string | number) => new Date(value).toISOString().slice(0, 10);

export default function sitemap(): MetadataRoute.Sitemap {
  const term = loadTerm("ozyegin");
  const updated = day(term.fetchedAt);
  return term.courses.map((c) => ({ url: `${siteUrl}/ozyegin/${c.slug}`, lastModified: updated }));
}

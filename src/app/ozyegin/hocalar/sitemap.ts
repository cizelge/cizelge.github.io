import type { MetadataRoute } from "next";

// Hoca sayfalarının ayrı site haritası: /ozyegin/hocalar/sitemap.xml
export const dynamic = "force-static";

import { loadTerm } from "@/lib/data";
import { instructorSlug } from "@/lib/ratings/instructors";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
const day = (value: Date | string | number) => new Date(value).toISOString().slice(0, 10);

export default function sitemap(): MetadataRoute.Sitemap {
  const term = loadTerm("ozyegin");
  const updated = day(term.fetchedAt);
  const slugs = new Set<string>();
  for (const course of term.courses) {
    for (const section of course.sections) {
      for (const instructor of section.instructors) {
        const slug = instructorSlug(instructor);
        if (slug) slugs.add(slug);
      }
    }
  }
  return [...slugs].map((slug) => ({ url: `${siteUrl}/ozyegin/hoca/${slug}`, lastModified: updated }));
}

import type { MetadataRoute } from "next";
import { loadTerm } from "@/lib/data";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const term = loadTerm("ozyegin");
  const updated = new Date(term.fetchedAt);
  return [
    { url: `${siteUrl}/`, lastModified: updated },
    { url: `${siteUrl}/ozyegin`, lastModified: updated },
    { url: `${siteUrl}/hakkinda` },
    ...term.courses.map((c) => ({ url: `${siteUrl}/ozyegin/${c.slug}`, lastModified: updated })),
  ];
}

import type { MetadataRoute } from "next";

// Statik dışa aktarımda (GitHub Pages) derleme sırasında dosyaya yazılır.
export const dynamic = "force-static";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

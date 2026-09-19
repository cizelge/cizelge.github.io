import type { MetadataRoute } from "next";

// Statik dışa aktarımda dosya olarak yazılsın.
export const dynamic = "force-static";

// Ana ekrana eklenen uygulama planlayıcıyla açılır.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OzuHelper",
    short_name: "OzuHelper",
    description: "Çakışmasız ders programı: dersleri seç, en uygun haftanı gör.",
    id: "/ozyegin/",
    start_url: "/ozyegin/",
    scope: "/",
    display: "standalone",
    lang: "tr",
    background_color: "#fbfbf8",
    theme_color: "#fbfbf8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Akademik takvim", url: "/ozyegin/takvim/" },
    ],
  };
}

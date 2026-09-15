import type { MetadataRoute } from "next";

// Statik dışa aktarımda dosya olarak yazılsın.
export const dynamic = "force-static";

// Ana ekrana eklenen uygulama "Bugün" ekranıyla açılır.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Çizelge",
    short_name: "Çizelge",
    description: "Bugünkü derslerin, dersliğin ve servisin; çakışmasız ders programı.",
    id: "/ozyegin/bugun/",
    start_url: "/ozyegin/bugun/",
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
      { name: "Program", url: "/ozyegin/" },
      { name: "Akademik takvim", url: "/ozyegin/takvim/" },
    ],
  };
}

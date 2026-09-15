import type { NextConfig } from "next";

// GitHub Pages için STATIC_EXPORT=1 ile derlenir: bütün sayfalar `out/` klasörüne hazır HTML olarak yazılır.
// Yerelde (next start) sunucu modu değişmez.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(staticExport && {
    output: "export",
    // /ozyegin/yol-haritasi -> /ozyegin/yol-haritasi/index.html; GitHub Pages klasör adresini doğrudan sunar.
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;

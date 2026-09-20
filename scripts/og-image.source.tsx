// Paylaşım görselinin (public/og.png) kaynağı. Bu dosya derlemeye girmez.
// Yenilemek için: src/app/opengraph-image.tsx olarak kopyala, `npm run build:pages` çalıştır,
// out/opengraph-image dosyasını public/og.png olarak kaydet, sonra kopyayı sil.
// GitHub Pages uzantısız dosyayı yanlış türle sunduğu için görsel statik PNG olarak tutulur.
import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "OzuHelper: Özyeğin çakışmasız ders programı";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#fbfbf8";
const INK = "#1d2433";
const INK_2 = "#566074";
const HL = "#ffe14d";
const BLOCKS = [
  { left: 120, top: 360, width: 150, height: 120, color: "#ffe14d" },
  { left: 300, top: 400, width: 150, height: 170, color: "#8ee59b" },
  { left: 480, top: 340, width: 150, height: 90, color: "#ff9fcb" },
  { left: 660, top: 430, width: 150, height: 140, color: "#8ed4ff" },
  { left: 840, top: 370, width: 150, height: 110, color: "#ffb86b" },
];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: PAPER,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* Defter çizgileri */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 300 + i * 70,
              height: 1,
              background: "#dce3ec",
            }}
          />
        ))}

        {/* Fosforlu kalem altı çizili logo */}
        <div style={{ display: "flex", alignItems: "flex-end", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 10,
              width: 356,
              height: 26,
              background: HL,
            }}
          />
          <div style={{ fontSize: 76, fontWeight: 800, color: INK, letterSpacing: -2 }}>OzuHelper</div>
        </div>

        <div style={{ fontSize: 46, fontWeight: 700, color: INK, marginTop: 34, maxWidth: 900 }}>
          Özyeğin için çakışmasız ders programı
        </div>
        <div style={{ fontSize: 30, color: INK_2, marginTop: 16, maxWidth: 880 }}>
          Dersleri seç, bütün çakışmasız programları gör. Hoca puanları, ders puanları ve not dağılımı.
        </div>

        {/* Çizelge motifi */}
        {BLOCKS.map((b) => (
          <div
            key={b.left}
            style={{
              position: "absolute",
              left: b.left,
              top: b.top,
              width: b.width,
              height: b.height,
              background: b.color,
              borderRadius: 10,
              opacity: 0.9,
            }}
          />
        ))}

        <div style={{ position: "absolute", left: 80, bottom: 44, fontSize: 26, color: INK_2 }}>
          ozuhelper.github.io
        </div>
      </div>
    ),
    size,
  );
}

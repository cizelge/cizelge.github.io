// Tarayıcıda çalışır: buildScheduleSvg çıktısını tuvale çizip PNG olarak indirir.
import type { ScheduleImage } from "./image";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG görseli yüklenemedi"));
    img.src = src;
  });
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

let embeddedFontCss: Promise<string> | null = null;

/**
 * `<img>` ile çizilen SVG sayfanın web yazı tiplerini kullanamaz. Sayfadaki Onest @font-face
 * kurallarını bulup dosyaları base64 olarak SVG'nin içine gömeriz; bulunamazsa yedek yazı tipiyle çizilir.
 */
function onestFontCss(): Promise<string> {
  embeddedFontCss ??= (async () => {
    const rules: CSSFontFaceRule[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let cssRules: CSSRuleList;
      try {
        cssRules = sheet.cssRules;
      } catch {
        continue; // başka kökenden gelen stil dosyası
      }
      for (const rule of Array.from(cssRules)) {
        if (rule instanceof CSSFontFaceRule && /onest/i.test(rule.style.getPropertyValue("font-family"))) rules.push(rule);
      }
    }
    const faces = await Promise.all(
      rules.map(async (rule) => {
        const src = rule.style.getPropertyValue("src");
        const url = src.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
        if (!url) return "";
        const res = await fetch(new URL(url, rule.parentStyleSheet?.href ?? location.href));
        if (!res.ok) return "";
        const data = toBase64(await res.arrayBuffer());
        const weight = rule.style.getPropertyValue("font-weight") || "100 900";
        const range = rule.style.getPropertyValue("unicode-range");
        return `@font-face{font-family:Onest;font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2");${range ? `unicode-range:${range};` : ""}}`;
      }),
    );
    return faces.join("");
  })().catch(() => "");
  return embeddedFontCss;
}

/** `scale` 2: 1200 px genişliğindeki çizim 2400 px'lik PNG olur (telefonda net görünsün). */
export async function downloadPng(image: ScheduleImage, fileName: string, scale = 2): Promise<void> {
  await document.fonts.ready;
  const fontCss = await onestFontCss();
  const svg = fontCss ? image.svg.replace(/(<svg[^>]*>)/, `$1<defs><style>${fontCss}</style></defs>`) : image.svg;
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  // Gömülü yazı tipinin çözülmesi için bir kare bekle.
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const canvas = document.createElement("canvas");
  canvas.width = image.width * scale;
  canvas.height = image.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tuval açılamadı");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, image.width, image.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG oluşturulamadı");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

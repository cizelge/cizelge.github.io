// Tarayıcıda çalışır: buildScheduleSvg çıktısını tuvale çizip PNG olarak kaydeder.
// Telefonda indirme bağlantısı çoğu zaman galeriye düşmez; bu yüzden önce paylaşım penceresi denenir
// ("Görseli Kaydet" oradan çıkar), olmazsa indirme, o da olmazsa yeni sekmede açma.
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

export type SaveResult = "share" | "download" | "tab";

/** Görseli PNG'ye çevirir. `scale` 2: 1200 px genişliğindeki çizim 2400 px'lik PNG olur. */
export async function renderPng(image: ScheduleImage, scale = 2): Promise<Blob> {
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
  return blob;
}

/**
 * Görseli kaydeder. Telefonda paylaşım penceresi açılır (oradan galeriye kaydedilir),
 * masaüstünde dosya iner. Hangisinin olduğunu döner ki arayüz doğru cümleyi yazsın.
 */
export async function savePng(image: ScheduleImage, fileName: string, title: string, scale = 2): Promise<SaveResult> {
  const blob = await renderPng(image, scale);
  const file = new File([blob], fileName, { type: "image/png" });

  // Dokunmatik cihazda paylaşım penceresi (galeriye kaydetmenin tek yolu), masaüstünde doğrudan indirme.
  const touch = typeof window.matchMedia === "function" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "share";
    } catch (error) {
      // Kullanıcı vazgeçtiyse iş bitmiştir; başka hatada indirmeyi dene.
      if (error instanceof DOMException && error.name === "AbortError") return "share";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  if ("download" in a) {
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return "download";
  }

  // İndirme desteklenmiyorsa (eski iOS Safari) görseli aç: kullanıcı uzun basıp kaydeder.
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "tab";
}

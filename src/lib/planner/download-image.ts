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

/** `scale` 2: 1200 px genişliğindeki çizim 2400 px'lik PNG olur (telefonda net görünsün). */
export async function downloadPng(image: ScheduleImage, fileName: string, scale = 2): Promise<void> {
  // Sayfanın yazı tipleri yüklenmeden çizilirse metin yedek yazı tipiyle kalır.
  await document.fonts.ready;
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(image.svg)}`);

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

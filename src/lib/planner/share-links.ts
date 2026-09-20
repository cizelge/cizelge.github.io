// Tek tuşla paylaşım: çıplak link ne olduğunu anlatmaz, ön yazılı mesaj anlatır.

/** WhatsApp sohbet seçiciyi açan adres. */
export function whatsappLink(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

export const SHARE_TEXT = {
  program: "Güz programımı kurdum, hiç çakışma yok. Sen de dene:",
  freeTime: "Ortak boş saatlerimizi bulalım, kendi programını da ekle:",
  course: "Bu dersin hocasına ve puanlarına bak:",
} as const;

/**
 * Telefonda paylaşım penceresi (WhatsApp, Instagram, Notlar hepsi çıkar),
 * masaüstünde doğrudan WhatsApp. Paylaşım penceresi yoksa false döner.
 */
export async function shareOrWhatsapp(text: string, url: string): Promise<"share" | "whatsapp"> {
  const coarse = typeof window !== "undefined" && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  if (coarse && typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text, url });
      return "share";
    } catch {
      // Kullanıcı vazgeçti ya da paylaşım kapalı: WhatsApp'a düşülür.
    }
  }
  window.open(whatsappLink(text, url), "_blank", "noopener,noreferrer");
  return "whatsapp";
}

// Görünen metin biçimleri. Kaynak veride hoca adları büyük harfle gelir ("BURÇİN GÜNEŞ").

/** "BURÇİN GÜNEŞ" -> "Burçin Güneş" (Türkçe büyük/küçük harf kurallarıyla). */
export function personName(raw: string): string {
  return raw
    .trim()
    .toLocaleLowerCase("tr")
    .split(/(\s+|-)/)
    .map((part) => (/^\s+$|^-$/.test(part) || part === "" ? part : part[0].toLocaleUpperCase("tr") + part.slice(1)))
    .join("");
}

/** 150 -> "2 sa 30 dk", 0 -> "yok". */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "yok";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} sa` : "", m ? `${m} dk` : ""].filter(Boolean).join(" ");
}

/** 150 -> "2 sa 30 dk boşluk", 0 -> "boşluk yok". */
export function formatGap(minutes: number): string {
  return minutes === 0 ? "boşluk yok" : `${formatDuration(minutes)} boşluk`;
}

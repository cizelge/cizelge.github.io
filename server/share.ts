// Kısa paylaşım kodu: uzun linki 6 haneli bir koda çevirir ("K7M4PQ").
// Kod yalnızca bir anahtardır; içeriği (program durumu ya da dolu saatler) sunucuda saklanır.

/** Karıştırılabilecek harfler yok: I, O, 0, 1 kullanılmaz. */
export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
/** Saklanan içeriğin en fazla uzunluğu. */
export const MAX_DATA = 2000;
/** Kod bu kadar gün sonra kendiliğinden silinir (bir dönemden uzun). */
export const SHARE_DAYS = 200;
/** Aynı ağdan günde en fazla kod. */
export const MAX_CODES_PER_IP_PER_DAY = 60;

/** Paylaşılan içeriğin türü. */
export const SHARE_KINDS = ["program", "bos"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export function isCode(value: unknown): value is string {
  return typeof value === "string" && CODE_RE.test(value);
}

/** Büyük/küçük harf ve benzeyen karakterler hoş görülür: "k7m4pq" ve "K7M4PQ" aynı koddur. */
export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    // 0 ve 1 alfabede yok; yazanı kurtarmak için benzerlerine çevrilir.
    .replace(/0/g, "Q")
    .replace(/1/g, "J");
  return isCode(text) ? text : null;
}

/** Rastgele kod üretir; `rand` 0-1 arası sayı döndürmelidir. */
export function makeCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}

export interface ShareInput {
  kind: ShareKind;
  data: string;
}

export type Invalid = { ok: false; error: string };
export type Valid = { ok: true; share: ShareInput };

export function parseShare(body: unknown): Valid | Invalid {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Gövde okunamadı" };
  const b = body as Record<string, unknown>;
  const kind = typeof b.kind === "string" ? b.kind : "";
  const data = typeof b.data === "string" ? b.data.trim() : "";

  if (!(SHARE_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Tür geçersiz" };
  if (data.length === 0) return { ok: false, error: "Paylaşılacak bir şey yok" };
  if (data.length > MAX_DATA) return { ok: false, error: "Paylaşım çok uzun" };
  // Adres çubuğundan gelen içerik: yalnızca güvenli karakterler.
  if (!/^[A-Za-z0-9=&,:;._~%+-]+$/.test(data)) return { ok: false, error: "Paylaşım okunamadı" };

  return { ok: true, share: { kind: kind as ShareKind, data } };
}

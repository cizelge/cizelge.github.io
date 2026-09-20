// Geri bildirim: öneri, hata ve veri düzeltme mesajları. Kimlik istenmez; iletişim bilgisi isteğe bağlıdır.

export const FEEDBACK_KINDS = ["oneri", "hata", "veri", "diger"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const KIND_LABEL: Record<FeedbackKind, string> = {
  oneri: "Öneri",
  hata: "Hata",
  veri: "Ders verisi yanlış",
  diger: "Diğer",
};

export const MIN_MESSAGE = 10;
export const MAX_MESSAGE = 1000;
export const MAX_CONTACT = 120;
/** Aynı ağdan günde en fazla mesaj. */
export const MAX_FEEDBACK_PER_IP_PER_DAY = 10;
/** Kayıtlar bu kadar gün sonra silinir. */
export const FEEDBACK_DAYS = 365;

const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
const DEVICE_RE = /^[a-zA-Z0-9-]{16,64}$/;

export interface FeedbackInput {
  school: string;
  kind: FeedbackKind;
  message: string;
  /** İsteğe bağlı: cevap istiyorsa e-posta ya da kullanıcı adı. */
  contact: string | null;
  /** Hangi sayfadan gönderildi (yalnızca site içi yol). */
  page: string | null;
  device: string;
}

export type Invalid = { ok: false; error: string };
export type Valid = { ok: true; feedback: FeedbackInput };

export function parseFeedback(body: unknown): Valid | Invalid {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Gövde okunamadı" };
  const b = body as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const device = typeof b.device === "string" ? b.device : "";
  const kind = typeof b.kind === "string" ? b.kind : "";
  const message = typeof b.message === "string" ? b.message.replace(/[^\S\r\n]+/g, " ").replace(/(\r?\n){3,}/g, "\n\n").trim() : "";
  const rawContact = typeof b.contact === "string" ? b.contact.trim() : "";
  const rawPage = typeof b.page === "string" ? b.page.trim() : "";

  if (!SCHOOL_RE.test(school)) return { ok: false, error: "Okul geçersiz" };
  if (!(FEEDBACK_KINDS as readonly string[]).includes(kind)) return { ok: false, error: "Tür geçersiz" };
  if (message.length < MIN_MESSAGE) return { ok: false, error: `Mesaj en az ${MIN_MESSAGE} karakter olmalı` };
  if (message.length > MAX_MESSAGE) return { ok: false, error: `Mesaj en fazla ${MAX_MESSAGE} karakter olabilir` };
  if (rawContact.length > MAX_CONTACT) return { ok: false, error: "İletişim bilgisi çok uzun" };
  if (!DEVICE_RE.test(device)) return { ok: false, error: "Cihaz kimliği geçersiz" };
  // Sayfa bilgisi yalnızca site içi yol olabilir; tam adres ya da başka site kabul edilmez.
  const page = /^\/[A-Za-z0-9/_-]{0,120}$/.test(rawPage) ? rawPage : null;

  return {
    ok: true,
    feedback: { school, kind: kind as FeedbackKind, message, contact: rawContact === "" ? null : rawContact, page, device },
  };
}

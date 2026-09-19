// Ders notu paylaşımı: dosya barındırmıyoruz, yalnızca bağlantı tutuyoruz.
// Bağlantı bilinen dosya/paylaşım servislerinden olmak zorunda: oltalama ve zararlı dosya riskini böyle kısıyoruz.

/** Paylaşılan şeyin türü. */
export const NOTE_KINDS = ["ozet", "cikmis", "slayt", "video", "diger"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const KIND_LABEL: Record<NoteKind, string> = {
  ozet: "Özet",
  cikmis: "Çıkmış soru",
  slayt: "Slayt",
  video: "Video",
  diger: "Diğer",
};

/** Bir cihazın bir derse ekleyebileceği en fazla bağlantı. */
export const MAX_NOTES_PER_DEVICE_COURSE = 3;
/** Aynı ağdan günde en fazla bağlantı. */
export const MAX_NOTES_PER_IP_PER_DAY = 20;
/** Bu kadar bildirim alan bağlantı gizlenir. */
export const HIDE_AFTER_REPORTS = 3;
export const MAX_TITLE = 80;
export const MIN_TITLE = 3;

/** Bağlantının olabileceği alan adları; alt alan adları da kabul edilir. */
export const ALLOWED_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "onedrive.live.com",
  "1drv.ms",
  "sharepoint.com",
  "dropbox.com",
  "notion.so",
  "notion.site",
  "github.com",
  "gist.github.com",
  "youtube.com",
  "youtu.be",
  "mega.nz",
  "icloud.com",
  "ozyegin.edu.tr",
] as const;

const SCHOOL_RE = /^[a-z][a-z0-9-]{1,30}$/;
const DEVICE_RE = /^[a-zA-Z0-9-]{16,64}$/;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TERM_RE = /^\d{4}-\d{4}-(guz|bahar|yaz)$/;

/** Hakaret süzgeci: başlıkta bu köklerden biri varsa kabul edilmez. */
const BANNED = [
  "orospu", "piç", "yavşak", "amcık", "amına", "sikeyim", "sikti", "sikik", "siktir",
  "gerizekalı", "şerefsiz", "puşt", "ibne", "kaltak", "pezevenk", "yarrak",
];

export function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return ALLOWED_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Bağlantıyı doğrular; sorgu ve çapa korunur, başka bir şey eklenmez. */
export function cleanUrl(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: false, error: "Bağlantı boş" };
  const text = raw.trim();
  if (text.length > 500) return { ok: false, error: "Bağlantı çok uzun" };
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, error: "Bağlantı okunamadı, https:// ile başlamalı" };
  }
  if (parsed.protocol !== "https:") return { ok: false, error: "Yalnızca https bağlantısı kabul ediliyor" };
  if (!isAllowedHost(parsed.hostname)) {
    return { ok: false, error: "Bu site kabul edilmiyor. Drive, OneDrive, Dropbox, Notion, GitHub veya YouTube bağlantısı paylaş" };
  }
  return { ok: true, url: parsed.toString() };
}

export function cleanTitle(raw: unknown): { ok: true; title: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Başlık metin olmalı" };
  const title = raw.replace(/\s+/g, " ").trim();
  if (title.length < MIN_TITLE) return { ok: false, error: `Başlık en az ${MIN_TITLE} karakter olmalı` };
  if (title.length > MAX_TITLE) return { ok: false, error: `Başlık en fazla ${MAX_TITLE} karakter olabilir` };
  const lower = title.toLocaleLowerCase("tr");
  if (BANNED.some((word) => lower.includes(word))) return { ok: false, error: "Başlıkta hakaret var" };
  return { ok: true, title };
}

/** Ders kodunun kayıt anahtarı: "cs 201" -> "CS201". */
export function courseKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const key = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2,8}[0-9]{2,4}[A-Z]?$/.test(key) ? key : null;
}

export interface NoteInput {
  school: string;
  course: string;
  url: string;
  title: string;
  kind: NoteKind;
  /** Hangi dönemin notu; bilinmiyorsa null. */
  term: string | null;
  /** Hangi hocanın dersinden; bilinmiyorsa null. */
  instructor: string | null;
  device: string;
}

export type Invalid = { ok: false; error: string };
export type Valid = { ok: true; note: NoteInput };

export function parseNote(body: unknown): Valid | Invalid {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Gövde okunamadı" };
  const b = body as Record<string, unknown>;
  const school = typeof b.school === "string" ? b.school : "";
  const course = courseKey(b.course);
  const device = typeof b.device === "string" ? b.device : "";
  const rawTerm = typeof b.term === "string" ? b.term.trim() : "";
  const rawSlug = typeof b.instructor === "string" ? b.instructor.trim().toLowerCase() : "";

  if (!SCHOOL_RE.test(school)) return { ok: false, error: "Okul geçersiz" };
  if (!course) return { ok: false, error: "Ders kodu geçersiz" };
  if (!DEVICE_RE.test(device)) return { ok: false, error: "Cihaz kimliği geçersiz" };
  if (typeof b.kind !== "string" || !(NOTE_KINDS as readonly string[]).includes(b.kind)) {
    return { ok: false, error: "Tür geçersiz" };
  }
  if (rawTerm !== "" && !TERM_RE.test(rawTerm)) return { ok: false, error: "Dönem geçersiz" };
  if (rawSlug !== "" && (!SLUG_RE.test(rawSlug) || rawSlug.length > 80)) return { ok: false, error: "Hoca adresi geçersiz" };

  const url = cleanUrl(b.url);
  if (!url.ok) return { ok: false, error: url.error };
  const title = cleanTitle(b.title);
  if (!title.ok) return { ok: false, error: title.error };

  return {
    ok: true,
    note: {
      school,
      course,
      url: url.url,
      title: title.title,
      kind: b.kind as NoteKind,
      term: rawTerm === "" ? null : rawTerm,
      instructor: rawSlug === "" ? null : rawSlug,
      device,
    },
  };
}

/** Sayfada gösterilen bağlantı. Cihaz kimliği dışarı verilmez. */
export interface NoteRow {
  id: string;
  url: string;
  title: string;
  kind: NoteKind;
  term: string | null;
  instructor: string | null;
  at: string;
  /** Bağlantıyı bu cihaz mı ekledi (kaldırma düğmesi için). */
  mine: boolean;
}

/** Yeniden eskiye sıralar; gizlenenleri atar. */
export function sortNotes(rows: readonly NoteRow[]): NoteRow[] {
  return [...rows].sort((a, b) => b.at.localeCompare(a.at));
}

// Akademik takvim verisi: data/<okul>/academic-calendar.json dosyasının şekli.

export type EventCategory = "ders" | "sinav" | "kayit" | "tatil" | "basvuru" | "not" | "diger";
export type EventTerm = "guz" | "bahar" | "yaz";

export interface CalendarEvent {
  /** Kalıcı kimlik; .ics UID'si bundan üretilir. */
  id: string;
  title: string;
  /** "YYYY-AA-GG". */
  start: string;
  /** Son gün (dahil); tek günlükse null. */
  end: string | null;
  /** Takvimde saat yazıyorsa "SS:DD". */
  time?: string;
  category: EventCategory;
  term: EventTerm | null;
  /** Şüpheli ya da açıklama isteyen durumlar. */
  note?: string;
  /** `sources` dizisindeki sıra. */
  source: number;
}

export interface AcademicCalendarData {
  schoolId: string;
  academicYear: string;
  fetchedAt: string;
  sources: { label: string; url: string }[];
  events: CalendarEvent[];
}

export const CATEGORIES: EventCategory[] = ["ders", "sinav", "kayit", "tatil", "basvuru", "not", "diger"];

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  ders: "Ders",
  sinav: "Sınav",
  kayit: "Kayıt",
  tatil: "Tatil",
  basvuru: "Başvuru",
  not: "Not",
  diger: "Diğer",
};

// Devamsızlık takibi: kaç ders saati kaçırdın, ne kadar hakkın kaldı.
// Özyeğin yönetmeliğinde devam kuralı merkezî değil, her dersin hocası belirler (Madde 27).
// Bu yüzden sınır dersten derse değiştirilebilir; varsayılanı %30'dur (yani %70 devam).
import type { Meeting } from "../types";

/** Bir dönemde işlenen hafta sayısı; ara tatiller düşülmüş kaba sayı. */
export const TERM_WEEKS = 14;
/** Varsayılan devamsızlık sınırı (yüzde). */
export const DEFAULT_LIMIT = 30;
/** Seçilebilen sınırlar. */
export const LIMITS = [30, 25, 20, 10] as const;

/** Bir ders saati kaç dakika (50 dakikalık ders + mola düzeni). */
const HOUR_MIN = 50;

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Şubenin haftalık ders saati: her oturumun süresi 50 dakikaya bölünüp yuvarlanır.
 * 16:40-18:30 (110 dk) 2 saat, 11:40-14:30 (170 dk) 3 saat sayılır.
 */
export function weeklyHours(meetings: readonly Meeting[]): number {
  let hours = 0;
  for (const m of meetings) {
    const minutes = toMinutes(m.end) - toMinutes(m.start);
    if (minutes > 0) hours += Math.max(1, Math.round(minutes / HOUR_MIN));
  }
  return hours;
}

export type AttendanceState = "ok" | "warn" | "over";

export interface Attendance {
  /** Haftalık ders saati. */
  perWeek: number;
  /** Dönem boyunca toplam ders saati. */
  total: number;
  /** Kaçırılabilecek en fazla ders saati. */
  allowed: number;
  /** Kaçırılan ders saati. */
  missed: number;
  /** Kalan hak (negatifse sınır aşılmış). */
  left: number;
  /** Kalan hak kaç haftalık derse denk geliyor (aşağı yuvarlanır). */
  weeksLeft: number;
  state: AttendanceState;
}

export function attendance(perWeek: number, missed: number, limitPercent = DEFAULT_LIMIT, weeks = TERM_WEEKS): Attendance {
  const total = perWeek * weeks;
  const allowed = Math.floor((total * limitPercent) / 100);
  const left = allowed - missed;
  return {
    perWeek,
    total,
    allowed,
    missed,
    left,
    weeksLeft: perWeek > 0 ? Math.floor(Math.max(0, left) / perWeek) : 0,
    // Son bir haftalık hak kaldıysa uyar; hak bittiyse sınır aşılmış sayılır.
    state: left < 0 ? "over" : perWeek > 0 && left < perWeek ? "warn" : "ok",
  };
}

/** Öğrenciye gösterilecek cümle. */
export function attendanceText(a: Attendance): string {
  if (a.total === 0) return "Bu dersin saati belli değil, devamsızlık hesaplanamıyor.";
  if (a.state === "over") {
    const over = Math.abs(a.left);
    return `Sınırı ${over} ders saati aştın. Devamdan kalmış olabilirsin, hocana sor.`;
  }
  if (a.left === 0) return "Hakkın bitti. Bir ders daha kaçırırsan devamdan kalırsın.";
  const hours = `${a.left} ders saati`;
  if (a.weeksLeft === 0) return `${hours} hakkın kaldı, bir haftalık ders bile etmiyor.`;
  if (a.weeksLeft === 1) return `${hours} hakkın kaldı, yani 1 hafta daha kaçırabilirsin.`;
  return `${hours} hakkın kaldı, yani ${a.weeksLeft} hafta daha kaçırabilirsin.`;
}

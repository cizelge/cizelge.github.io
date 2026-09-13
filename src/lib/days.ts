// Gün adları ve haftalık tabloda gösterilecek günler. 1 = Pazartesi … 7 = Pazar.
import type { Meeting } from "./types";

type Day = Meeting["day"];

export const DAY_NAMES = ["", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
export const DAY_SHORT = ["", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"] as const;

const WEEKDAYS: Day[] = [1, 2, 3, 4, 5];

/** Pazartesi–Cuma her zaman; Cumartesi ve Pazar yalnızca o gün bir ders varsa. */
export function visibleDays(meetings: readonly { day: Day }[]): Day[] {
  const days = [...WEEKDAYS];
  for (const weekend of [6, 7] as const) {
    if (meetings.some((m) => m.day === weekend)) days.push(weekend);
  }
  return days;
}

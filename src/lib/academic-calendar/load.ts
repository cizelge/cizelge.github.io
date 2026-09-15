// Sunucu tarafı: data/<okul>/academic-calendar.json dosyasını derleme sırasında okur.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { AcademicCalendarData } from "./types";

export const ACADEMIC_CALENDAR_FILE = "academic-calendar.json";

// Takvim örnek veriyle değişmez; SAMPLE_DATA=1 olsa da gerçek veri klasörü okunur.
const root = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");

/** data/<okul>/academic-calendar.json; yoksa null (sayfa kısa bir not gösterir). */
export function loadAcademicCalendar(schoolId: string): AcademicCalendarData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, ACADEMIC_CALENDAR_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as AcademicCalendarData;
}

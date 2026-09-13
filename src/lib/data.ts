// Sunucu tarafı veri okuma. Derleme sırasında data/<okul>/*.json dosyalarından en yenisini alır.
// SAMPLE_DATA=1 ile data-sample/ klasöründeki örnek veri kullanılır (yalnızca geliştirme).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Course, ProgramsData, TermData } from "./types";

export const USING_SAMPLE_DATA = process.env.SAMPLE_DATA === "1";

// Bütün sayfalar derlemede üretildiği için çalışma anı paketine veri dosyalarının izlenmesi gerekmez.
const root = path.join(/*turbopackIgnore: true*/ process.cwd(), USING_SAMPLE_DATA ? "data-sample" : "data");

/** Bölüm müfredatları dönem dosyalarının yanında durur ama dönem dosyası değildir. */
const PROGRAMS_FILE = "programs.json";

export function loadTerm(schoolId: string): TermData {
  const dir = path.join(/*turbopackIgnore: true*/ root, schoolId);
  const files = fs.readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.endsWith(".json") && f !== PROGRAMS_FILE);
  if (files.length === 0) throw new Error(`${dir} içinde veri yok`);
  const terms = files.map(
    (f) => JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ path.join(dir, f), "utf8")) as TermData,
  );
  return terms.sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
}

/** data/<okul>/programs.json; yoksa null (müfredat seçimi gizlenir). */
export function loadPrograms(schoolId: string): ProgramsData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, PROGRAMS_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as ProgramsData;
}

export function findCourse(term: TermData, slug: string): Course | undefined {
  return term.courses.find((c) => c.slug === slug);
}

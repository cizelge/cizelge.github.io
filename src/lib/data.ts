// Sunucu tarafı veri okuma. Derleme sırasında data/<okul>/*.json dönem dosyalarını okur.
// SAMPLE_DATA=1 ile data-sample/ klasöründeki örnek veri kullanılır (yalnızca geliştirme).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { buildTermOptions, defaultTerm, parseTermLabel, sortTermData, termHasTimes, type TermOption } from "./terms";
import type { Course, ProgramsData, TermData } from "./types";
import type { MinorsData } from "./roadmap/types";

export const USING_SAMPLE_DATA = process.env.SAMPLE_DATA === "1";

// Bütün sayfalar derlemede üretildiği için çalışma anı paketine veri dosyalarının izlenmesi gerekmez.
const root = path.join(/*turbopackIgnore: true*/ process.cwd(), USING_SAMPLE_DATA ? "data-sample" : "data");

/** Bölüm müfredatları dönem dosyalarının yanında durur ama dönem dosyası değildir. */
const PROGRAMS_FILE = "programs.json";
/** Yandal ders listeleri de dönem dosyası değildir. */
const MINORS_FILE = "minors.json";

// Derlemede her ders sayfası dönemi yeniden ister; dosyalar süreç başına bir kez okunur.
const cache = new Map<string, TermData[]>();

/** Okulun bütün dönemleri, eskiden yeniye (yıl, sonra Güz < Bahar < Yaz). Adlar düzgün yazımla. */
export function loadTerms(schoolId: string): TermData[] {
  const cached = cache.get(schoolId);
  if (cached) return cached;
  const dir = path.join(/*turbopackIgnore: true*/ root, schoolId);
  const files = fs.readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.endsWith(".json") && f !== PROGRAMS_FILE && f !== MINORS_FILE);
  if (files.length === 0) throw new Error(`${dir} içinde veri yok`);
  const terms = sortTermData(
    files.map((f) => JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ path.join(dir, f), "utf8")) as TermData),
  );
  cache.set(schoolId, terms);
  return terms;
}

const withTimes = (t: TermData) => ({ ...parseTermLabel(t.termLabel), hasTimes: termHasTimes(t) });

/** Verilen dönem; verilmezse varsayılan dönem (saatleri yayında olan en yeni dönem). */
export function loadTerm(schoolId: string, termId?: string): TermData {
  const terms = loadTerms(schoolId);
  if (termId === undefined) {
    const id = defaultTerm(terms.map(withTimes)).id;
    return terms.find((t) => t.termId === id)!;
  }
  const term = terms.find((t) => t.termId === termId);
  if (!term) throw new Error(`${schoolId} için ${termId} dönemi yok`);
  return term;
}

/** Varsayılan dönemin akademik yılı için Güz, Bahar, Yaz; ardından başka yıllardan yayındaki dönemler. */
export function termOptions(schoolId: string): TermOption[] {
  return buildTermOptions(loadTerms(schoolId).map(withTimes));
}

/** data/<okul>/programs.json; yoksa null (müfredat seçimi gizlenir). */
export function loadPrograms(schoolId: string): ProgramsData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, PROGRAMS_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as ProgramsData;
}

/** data/<okul>/minors.json; yoksa null (yandal seçimi gizlenir). */
export function loadMinors(schoolId: string): MinorsData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, MINORS_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as MinorsData;
}

export function findCourse(term: TermData, slug: string): Course | undefined {
  return term.courses.find((c) => c.slug === slug);
}

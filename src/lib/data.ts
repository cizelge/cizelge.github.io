// Sunucu tarafı veri okuma. Derleme sırasında data/<okul>/*.json dönem dosyalarını okur.
// SAMPLE_DATA=1 ile data-sample/ klasöründeki örnek veri kullanılır (yalnızca geliştirme).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { buildTermOptions, defaultTerm, parseTermLabel, sortTermData, termHasTimes, type TermOption } from "./terms";
import type { Course, ProgramsData, TermData } from "./types";
import type { MinorsData } from "./roadmap/types";
import type { TransferHistoryData } from "./transfer/history";
import type { TransferData } from "./transfer/types";
import type { ErasmusData } from "./erasmus/types";
import type { ShuttleData } from "./shuttle/types";
import type { PartnersData } from "./erasmus/universities";

export const USING_SAMPLE_DATA = process.env.SAMPLE_DATA === "1";

// Bütün sayfalar derlemede üretildiği için çalışma anı paketine veri dosyalarının izlenmesi gerekmez.
const root = path.join(/*turbopackIgnore: true*/ process.cwd(), USING_SAMPLE_DATA ? "data-sample" : "data");

/** Bölüm müfredatları dönem dosyalarının yanında durur ama dönem dosyası değildir. */
const PROGRAMS_FILE = "programs.json";
/** Yandal ders listeleri de dönem dosyası değildir. */
const MINORS_FILE = "minors.json";
/** Yatay geçiş ve çift anadal verisi de dönem dosyası değildir. */
const TRANSFER_FILE = "transfer.json";
/** Erasmus başvuru ve hibe verisi de dönem dosyası değildir. */
const ERASMUS_FILE = "erasmus.json";
/** Değişim anlaşması olan okullar da dönem dosyası değildir. */
const PARTNERS_FILE = "partners.json";
/** Geçmiş dönemlerin yatay geçiş, ÇAP ve yandal başvuru sonuç sayıları da dönem dosyası değildir. */
const TRANSFER_HISTORY_FILE = "transfer-history.json";
/** Kampüs servis saatleri ve akademik takvim de dönem dosyası değildir. */
const SHUTTLE_FILE = "shuttle.json";
const ACADEMIC_CALENDAR_FILE = "academic-calendar.json";
const NOT_TERM_FILES = new Set([PROGRAMS_FILE, MINORS_FILE, TRANSFER_FILE, ERASMUS_FILE, PARTNERS_FILE, TRANSFER_HISTORY_FILE, SHUTTLE_FILE, ACADEMIC_CALENDAR_FILE]);

// Derlemede her ders sayfası dönemi yeniden ister; dosyalar süreç başına bir kez okunur.
const cache = new Map<string, TermData[]>();

/** Okulun bütün dönemleri, eskiden yeniye (yıl, sonra Güz < Bahar < Yaz). Adlar düzgün yazımla. */
export function loadTerms(schoolId: string): TermData[] {
  const cached = cache.get(schoolId);
  if (cached) return cached;
  const dir = path.join(/*turbopackIgnore: true*/ root, schoolId);
  const files = fs.readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.endsWith(".json") && !NOT_TERM_FILES.has(f));
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

/** data/<okul>/transfer.json; yoksa null (geçiş sayfası kısa bir not gösterir). */
export function loadTransfer(schoolId: string): TransferData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, TRANSFER_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as TransferData;
}

/** data/<okul>/transfer-history.json; yoksa null (geçiş sayfası geçmiş oranları göstermez). */
export function loadTransferHistory(schoolId: string): TransferHistoryData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, TRANSFER_HISTORY_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as TransferHistoryData;
}

/** data/<okul>/shuttle.json; yoksa null (planlayıcı servis panelini göstermez). */
export function loadShuttle(schoolId: string): ShuttleData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, SHUTTLE_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as ShuttleData;
}

/** data/<okul>/erasmus.json; yoksa null (Erasmus sayfası kısa bir not gösterir). */
export function loadErasmus(schoolId: string): ErasmusData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, ERASMUS_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as ErasmusData;
}

/** data/<okul>/partners.json; yoksa null (üniversite seçiminde yalnızca serbest yazım kalır). */
export function loadPartners(schoolId: string): PartnersData | null {
  const file = path.join(/*turbopackIgnore: true*/ root, schoolId, PARTNERS_FILE);
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return null;
  return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as PartnersData;
}

export function findCourse(term: TermData, slug: string): Course | undefined {
  return term.courses.find((c) => c.slug === slug);
}

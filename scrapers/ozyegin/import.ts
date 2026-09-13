// export-snippet.js çıktısını (bir veya birden çok dosya) ortak TermData biçimine çevirir.
//
// Biçim v1 (formatVersion yok): her satırda coreqText + instructorText. Eski betik koşul hücresini
// yanlış okuduğundan instructorText çoğu zaman "Ön koşul: ..." içerir ve hoca kaybolmuştur.
// Biçim v2 (formatVersion: 2): her satırda infoCells, bilgi tablosunun bütün hücreleri sırasıyla.
import type { Course, Meeting, Section, TermData } from "../../src/lib/types";

export interface RawMeeting {
  dayText: string;
  timeText: string;
}

interface RawRowBase {
  subject: string;
  number: string;
  section: string;
  title: string;
  creditsText: string;
  meetings: RawMeeting[];
}

export interface RawRowV1 extends RawRowBase {
  coreqText: string;
  instructorText: string;
}

export interface RawRowV2 extends RawRowBase {
  /** Bilgi tablosundaki bütün td metinleri (boşlukları sadeleştirilmiş), sırasıyla. */
  infoCells: string[];
}

export type RawRow = RawRowV1 | RawRowV2;

export interface RawExport {
  /** Yoksa 1. */
  formatVersion?: 1 | 2;
  source: string;
  termLabel: string | null;
  exportedAt: string;
  /** v2: sayfanın bildirdiği kayıt sayısı ve toplanan satır sayısı. */
  expected?: number | null;
  collected?: number;
  /** Birim birim toplanan dışa aktarmalarda birim başına sayılar; içeri almada kullanılmaz. */
  units?: Record<string, unknown>;
  rows: RawRow[];
}

const DAYS: Record<string, Meeting["day"]> = {
  Pazartesi: 1,
  Salı: 2,
  Çarşamba: 3,
  Perşembe: 4,
  Cuma: 5,
  Cumartesi: 6,
  Pazar: 7,
};

const TIME_RE = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
export const COURSE_CODE_RE = /^([A-ZÇĞİÖŞÜ]{2,6})\s*(\d{3,4}[A-ZÇĞİÖŞÜ0-9_]*)$/;
const COREQ_MARK = "Yan koşul:";
const PREREQ_MARK = "Ön koşul:";

const TURKISH_ASCII: Record<string, string> = {
  İ: "i", I: "i", ı: "i", Ş: "s", ş: "s", Ç: "c", ç: "c", Ğ: "g", ğ: "g", Ö: "o", ö: "o", Ü: "u", ü: "u",
};

/** Türkçe harfleri ASCII'ye indirip küçük harfe çevirir. `toLowerCase("İ")` "i̇" verdiği için önce harf harf eşlenir. */
function foldAscii(text: string): string {
  return text.replace(/[İIıŞşÇçĞğÖöÜü]/g, (ch) => TURKISH_ASCII[ch]).toLowerCase();
}

/** "MİM 105" -> "mim-105", "SAS 405_U" -> "sas-405-u". Yalnızca a-z, 0-9 ve "-". */
export function courseSlug(code: string): string {
  return foldAscii(code)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function termIdFromLabel(label: string): string {
  return courseSlug(label);
}

const pad = (h: string) => h.padStart(2, "0");
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function parseMeeting(m: RawMeeting, where: string): Meeting {
  const day = DAYS[m.dayText];
  if (!day) throw new Error(`${where}: desteklenmeyen gün "${m.dayText}"`);
  const t = m.timeText.match(TIME_RE);
  if (!t) throw new Error(`${where}: saat okunamadı "${m.timeText}"`);
  return { day, start: `${pad(t[1])}:${t[2]}`, end: `${pad(t[3])}:${t[4]}`, room: null };
}

/** Kaynak bazı saatleri her hafta için ayrı satır olarak listeliyor; aynı gün+saat bir kez tutulur. */
function dedupeMeetings(meetings: Meeting[]): Meeting[] {
  const seen = new Set<string>();
  return meetings.filter((m) => {
    const key = `${m.day} ${m.start} ${m.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseCredits(text: string): number | null {
  const n = text.match(/(\d+(?:[.,]\d+)?)/);
  return n ? Number(n[1].replace(",", ".")) : null;
}

/** "EE 201, EE 341L" -> ["EE 201", "EE 341L"]; kod olmayan parçalar atılır, "MATH107R" -> "MATH 107R". */
export function parseCoreqList(text: string): string[] {
  const out: string[] = [];
  for (const token of text.split(/\s*(?:,|;|\sve\s|\sand\s)\s*/)) {
    const m = squash(token).match(COURSE_CODE_RE);
    if (!m) continue;
    const code = `${m[1]} ${m[2]}`;
    if (!out.includes(code)) out.push(code);
  }
  return out;
}

export interface ParsedInfo {
  corequisites: string[];
  prerequisites: string;
  instructors: string[];
}

/**
 * Bilgi tablosu hücreleri: "Yan koşul:" ve/veya "Ön koşul:" içeren hücre koşul hücresidir
 * (ikisi aynı hücrede, herhangi bir sırada olabilir); boş olmayan diğer hücreler hocadır.
 */
export function parseInfoCells(cells: readonly string[]): ParsedInfo {
  const corequisites: string[] = [];
  const prereqParts: string[] = [];
  const instructors: string[] = [];

  for (const rawCell of cells) {
    const cell = squash(rawCell ?? "");
    if (!cell) continue;
    if (!cell.includes(COREQ_MARK) && !cell.includes(PREREQ_MARK)) {
      for (const name of cell.split(/\s*[,/]\s*/)) {
        if (name && !instructors.includes(name)) instructors.push(name);
      }
      continue;
    }
    // ["önce", "Yan koşul:", "metin", "Ön koşul:", "metin", ...]
    const parts = cell.split(/(Yan koşul:|Ön koşul:)/);
    for (let i = 1; i < parts.length; i += 2) {
      const body = parts[i + 1].trim();
      if (parts[i] === COREQ_MARK) {
        for (const code of parseCoreqList(body)) if (!corequisites.includes(code)) corequisites.push(code);
      } else if (body && body !== "-") {
        prereqParts.push(body);
      }
    }
  }

  return { corequisites, prerequisites: prereqParts.join(" "), instructors };
}

function rowInfo(row: RawRow, formatVersion: 1 | 2, where: string): ParsedInfo {
  if ("infoCells" in row && Array.isArray(row.infoCells)) return parseInfoCells(row.infoCells);
  if (formatVersion === 2) throw new Error(`${where}: v2 satırında infoCells yok`);
  // v1: coreqText içinde "Ön koşul:" de olabilir; instructorText "Ön koşul: ..." ise hoca değil ön koşuldur.
  const v1 = row as RawRowV1;
  return parseInfoCells([v1.coreqText ?? "", v1.instructorText ?? ""]);
}

export function buildTermData(exports: RawExport[], opts: { fetchedAt: string }): TermData {
  if (exports.length === 0) throw new Error("En az bir dışa aktarma dosyası gerekli");
  for (const exp of exports) {
    const v = exp.formatVersion ?? 1;
    if (v !== 1 && v !== 2) throw new Error(`Desteklenmeyen dışa aktarma biçimi: formatVersion ${v}`);
  }
  const labels = new Set(exports.map((e) => e.termLabel));
  if (labels.size !== 1 || !exports[0].termLabel) {
    throw new Error(`Dosyalar farklı dönemlerden ya da dönem bilgisi yok: ${[...labels].join(", ")}`);
  }
  const termLabel = exports[0].termLabel;

  const courses = new Map<string, Course>();
  const infoBySection = new Map<Section, ParsedInfo>();
  for (const exp of exports) {
    const formatVersion = exp.formatVersion ?? 1;
    for (const row of exp.rows) {
      const code = `${squash(row.subject)} ${squash(row.number)}`;
      const where = `${code}.${row.section}`;
      let course = courses.get(code);
      if (!course) {
        course = {
          code,
          slug: courseSlug(code),
          title: row.title,
          ects: parseCredits(row.creditsText),
          localCredits: null,
          prerequisites: "",
          corequisites: [],
          sections: [],
        };
        courses.set(code, course);
      }
      if (course.sections.some((s) => s.id === row.section)) continue;
      const info = rowInfo(row, formatVersion, where);
      const section: Section = {
        id: row.section,
        instructors: info.instructors,
        capacity: null,
        restrictions: null,
        meetings: dedupeMeetings(row.meetings.map((m) => parseMeeting(m, where))),
      };
      infoBySection.set(section, info);
      course.sections.push(section);
    }
  }

  const sorted = [...courses.values()].sort((a, b) => a.code.localeCompare(b.code, "en"));
  for (const c of sorted) {
    c.sections.sort((a, b) => a.id.localeCompare(b.id, "en"));
    const infos = c.sections.map((s) => infoBySection.get(s)!);
    // Ön koşul: şube sırasıyla ilk dolu olan. Yan koşul: bütün şubelerdekilerin birleşimi.
    c.prerequisites = infos.find((i) => i.prerequisites)?.prerequisites ?? "";
    c.corequisites = [...new Set(infos.flatMap((i) => i.corequisites))];
  }

  return {
    schoolId: "ozyegin",
    termId: termIdFromLabel(termLabel),
    termLabel,
    fetchedAt: opts.fetchedAt,
    courses: sorted,
  };
}

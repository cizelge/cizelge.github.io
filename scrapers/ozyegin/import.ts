// export-snippet.js çıktısını (bir veya birden çok dosya) ortak TermData biçimine çevirir.
import type { Course, Meeting, Section, TermData } from "../../src/lib/types";

export interface RawMeeting {
  dayText: string;
  timeText: string;
}

export interface RawRow {
  subject: string;
  number: string;
  section: string;
  title: string;
  creditsText: string;
  coreqText: string;
  instructorText: string;
  meetings: RawMeeting[];
}

export interface RawExport {
  source: string;
  termLabel: string | null;
  exportedAt: string;
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

function termIdFromLabel(label: string): string {
  return label
    .toLocaleLowerCase("tr")
    .replace(/ü/g, "u")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const pad = (h: string) => h.padStart(2, "0");

function parseMeeting(m: RawMeeting, where: string): Meeting {
  const day = DAYS[m.dayText];
  if (!day) throw new Error(`${where}: desteklenmeyen gün "${m.dayText}"`);
  const t = m.timeText.match(TIME_RE);
  if (!t) throw new Error(`${where}: saat okunamadı "${m.timeText}"`);
  return { day, start: `${pad(t[1])}:${t[2]}`, end: `${pad(t[3])}:${t[4]}`, room: null };
}

function parseCredits(text: string): number | null {
  const n = text.match(/(\d+(?:[.,]\d+)?)/);
  return n ? Number(n[1].replace(",", ".")) : null;
}

function parseCoreqs(text: string): string[] {
  const body = text.replace(/^Yan koşul:\s*/, "").trim();
  if (!body || body === "-") return [];
  return body
    .split(/\s*(?:,|;|\bve\b)\s*/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseInstructors(text: string): string[] {
  return text
    .split(/\s*[,;/]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function buildTermData(exports: RawExport[], opts: { fetchedAt: string }): TermData {
  if (exports.length === 0) throw new Error("En az bir dışa aktarma dosyası gerekli");
  const labels = new Set(exports.map((e) => e.termLabel));
  if (labels.size !== 1 || !exports[0].termLabel) {
    throw new Error(`Dosyalar farklı dönemlerden ya da dönem bilgisi yok: ${[...labels].join(", ")}`);
  }
  const termLabel = exports[0].termLabel;

  const courses = new Map<string, Course>();
  for (const exp of exports) {
    for (const row of exp.rows) {
      const code = `${row.subject} ${row.number}`;
      const where = `${code}.${row.section}`;
      let course = courses.get(code);
      if (!course) {
        course = {
          code,
          slug: code.toLowerCase().replace(/\s+/g, "-"),
          title: row.title,
          ects: parseCredits(row.creditsText),
          localCredits: null,
          prerequisites: "",
          corequisites: parseCoreqs(row.coreqText),
          sections: [],
        };
        courses.set(code, course);
      }
      if (course.sections.some((s) => s.id === row.section)) continue;
      const section: Section = {
        id: row.section,
        instructors: parseInstructors(row.instructorText),
        capacity: null,
        restrictions: null,
        meetings: row.meetings.map((m) => parseMeeting(m, where)),
      };
      course.sections.push(section);
    }
  }

  const sorted = [...courses.values()].sort((a, b) => a.code.localeCompare(b.code, "en"));
  for (const c of sorted) c.sections.sort((a, b) => a.id.localeCompare(b.id, "en"));

  return {
    schoolId: "ozyegin",
    termId: termIdFromLabel(termLabel),
    termLabel,
    fetchedAt: opts.fetchedAt,
    courses: sorted,
  };
}

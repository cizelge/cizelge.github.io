// Özyeğin'in herkese açık "Açılan Dersler" sayfasını (SIS girişi gerekmez) okur.
// Ayrıntılar: scrapers/ozyegin/public-offerings.md
//
// Sayfa program başınadır (?term=202610&program=BSCS); her müfredat alanı ayrı bir tablodur ve bir satır
// bir şubedir: "CS 201.A" | "Veri Yapıları ve Algoritmalar, <a>EMRE SEFER</a>" | "<span>Çarşamba 16:40 - 18:30</span>".
// HTML bozuk (ör. "<tbody></td>", son satırda kapanmayan etiketler), bu yüzden DOM değil satır başı
// çapası (<td width="130">) ile okunur. Ayrıştırma fonksiyonları ağdan bağımsızdır; getirme ayrıdır.
import { parseTermLabel, type TermInfo } from "../../src/lib/terms";
import type { Course, Meeting, Section } from "../../src/lib/types";
import { COURSE_CODE_RE, courseSlug } from "./import";

export const OFFERINGS_URL = "https://www.ozyegin.edu.tr/tr/acilan-dersler";
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

export interface OfferingMeeting {
  day: Meeting["day"];
  start: string;
  end: string;
}

export interface OfferingRow {
  code: string;          // "CS 201"
  section: string;       // "A"
  title: string;
  /** Sayfada ad boşsa null (bağlantı var ama adı yok). */
  instructor: string | null;
  meetings: OfferingMeeting[];
  area: string | null;   // tablo başlığı: "BSCS Zorunlu"
}

export interface SelectOption {
  value: string;
  label: string;
  selected: boolean;
}

export interface OfferingsPage {
  terms: SelectOption[];
  programs: SelectOption[];
  /** Seçili dönem ("202610"); sayfada yoksa null. */
  termCode: string | null;
  termLabel: string | null;
  rows: OfferingRow[];
  /** Okunamayan satırlar (kod ya da saat biçimi beklenmedik). */
  warnings: string[];
}

const DAYS: Record<string, Meeting["day"]> = {
  pazartesi: 1, salı: 2, çarşamba: 3, perşembe: 4, cuma: 5, cumartesi: 6, pazar: 7,
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (all, name: string) => {
    if (name[0] === "#") {
      const n = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[name.toLowerCase()] ?? all;
  });
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const stripTags = (s: string) => squash(decodeEntities(s.replace(/<[^>]*>/g, " ")));
const pad = (h: string) => h.padStart(2, "0");

function parseSelect(html: string, id: string): SelectOption[] {
  const m = html.match(new RegExp(`<select[^>]*id="${id}"[^>]*>([\\s\\S]*?)</select>`));
  if (!m) return [];
  const out: SelectOption[] = [];
  for (const o of m[1].matchAll(/<option([^>]*)>([^<]*)/g)) {
    const value = o[1].match(/value="([^"]*)"/)?.[1];
    if (value === undefined) continue;
    out.push({ value: decodeEntities(value), label: squash(decodeEntities(o[2])), selected: /selected/.test(o[1]) });
  }
  return out;
}

const TIME_RE = /^(\S+)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
const SECTION_RE = /^(.+?)\.([A-Za-z0-9ÇĞİÖŞÜ_-]+)$/;

/** Bir program sayfasının HTML'ini okur. Hiç ağ erişimi yapmaz. */
export function parseOfferingsPage(html: string): OfferingsPage {
  const terms = parseSelect(html, "selectTerm");
  const programs = parseSelect(html, "selectProgram").filter((p) => p.value && p.value !== "0");
  const selectedTerm = terms.find((t) => t.selected) ?? null;
  const warnings: string[] = [];
  const rows: OfferingRow[] = [];

  // Başlıkları ve satırları belge sırasıyla gez: başlık, sonraki satırların alanıdır.
  const token = /<th colspan="3">([^<]*)|<td width="130">([\s\S]*?)(?=<td width="130">|<th colspan="3">|<\/table>|$)/g;
  let area: string | null = null;
  for (const t of html.matchAll(token)) {
    if (t[1] !== undefined) {
      area = squash(decodeEntities(t[1])) || null;
      continue;
    }
    const chunk = t[2];
    const cells = chunk.split(/<td(?:\s[^>]*)?>/);
    // cells[0] = şube hücresi, cells[1] = ad + hoca, cells[2] = saatler (width="180")
    const key = stripTags(cells[0] ?? "");
    const sm = key.match(SECTION_RE);
    const cm = sm ? squash(sm[1]).match(COURSE_CODE_RE) : null;
    if (!sm || !cm) {
      warnings.push(`Şube kodu okunamadı: "${key}"`);
      continue;
    }
    const code = `${cm[1]} ${cm[2]}`;
    const where = `${code}.${sm[2]}`;

    const info = cells[1] ?? "";
    const staffAt = info.search(/<a[^>]*href="[^"]*\/(?:akademik-kadro|faculty)\//);
    const titlePart = staffAt >= 0 ? info.slice(0, staffAt) : info.replace(/<a[\s\S]*$/, "");
    // "Yapay Zekaya Giriş , <a>" biçimi de var: virgülden önceki boşluk da atılır.
    const title = stripTags(titlePart).replace(/\s*,\s*$/, "").trim();
    let instructor: string | null = null;
    if (staffAt >= 0) {
      const a = info.slice(staffAt).match(/<a[^>]*>([\s\S]*?)<\/a>/);
      instructor = a ? stripTags(a[1]) || null : null;
    }

    const meetings: OfferingMeeting[] = [];
    for (const span of (cells[2] ?? "").matchAll(/<span>([^<]*)<\/span>/g)) {
      const text = squash(decodeEntities(span[1]));
      if (!text) continue;
      const tm = text.match(TIME_RE);
      const day = tm ? DAYS[tm[1].toLocaleLowerCase("tr")] ?? DAYS[tm[1].toLowerCase()] : undefined;
      if (!tm || !day) {
        warnings.push(`${where}: saat okunamadı "${text}"`);
        continue;
      }
      const m: OfferingMeeting = { day, start: `${pad(tm[2])}:${tm[3]}`, end: `${pad(tm[4])}:${tm[5]}` };
      if (!meetings.some((x) => x.day === m.day && x.start === m.start && x.end === m.end)) meetings.push(m);
    }

    rows.push({ code, section: sm[2], title, instructor, meetings, area });
  }

  return {
    terms,
    programs,
    termCode: selectedTerm?.value ?? null,
    termLabel: selectedTerm?.label ?? null,
    rows,
    warnings,
  };
}

/** "202610" -> 2026-2027 Güz; "202620" Bahar, "202630" Yaz. Etiket varsa ondan okunur. */
export function termFromOption(opt: { value: string; label: string }): TermInfo | null {
  try {
    return parseTermLabel(opt.label);
  } catch {
    return null;
  }
}

/**
 * Birden çok program sayfasının satırlarını derse/şubeye göre birleştirir (aynı şube birçok alanda
 * tekrar eder). Kapasite, derslik, AKTS ve koşullar sayfada yoktur: null/boş bırakılır.
 */
export function rowsToCourses(rows: readonly OfferingRow[]): Course[] {
  const courses = new Map<string, Course>();
  for (const r of rows) {
    let course = courses.get(r.code);
    if (!course) {
      course = {
        code: r.code,
        slug: courseSlug(r.code),
        title: r.title,
        ects: null,
        localCredits: null,
        prerequisites: "",
        corequisites: [],
        sections: [],
      };
      courses.set(r.code, course);
    }
    if (!course.title && r.title) course.title = r.title;
    const existing = course.sections.find((s) => s.id === r.section);
    if (existing) {
      if (existing.instructors.length === 0 && r.instructor) existing.instructors = [r.instructor];
      continue;
    }
    const section: Section = {
      id: r.section,
      instructors: r.instructor ? [r.instructor] : [],
      capacity: null,
      restrictions: null,
      meetings: r.meetings.map((m) => ({ ...m, room: null })),
    };
    course.sections.push(section);
  }
  const sorted = [...courses.values()].sort((a, b) => a.code.localeCompare(b.code, "en"));
  for (const c of sorted) c.sections.sort((a, b) => a.id.localeCompare(b.id, "en"));
  return sorted;
}

// ---------------------------------------------------------------------------------------------------
// Getirme (ağ). Sıralı istek, istekler arası bekleme, sıradan bir tarayıcı User-Agent'ı.

export type FetchText = (url: string) => Promise<string>;

export const defaultFetchText: FetchText = async (url) => {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "tr-TR,tr;q=0.9", Accept: "text/html" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      await sleep(5000 * attempt);
    }
  }
  throw lastErr;
};

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function offeringsUrl(termCode: string, program: string): string {
  return `${OFFERINGS_URL}?term=${encodeURIComponent(termCode)}&program=${encodeURIComponent(program)}`;
}

/** Program listesi yalnızca bir program seçiliyken ve o programın fakültesi için gelir; tohumlarla başlanır. */
export const SEED_PROGRAMS = ["BSCS", "BAIR", "BLAW", "BABAF", "BSARCH (TR)", "BSAVM", "BSHOTM"];

export interface FetchOptions {
  fetchText?: FetchText;
  delayMs?: number;
  seeds?: readonly string[];
  log?: (msg: string) => void;
}

export interface TermOfferings {
  termCode: string;
  term: TermInfo;
  programs: string[];
  rows: OfferingRow[];
  courses: Course[];
  warnings: string[];
}

/** Sayfadaki dönem listesini ve seçili (varsayılan) dönemi öğrenmek için tek istek. */
export async function fetchTermOptions(opts: FetchOptions = {}): Promise<OfferingsPage> {
  const fetchText = opts.fetchText ?? defaultFetchText;
  const seed = (opts.seeds ?? SEED_PROGRAMS)[0];
  return parseOfferingsPage(await fetchText(`${OFFERINGS_URL}?program=${encodeURIComponent(seed)}`));
}

/**
 * Bir dönem için bütün programları gezer. İlk tohum sayfasında hiç satır yoksa (dönem yayında değil)
 * hemen boş döner; böylece yayında olmayan dönem başına yalnızca bir istek yapılır.
 */
export async function fetchTermOfferings(termCode: string, opts: FetchOptions = {}): Promise<TermOfferings | null> {
  const fetchText = opts.fetchText ?? defaultFetchText;
  const delayMs = opts.delayMs ?? 1500;
  const log = opts.log ?? (() => {});
  const queue = [...(opts.seeds ?? SEED_PROGRAMS)];
  const seen = new Set<string>();
  const rows: OfferingRow[] = [];
  const warnings: string[] = [];
  let term: TermInfo | null = null;
  let first = true;

  while (queue.length > 0) {
    const program = queue.shift()!;
    if (seen.has(program)) continue;
    seen.add(program);
    if (!first) await sleep(delayMs);
    const page = parseOfferingsPage(await fetchText(offeringsUrl(termCode, program)));
    log(`  ${program}: ${page.rows.length} satır`);
    if (page.termCode !== termCode) {
      throw new Error(`İstenen dönem ${termCode}, sayfa ${page.termCode ?? "dönem yok"} gösteriyor (${program})`);
    }
    if (!term && page.termLabel) term = termFromOption({ value: termCode, label: page.termLabel });
    if (first && page.rows.length === 0) return null;
    first = false;
    rows.push(...page.rows);
    warnings.push(...page.warnings.map((w) => `${program}: ${w}`));
    for (const p of page.programs) if (!seen.has(p.value) && !queue.includes(p.value)) queue.push(p.value);
  }

  if (!term) throw new Error(`Dönem adı okunamadı: ${termCode}`);
  const programs = [...seen].sort();
  return { termCode, term, programs, rows, courses: rowsToCourses(rows), warnings };
}

// SIS program planı dışa aktarmasını (formatVersion 1) ProgramsData biçimine çevirir.
//
// Her program için plan tablosunun satırları sırasıyla gelir. Tek dolu hücreli ve kodu olmayan satır
// dönem başlığıdır ("1. Yıl - Güz (30 Kredi)"). Kod hücresi dolu satır derstir; kod hücresi boş ama adı
// olan satır seçmeli yer tutucusudur ve havuzu pools[ad] içindedir. Hücre düzeni: kod, ad, kredi,
// ön koşul, yan koşul, (kullanılmayan).
import type { PlanItem, PlanPoolCourse, PlanSeason, PlanSemester, Program, ProgramsData } from "../../src/lib/types";
import { COURSE_CODE_RE, courseSlug, parseCoreqList, parseCredits } from "./import";

export type RawPlanRow = string[];

export interface RawProgram {
  code: string;
  name: string;
  faculty: string;
  rows: RawPlanRow[];
  /** Seçmeli adı -> havuz satırları; null = toplanamadı. */
  pools: Record<string, RawPlanRow[] | null>;
}

export interface RawProgramsExport {
  source: string;
  formatVersion: 1;
  exportedAt: string;
  programs: RawProgram[];
}

const squash = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** "SEC201L" -> "SEC 201L", "mi̇m105" -> "MİM 105"; kod değilse null. */
export function parsePlanCode(text: string): string | null {
  const m = squash(text).toUpperCase().normalize("NFC").match(COURSE_CODE_RE);
  return m ? `${m[1]} ${m[2]}` : null;
}

export interface SemesterHeader {
  year: number;
  season: PlanSeason;
  credits: number | null;
}

/** Başlık metninden yıl, dönem ve kredi. Yıl okunamazsa `previousYear` kullanılır; asla hata vermez. */
export function parseSemesterHeader(text: string, previousYear: number): SemesterHeader {
  const t = squash(text);
  const lower = t.toLocaleLowerCase("tr");
  const yearMatch = t.match(/(\d+)\s*\.\s*Yıl/i);
  const year = yearMatch ? Number(yearMatch[1]) : /hazırlık/.test(lower) ? 0 : previousYear;
  const season: PlanSeason = /(^|[^\p{L}])güz($|[^\p{L}])/u.test(lower)
    ? "guz"
    : /(^|[^\p{L}])bahar($|[^\p{L}])/u.test(lower)
      ? "bahar"
      : /(^|[^\p{L}])yaz/u.test(lower)
        ? "yaz"
        : "other";
  const c = t.match(/\((\d+(?:[.,]\d+)?)\s*Kredi\)/i);
  return { year, season, credits: c ? Number(c[1].replace(",", ".")) : null };
}

function isHeaderRow(row: readonly string[]): boolean {
  const first = squash(row[0]);
  return first !== "" && row.slice(1).every((c) => squash(c) === "") && parsePlanCode(first) === null;
}

function parsePool(rows: RawPlanRow[], where: string, warnings: string[]): PlanPoolCourse[] {
  const out: PlanPoolCourse[] = [];
  for (const row of rows) {
    const code = parsePlanCode(row[0] ?? "");
    if (!code) {
      if (row.some((c) => squash(c))) warnings.push(`${where}: kodu okunamayan havuz satırı atlandı: ${JSON.stringify(row)}`);
      else warnings.push(`${where}: boş havuz satırı atlandı`);
      continue;
    }
    if (out.some((c) => c.code === code)) continue;
    out.push({ code, title: squash(row[1]), credits: parseCredits(squash(row[2])) });
  }
  return out;
}

function buildProgram(raw: RawProgram, warnings: string[]): Program {
  const id = squash(raw.code);
  const semesters: PlanSemester[] = [];
  let current: PlanSemester | null = null;
  const pools = raw.pools ?? {};
  const parsedPools = new Map<string, PlanPoolCourse[] | null>();
  const poolFor = (label: string): PlanPoolCourse[] | null => {
    if (!parsedPools.has(label)) {
      const rawPool = Object.hasOwn(pools, label) ? pools[label] : null;
      if (!Object.hasOwn(pools, label)) warnings.push(`${id}: "${label}" için havuz yok`);
      parsedPools.set(label, Array.isArray(rawPool) ? parsePool(rawPool, `${id} "${label}"`, warnings) : null);
    }
    return parsedPools.get(label)!;
  };

  for (const row of raw.rows ?? []) {
    if (!Array.isArray(row) || row.every((c) => squash(c) === "")) continue;

    if (isHeaderRow(row)) {
      const header = parseSemesterHeader(row[0], current?.year ?? 0);
      current = { ...header, label: squash(row[0]), items: [] };
      semesters.push(current);
      continue;
    }

    if (!current) {
      warnings.push(`${id}: başlıktan önce gelen satırlar başlıksız bir döneme kondu`);
      current = { year: 0, season: "other", label: "", credits: null, items: [] };
      semesters.push(current);
    }

    const codeCell = squash(row[0]);
    const title = squash(row[1]);
    const credits = parseCredits(squash(row[2]));
    const code = parsePlanCode(codeCell);
    let item: PlanItem;
    if (code) {
      item = {
        kind: "course",
        code,
        title,
        credits,
        prerequisites: squash(row[3]),
        corequisites: parseCoreqList(squash(row[4]))
          .map((c) => parsePlanCode(c) ?? c)
          .filter((c) => c !== code),
      };
    } else {
      // Kod hücresi boş (ya da kod değil): seçmeli yer tutucusu.
      const label = title || codeCell;
      item = { kind: "elective", label, credits, pool: poolFor(label) };
    }
    current.items.push(item);
  }

  return { id, slug: courseSlug(id), name: squash(raw.name), faculty: squash(raw.faculty), semesters };
}

export function buildProgramsData(raw: RawProgramsExport): { data: ProgramsData; warnings: string[] } {
  if (raw.formatVersion !== 1) throw new Error(`Desteklenmeyen program planı biçimi: formatVersion ${raw.formatVersion}`);
  if (!Array.isArray(raw.programs)) throw new Error("Dışa aktarmada programs listesi yok");
  const warnings: string[] = [];
  const programs = raw.programs.map((p) => buildProgram(p, warnings));
  return { data: { schoolId: "ozyegin", fetchedAt: raw.exportedAt, programs }, warnings };
}

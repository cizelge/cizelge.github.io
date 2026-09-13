// Yayına çıkmadan önce TermData kontrolü. Boş dizi = geçti.
import { parseTermLabel } from "../src/lib/terms";
import type { ProgramsData, TermData } from "../src/lib/types";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DROP = 0.3;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** /<okul>/<slug> ders sayfalarıyla çakışan sabit yol parçaları (src/app/ozyegin/donem). */
export const RESERVED_SEGMENTS = ["donem"] as const;

export function validateTermData(term: TermData, previous?: TermData | null): string[] {
  const errors: string[] = [];

  try {
    const info = parseTermLabel(term.termLabel);
    if (info.id !== term.termId) errors.push(`Dönem kimliği "${term.termId}", dönem adına göre "${info.id}" olmalı`);
  } catch (e) {
    errors.push((e as Error).message);
  }

  if (term.courses.length === 0) errors.push("Hiç ders yok");

  const seenCodes = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const c of term.courses) {
    if (seenCodes.has(c.code)) errors.push(`Tekrar eden ders kodu: ${c.code}`);
    seenCodes.add(c.code);
    if (seenSlugs.has(c.slug)) errors.push(`Tekrar eden slug: ${c.slug} (${c.code})`);
    seenSlugs.add(c.slug);
    if ((RESERVED_SEGMENTS as readonly string[]).includes(c.slug)) {
      errors.push(`${c.code}: slug "${c.slug}" ayrılmış bir yol parçası (${RESERVED_SEGMENTS.join(", ")})`);
    }
    if (!SLUG.test(c.slug)) errors.push(`${c.code}: slug yalnızca a-z, 0-9 ve "-" içermeli ("${c.slug}")`);
  }

  for (const c of term.courses) {
    if (!c.code || !c.title) errors.push(`Kodu ya da adı eksik ders: "${c.code}"`);
    if (c.sections.length === 0) errors.push(`${c.code}: hiç şube yok`);
    for (const s of c.sections) {
      for (const m of s.meetings) {
        const where = `${c.code}.${s.id}`;
        if (!Number.isInteger(m.day) || m.day < 1 || m.day > 7) errors.push(`${where}: geçersiz gün ${m.day}`);
        if (!HHMM.test(m.start) || !HHMM.test(m.end)) {
          errors.push(`${where}: geçersiz saat ${m.start}-${m.end}`);
        } else if (m.start >= m.end) {
          errors.push(`${where}: başlangıç bitişten önce değil (${m.start}-${m.end})`);
        }
      }
    }
  }

  if (previous && previous.termId === term.termId && previous.courses.length > 0) {
    const drop = 1 - term.courses.length / previous.courses.length;
    if (drop > MAX_DROP) {
      errors.push(
        `Ders sayısı %${Math.round(drop * 100)} düştü (${previous.courses.length} → ${term.courses.length})`,
      );
    }
  }

  return errors;
}

/** Müfredat verisi kontrolü. Boş dizi = geçti. */
export function validateProgramsData(data: ProgramsData): string[] {
  const errors: string[] = [];
  if (data.programs.length === 0) errors.push("Hiç program yok");

  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const p of data.programs) {
    if (ids.has(p.id)) errors.push(`Tekrar eden program kodu: ${p.id}`);
    ids.add(p.id);
    if (slugs.has(p.slug)) errors.push(`Tekrar eden program slug: ${p.slug} (${p.id})`);
    slugs.add(p.slug);
    if (!p.id || !p.name) errors.push(`Kodu ya da adı eksik program: "${p.id}"`);
    if (!SLUG.test(p.slug)) errors.push(`${p.id}: slug yalnızca a-z, 0-9 ve "-" içermeli ("${p.slug}")`);
    if (!p.semesters.some((s) => s.items.length > 0)) errors.push(`${p.id}: hiç ders satırı yok`);
  }
  return errors;
}

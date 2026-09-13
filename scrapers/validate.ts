// Yayına çıkmadan önce TermData kontrolü. Boş dizi = geçti.
import type { TermData } from "../src/lib/types";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DROP = 0.3;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateTermData(term: TermData, previous?: TermData | null): string[] {
  const errors: string[] = [];

  if (term.courses.length === 0) errors.push("Hiç ders yok");

  const seenCodes = new Set<string>();
  const seenSlugs = new Set<string>();
  for (const c of term.courses) {
    if (seenCodes.has(c.code)) errors.push(`Tekrar eden ders kodu: ${c.code}`);
    seenCodes.add(c.code);
    if (seenSlugs.has(c.slug)) errors.push(`Tekrar eden slug: ${c.slug} (${c.code})`);
    seenSlugs.add(c.slug);
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

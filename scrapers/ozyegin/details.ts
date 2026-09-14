// Şube ayrıntı penceresinden toplanan kota ve derslikleri dönem verisine işler.
// Kayıtlı öğrenci sayısı bilerek alınmaz: kayıt döneminde saniyeler içinde eskir.
import type { TermData } from "../../src/lib/types";

export interface RawRoom {
  day: number | null;
  start: string;
  room: string;
}

export interface RawSectionDetail {
  kota?: string;
  kayitli?: string;
  ects?: string;
  rooms?: RawRoom[];
  error?: string;
}

export interface RawDetailsExport {
  source: "ozyegin-sis-section-detail";
  termLabel: string;
  exportedAt: string;
  /** Anahtar ızgaradaki yazımla: "CS 201.A". */
  sections: Record<string, RawSectionDetail>;
}

export interface DetailsReport {
  sectionsUpdated: number;
  sectionsWithoutDetail: string[];
  meetingsWithRoom: number;
  meetingsWithoutRoom: number;
  unknownKeys: string[];
}

const squash = (s: string) => s.replace(/\s+/g, "");

/** Derslik adındaki kampüs ön ekini atar: "CK.EF_AB1.245" -> "EF_AB1.245". */
export function displayRoom(raw: string): string {
  return raw.trim().replace(/^CK\./, "");
}

export function applySectionDetails(term: TermData, details: RawDetailsExport): { term: TermData; report: DetailsReport } {
  const byKey = new Map(Object.entries(details.sections).map(([k, v]) => [squash(k), v]));
  const used = new Set<string>();
  const report: DetailsReport = { sectionsUpdated: 0, sectionsWithoutDetail: [], meetingsWithRoom: 0, meetingsWithoutRoom: 0, unknownKeys: [] };

  const courses = term.courses.map((course) => ({
    ...course,
    sections: course.sections.map((section) => {
      const key = squash(`${course.code}.${section.id}`);
      const detail = byKey.get(key);
      if (!detail || detail.error) {
        report.sectionsWithoutDetail.push(`${course.code}.${section.id}`);
        for (const m of section.meetings) if (m.room) report.meetingsWithRoom++; else report.meetingsWithoutRoom++;
        return section;
      }
      used.add(key);
      report.sectionsUpdated++;
      const kota = Number(detail.kota);
      const rooms = detail.rooms ?? [];
      const meetings = section.meetings.map((m) => {
        let matches = rooms.filter((r) => r.day === m.day && r.start === m.start);
        // Gün okunamadıysa ve saat tekse saate göre eşle.
        if (matches.length === 0) {
          const byStart = rooms.filter((r) => r.day === null && r.start === m.start);
          if (byStart.length > 0 && section.meetings.filter((x) => x.start === m.start).length === 1) matches = byStart;
        }
        const names = [...new Set(matches.map((r) => displayRoom(r.room)).filter(Boolean))].sort();
        const room = names.length ? names.join(", ") : m.room;
        if (room) report.meetingsWithRoom++; else report.meetingsWithoutRoom++;
        return { ...m, room };
      });
      return { ...section, capacity: Number.isFinite(kota) && kota > 0 ? kota : section.capacity, meetings };
    }),
  }));

  for (const k of Object.keys(details.sections)) if (!used.has(squash(k)) && !details.sections[k].error) report.unknownKeys.push(k);
  return { term: { ...term, courses }, report };
}

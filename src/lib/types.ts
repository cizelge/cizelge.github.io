// Ortak biçim (dönem başına bir JSON dosyası).
// Kaynak: docs/superpowers/specs/2026-09-13-ders-planlayici-parca-1-design.md

export interface TermData {
  schoolId: string;
  termId: string;                // "2026-2027-guz"
  termLabel: string;             // "2026 - 2027 Güz"
  fetchedAt: string;             // ISO zaman
  courses: Course[];
}

export interface Course {
  code: string;                  // "CS 101"
  slug: string;                  // "cs-101"
  title: string;
  ects: number | null;
  localCredits: number | null;   // ECTS ile ayrı tutulur, asla karıştırılmaz
  prerequisites: string;         // kaynaktaki metin
  corequisites: string[];        // ["CS 101L"]
  sections: Section[];
}

export interface Section {
  id: string;                    // "A", "B"
  instructors: string[];
  capacity: number | null;
  restrictions: string | null;
  meetings: Meeting[];
}

export interface Meeting {
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7; // 1 = Pazartesi … 6 = Cumartesi, 7 = Pazar
  start: string;                 // "10:40"
  end: string;                   // "12:30"
  room: string | null;
}

// Bölüm müfredatları (data/ozyegin/programs.json). Kaynak: SIS program planı, scrapers/ozyegin/programs.ts.

export interface ProgramsData {
  schoolId: string;
  fetchedAt: string;             // ISO zaman
  programs: Program[];
}

export interface Program {
  id: string;                    // SIS program kodu olduğu gibi: "BSCS", "BSARCH (TR)"
  slug: string;                  // "bscs", "bsarch-tr"
  name: string;
  faculty: string;
  semesters: PlanSemester[];
}

export type PlanSeason = "guz" | "bahar" | "yaz" | "other";

export interface PlanSemester {
  year: number;                  // 0 = Hazırlık
  season: PlanSeason;
  label: string;                 // başlık satırı olduğu gibi: "1. Yıl - Güz (30 Kredi)"
  credits: number | null;
  items: PlanItem[];
}

export interface PlanPoolCourse {
  code: string;
  title: string;
  credits: number | null;
}

export type PlanItem =
  | { kind: "course"; code: string; title: string; credits: number | null; prerequisites: string; corequisites: string[] }
  | { kind: "elective"; label: string; credits: number | null; pool: PlanPoolCourse[] | null };

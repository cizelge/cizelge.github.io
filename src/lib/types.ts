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

// Geliştirme için ÖRNEK veri üretir (gerçek Özyeğin verisi değildir).
// Kullanım: npx tsx scripts/make-sample-data.ts  ->  data-sample/ozyegin/ornek.json
import fs from "node:fs";
import path from "node:path";
import type { Course, Meeting } from "../src/lib/types";

type Slot = [Meeting["day"], string, string];
const m = ([day, start, end]: Slot): Meeting => ({ day, start, end, room: null });

function course(
  code: string,
  title: string,
  ects: number,
  sections: Record<string, { who: string; slots: Slot[] }>,
  corequisites: string[] = [],
): Course {
  return {
    code,
    slug: code.toLowerCase().replace(/\s+/g, "-"),
    title,
    ects,
    localCredits: null,
    prerequisites: "",
    corequisites,
    sections: Object.entries(sections).map(([id, s]) => ({
      id,
      instructors: [s.who],
      capacity: null,
      restrictions: null,
      meetings: s.slots.map(m),
    })),
  };
}

const courses: Course[] = [
  course("CS 101", "Bilgisayar Programlama", 6, {
    A: { who: "Örnek Hoca 1", slots: [[1, "08:40", "10:30"], [3, "08:40", "09:30"]] },
    B: { who: "Örnek Hoca 1", slots: [[1, "10:40", "12:30"], [3, "10:40", "11:30"]] },
  }, ["CS 101L"]),
  course("CS 101L", "Bilgisayar Programlama Laboratuvarı", 0, {
    A: { who: "Örnek Asistan 1", slots: [[2, "12:40", "14:30"]] },
    B: { who: "Örnek Asistan 1", slots: [[4, "14:40", "16:30"]] },
    C: { who: "Örnek Asistan 2", slots: [[5, "10:40", "12:30"]] },
  }, ["CS 101"]),
  course("MATH 103", "Analiz I", 7, {
    A: { who: "Örnek Hoca 2", slots: [[2, "08:40", "10:30"], [4, "08:40", "10:30"]] },
    B: { who: "Örnek Hoca 3", slots: [[2, "14:40", "16:30"], [4, "16:40", "18:30"]] },
  }),
  course("PHYS 101", "Fizik I", 6, {
    A: { who: "Örnek Hoca 4", slots: [[1, "13:40", "15:30"], [3, "13:40", "14:30"]] },
    B: { who: "Örnek Hoca 4", slots: [[3, "15:40", "17:30"], [5, "15:40", "16:30"]] },
    C: { who: "Örnek Hoca 5", slots: [[1, "17:40", "19:30"], [3, "17:40", "18:30"]] },
  }),
  course("ENG 101", "Akademik İngilizce I", 4, {
    A: { who: "Örnek Okutman 1", slots: [[1, "10:40", "12:30"]] },
    B: { who: "Örnek Okutman 2", slots: [[2, "10:40", "12:30"]] },
    C: { who: "Örnek Okutman 3", slots: [[5, "08:40", "10:30"]] },
    D: { who: "Örnek Okutman 1", slots: [[4, "12:40", "14:30"]] },
  }),
  course("GEN 101", "Üniversite Hayatına Giriş", 2, {
    A: { who: "Örnek Hoca 6", slots: [[5, "12:40", "13:30"]] },
    B: { who: "Örnek Hoca 6", slots: [[3, "12:40", "13:30"]] },
  }),
  course("EE 201", "Devre Teorisi", 6, {
    A: { who: "Örnek Hoca 7", slots: [[2, "10:40", "12:30"], [4, "10:40", "11:30"]] },
  }),
  course("HIST 201", "Atatürk İlkeleri ve İnkılap Tarihi I", 2, {
    A: { who: "Örnek Hoca 8", slots: [[5, "16:40", "18:30"]] },
  }),
];

const term = {
  schoolId: "ozyegin",
  termId: "ornek",
  termLabel: "Örnek veri",
  fetchedAt: new Date().toISOString(),
  courses,
};

const out = path.join("data-sample", "ozyegin", "ornek.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(term, null, 2) + "\n");
console.log(`${out}: ${courses.length} ders`);

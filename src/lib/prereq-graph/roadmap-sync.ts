// Ön şart diyagramı ile yol haritası arasında işaret çevirisi. Saf mantık: React ve localStorage yok.
// Diyagramda düğüm id'si ders için kanonik kod, seçmeli için gereksinim id'sidir (rows.ts);
// yol haritası ise her şeyi gereksinim id'siyle tutar (Completion).
import { canonicalCode } from "../roadmap/progress";
import { programRequirements } from "../roadmap/requirements";
import type { Completion } from "../roadmap/types";
import type { Program } from "../types";

export interface DiagramMarks {
  /** Alınmış düğüm id'leri. */
  taken: string[];
  /** Seçmeli düğüm id'si -> havuzdan seçilen ders kodu. */
  choices: Record<string, string>;
}

/** Yol haritası işaretlerinden diyagram işaretleri. Başka programların anahtarları yok sayılır. */
export function marksFromCompletion(program: Program, completion: Completion): DiagramMarks {
  const taken = new Set<string>();
  const choices: Record<string, string> = {};
  for (const req of programRequirements(program, "anadal").requirements) {
    const value = completion[req.id];
    if (value === undefined) continue;
    if (req.kind === "course" && req.code) {
      taken.add(canonicalCode(req.code));
    } else if (req.kind === "elective") {
      taken.add(req.id);
      if (typeof value === "string") choices[req.id] = value;
    }
  }
  return { taken: [...taken], choices };
}

/**
 * Diyagram işaretlerini yol haritası işaretlerine geri yazar. Bu programa ait olmayan anahtarlar olduğu gibi kalır.
 * Ders: alındıysa aynı kodlu bütün gereksinimler true, alınmadıysa silinir.
 * Seçmeli: alındıysa seçilen kod (yoksa true), alınmadıysa silinir.
 */
export function completionFromMarks(program: Program, previous: Completion, marks: DiagramMarks): Completion {
  const taken = new Set(marks.taken);
  const next: Completion = { ...previous };
  for (const req of programRequirements(program, "anadal").requirements) {
    if (req.kind === "course" && req.code) {
      if (taken.has(canonicalCode(req.code))) next[req.id] = true;
      else delete next[req.id];
    } else if (req.kind === "elective") {
      if (taken.has(req.id)) next[req.id] = marks.choices[req.id] ?? true;
      else delete next[req.id];
    }
  }
  return next;
}

/** İki işaret kümesi aynı mı (sıra önemsiz); gereksiz kayıt yazmamak için. */
export function sameCompletion(a: Completion, b: Completion): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

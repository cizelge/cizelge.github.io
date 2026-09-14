// Kullanıcının işaretlerinden ilerleme: geçilen kodlar, program başına kalanlar, toplam AKTS. Saf mantık.
import type { PlanSeason } from "../types";
import type { Completion, ProgramProgress, Requirement, RoadmapProgram } from "./types";

/**
 * Karşılaştırma için tek yazım: büyük harf, harf ile rakam arasında bir boşluk.
 * "math103" -> "MATH 103", "CS  101L" -> "CS 101L".
 */
export function canonicalCode(code: string): string {
  const compact = code.normalize("NFC").replace(/\s+/g, "").toLocaleUpperCase("en");
  const m = compact.match(/^(\p{L}+)(\d.*)$/u);
  return m ? `${m[1]} ${m[2]}` : compact;
}

/** Kümede bu kod (hangi yazımla olursa olsun) var mı. */
export function hasCode(set: ReadonlySet<string>, code: string): boolean {
  const canon = canonicalCode(code);
  return set.has(code) || set.has(canon) || set.has(canon.replace(/\s+/g, ""));
}

export function passedCodes(programs: RoadmapProgram[], completion: Completion): Set<string> {
  const out = new Set<string>();
  for (const p of programs) {
    for (const r of p.requirements) {
      const mark = completion[r.id];
      if (mark === undefined) continue;
      // Havuzdan seçilen ders kodu, işaret true ise dersin kendi kodu.
      if (typeof mark === "string" && mark.trim()) out.add(canonicalCode(mark));
      else if (r.kind === "course" && r.code) out.add(canonicalCode(r.code));
    }
  }
  return out;
}

export function isDone(req: Requirement, completion: Completion, passed: ReadonlySet<string>): boolean {
  if (completion[req.id] !== undefined) return true;
  return req.kind === "course" && !!req.code && hasCode(passed, req.code);
}

export function programProgress(
  program: RoadmapProgram,
  completion: Completion,
  passed: ReadonlySet<string>,
): ProgramProgress {
  let passedCredits = 0;
  let remainingCourses = 0;
  let remainingElectives = 0;
  for (const r of program.requirements) {
    if (isDone(r, completion, passed)) passedCredits += r.credits ?? 0;
    else if (r.kind === "course") remainingCourses++;
    else remainingElectives++;
  }
  return { programId: program.id, passedCredits, totalCredits: program.totalCredits, remainingCourses, remainingElectives };
}

/** Geçilen AKTS; aynı kod birden çok programda (ya da havuz seçiminde) olsa da bir kez sayılır. */
export function passedEcts(programs: RoadmapProgram[], completion: Completion): number {
  const passed = passedCodes(programs, completion);
  const counted = new Map<string, number>();
  for (const p of programs) {
    for (const r of p.requirements) {
      if (!isDone(r, completion, passed)) continue;
      const mark = completion[r.id];
      let key: string;
      let credits = r.credits;
      if (typeof mark === "string" && mark.trim()) {
        key = canonicalCode(mark);
        const chosen = r.pool?.find((c) => canonicalCode(c.code) === key);
        if (chosen && chosen.credits !== null) credits = chosen.credits;
      } else if (r.kind === "course" && r.code) {
        key = canonicalCode(r.code);
      } else {
        key = `#${r.id}`; // serbest seçmeli: hangi ders bilinmiyor, kendi başına sayılır
      }
      if (!counted.has(key) || (counted.get(key) === 0 && credits)) counted.set(key, credits ?? 0);
    }
  }
  let sum = 0;
  for (const c of counted.values()) sum += c;
  return sum;
}

const SEASON_ORDER: Record<PlanSeason, number> = { guz: 0, bahar: 1, yaz: 2, other: 3 };

/** Müfredat sırası: yıl, sonra mevsim (Güz, Bahar, Yaz, diğer). */
export function slotOrder(slot: { year: number; season: PlanSeason }): number {
  return slot.year * 10 + SEASON_ORDER[slot.season];
}

export function markUntil(program: RoadmapProgram, until: { year: number; season: PlanSeason }): Completion {
  const limit = slotOrder(until);
  const out: Completion = {};
  for (const r of program.requirements) {
    if (r.slot && slotOrder(r.slot) < limit) out[r.id] = true;
  }
  return out;
}

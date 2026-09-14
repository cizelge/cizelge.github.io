// Kritik dersler (kalan başka dersleri bekleten) ve okunamayan ön koşullar. Saf mantık.
import { defaultPrereq, type PrereqApi } from "./plan";
import { canonicalCode, isDone, passedCodes } from "./progress";
import type { Completion, RoadmapProgram } from "./types";

/** Kalan "course" gereksinimleri; aynı kod bir kez, ilk ön koşul metniyle. */
function remainingCourses(programs: RoadmapProgram[], completion: Completion): Map<string, string> {
  const passed = passedCodes(programs, completion);
  const out = new Map<string, string>(); // kod -> ön koşul metni
  for (const p of programs) {
    for (const r of p.requirements) {
      if (r.kind !== "course" || !r.code || isDone(r, completion, passed)) continue;
      const code = canonicalCode(r.code);
      const prev = out.get(code);
      if (prev === undefined || (!prev.trim() && r.prerequisites.trim())) out.set(code, r.prerequisites);
    }
  }
  return out;
}

export function criticalCourses(
  programs: RoadmapProgram[],
  completion: Completion,
  prereq: PrereqApi = defaultPrereq,
): { code: string; blocks: string[] }[] {
  const remaining = remainingCourses(programs, completion);
  // Doğrudan bekleyenler: X -> ön koşulunda X geçen kalan dersler.
  const waiting = new Map<string, string[]>();
  for (const [code, text] of remaining) {
    for (const dep of prereq.codes(prereq.parse(text))) {
      const d = canonicalCode(dep);
      if (d === code || !remaining.has(d)) continue;
      const list = waiting.get(d) ?? [];
      if (!list.includes(code)) list.push(code);
      waiting.set(d, list);
    }
  }

  const out: { code: string; blocks: string[] }[] = [];
  for (const code of remaining.keys()) {
    // Dolaylılar dahil, önce yakın olanlar (BFS).
    const blocks: string[] = [];
    const seen = new Set([code]);
    const queue = [code];
    while (queue.length) {
      for (const next of waiting.get(queue.shift()!) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        blocks.push(next);
        queue.push(next);
      }
    }
    if (blocks.length > 0) out.push({ code, blocks });
  }
  return out.sort((a, b) => b.blocks.length - a.blocks.length || a.code.localeCompare(b.code, "tr"));
}

export function unreadablePrerequisites(
  programs: RoadmapProgram[],
  completion: Completion,
  prereq: PrereqApi = defaultPrereq,
): { requirementId: string; code: string; text: string }[] {
  const passed = passedCodes(programs, completion);
  const out: { requirementId: string; code: string; text: string }[] = [];
  for (const p of programs) {
    for (const r of p.requirements) {
      if (r.kind !== "course" || !r.code || !r.prerequisites.trim() || isDone(r, completion, passed)) continue;
      if (prereq.hasUnknown(prereq.parse(r.prerequisites))) {
        out.push({ requirementId: r.id, code: r.code, text: r.prerequisites });
      }
    }
  }
  return out;
}

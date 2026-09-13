import type { Course } from "../types";

/** "cs 101l" / "CS101L" / "CS 101L" -> "CS101L" */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

/**
 * Returns `selected` plus every corequisite reachable from it that exists in
 * `allCourses` (codes not offered this term are ignored).
 *
 * The relation is treated as symmetric: a course is pulled in if a chosen course
 * lists it, OR if it lists a chosen course. Source data often records the link
 * on only one side (lecture lists lab, lab lists nothing), and the rule is
 * "when one is added, the other is added too". Chains are followed.
 *
 * Order: the selection as given, then added courses in discovery (BFS) order.
 */
export function expandCorequisites(selected: readonly Course[], allCourses: readonly Course[]): Course[] {
  const byCode = new Map<string, Course>();
  const listedBy = new Map<string, Course[]>(); // coreq code -> courses that list it
  for (const c of allCourses) {
    const key = normalizeCode(c.code);
    if (!byCode.has(key)) byCode.set(key, c);
    for (const co of c.corequisites) {
      const coKey = normalizeCode(co);
      const list = listedBy.get(coKey);
      if (list) list.push(c);
      else listedBy.set(coKey, [c]);
    }
  }

  const result: Course[] = [];
  const seen = new Set<string>();
  const add = (c: Course) => {
    const key = normalizeCode(c.code);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(c);
  };
  selected.forEach(add);

  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    for (const co of current.corequisites) {
      const target = byCode.get(normalizeCode(co));
      if (target) add(target);
    }
    for (const lister of listedBy.get(normalizeCode(current.code)) ?? []) add(lister);
  }
  return result;
}

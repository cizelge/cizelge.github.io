// Kayıt günü yedekleri: seçili programda bir şube dolarsa, öteki derslere dokunmadan geçilebilecek şubeler.
// Saf TypeScript; React yok.
import type { GenerateInput, SectionRef } from "../engine";
import { DEFAULT_EARLY_THRESHOLD, DEFAULT_LATE_THRESHOLD, computeMetrics, normalizeCode, parseTime, scoreMetrics } from "../engine";
import type { TimeInterval } from "../engine";
import { DAY_NAMES, DAY_SHORT } from "../days";
import { personName } from "../format";
import type { Course, Meeting, Section } from "../types";

export interface BackupOption {
  /** Değişen şubeler: tek şube ya da bir ders ile eş dersinin (lab) şubeleri birlikte. */
  sections: SectionRef[];
  /** Kısa Türkçe açıklamalar: "Salı 10:40 yerine Çarşamba 13:40". */
  changes: string[];
  /** Yeni programın puanı eksi şimdikinin; negatifse program iyileşir. */
  scoreDelta: number;
}

export interface CourseBackups {
  courseCode: string;
  chosen: string;
  locked: boolean;
  /** Seçili şubeyle aynı gün ve saatlerde ders yapan şubeler. */
  sameTime: Section[];
  /** Saati değişen yedekler, haftayı en az bozandan başlayarak. */
  other: BackupOption[];
  none: boolean;
  /** Dersin tek şubesi var: yedek zaten olamaz (uyarı değil, bilgi). */
  singleSection: boolean;
  /** Programdaki eş dersler (CS 201 ↔ CS 201L). */
  partners: string[];
}

export interface BackupOptions {
  /** Ders başına en fazla kaç "başka saatte" yedeği tutulur. Varsayılan 6. */
  maxOther?: number;
}

type Input = Pick<GenerateInput, "freeDays" | "excluded" | "locked"> &
  Partial<Pick<GenerateInput, "weights" | "earlyThreshold" | "lateThreshold">>;

interface Picked {
  course: Course;
  section: Section;
}

const timesKey = (meetings: readonly Meeting[]) =>
  meetings
    .map((m) => `${m.day} ${m.start} ${m.end}`)
    .sort()
    .join(",");

const intervalsOf = (meetings: readonly Meeting[]): TimeInterval[] =>
  meetings.map((m) => ({ day: m.day, start: parseTime(m.start), end: parseTime(m.end) }));

function overlaps(a: readonly TimeInterval[], b: readonly TimeInterval[]): boolean {
  for (const x of a) for (const y of b) if (x.day === y.day && x.start < y.end && y.start < x.end) return true;
  return false;
}

const byTime = (a: Meeting, b: Meeting) => a.day - b.day || parseTime(a.start) - parseTime(b.start);
const at = (m: Meeting) => `${DAY_NAMES[m.day]} ${m.start}`;

/** Eski ve yeni şubenin saat farkı: "Salı 10:40 yerine Çarşamba 13:40". */
export function describeChange(from: Section, to: Section): string[] {
  const toKeys = new Set(to.meetings.map((m) => timesKey([m])));
  const fromKeys = new Set(from.meetings.map((m) => timesKey([m])));
  const removed = from.meetings.filter((m) => !toKeys.has(timesKey([m]))).sort(byTime);
  const added = to.meetings.filter((m) => !fromKeys.has(timesKey([m]))).sort(byTime);
  const out: string[] = [];
  const n = Math.min(removed.length, added.length);
  for (let i = 0; i < n; i++) out.push(`${at(removed[i])} yerine ${at(added[i])}`);
  for (const m of removed.slice(n)) out.push(`${at(m)} dersi kalkar`);
  for (const m of added.slice(n)) out.push(`${at(m)} eklenir`);
  return out;
}

/** Programdaki her ders için dolarsa geçilebilecek yedek şubeler. */
export function backupSections(
  input: Input,
  current: { sections: readonly SectionRef[] },
  courses: ReadonlyMap<string, Course>,
  opts: BackupOptions = {},
): CourseBackups[] {
  const maxOther = opts.maxOther ?? 6;
  const freeDays = new Set<number>(input.freeDays);
  const excluded = new Set(input.excluded.map((e) => `${normalizeCode(e.courseCode)} ${e.sectionId}`));
  const lockedCodes = new Set(Object.keys(input.locked).map(normalizeCode));
  const thresholds = {
    early: parseTime(input.earlyThreshold ?? DEFAULT_EARLY_THRESHOLD),
    late: parseTime(input.lateThreshold ?? DEFAULT_LATE_THRESHOLD),
  };
  const weights = input.weights;

  const picked: Picked[] = [];
  for (const ref of current.sections) {
    const course = courses.get(ref.courseCode);
    const section = course?.sections.find((s) => s.id === ref.sectionId);
    if (course && section) picked.push({ course, section });
  }

  const intervalCache = new Map<Section, TimeInterval[]>();
  const iv = (s: Section) => {
    let v = intervalCache.get(s);
    if (!v) intervalCache.set(s, (v = intervalsOf(s.meetings)));
    return v;
  };
  const usable = (course: Course, s: Section) =>
    !excluded.has(`${normalizeCode(course.code)} ${s.id}`) && !s.meetings.some((m) => freeDays.has(m.day));

  const scoreOf = (sections: readonly Section[]) =>
    weights ? scoreMetrics(computeMetrics(sections.flatMap(iv), thresholds), weights) : 0;
  const baseScore = scoreOf(picked.map((p) => p.section));

  const codeKey = picked.map((p) => normalizeCode(p.course.code));
  const partnersOf = (i: number): number[] => {
    const me = picked[i].course;
    const mine = new Set(me.corequisites.map(normalizeCode));
    return picked
      .map((p, j) => j)
      .filter((j) => j !== i && (mine.has(codeKey[j]) || picked[j].course.corequisites.some((c) => normalizeCode(c) === codeKey[i])));
  };

  return picked.map(({ course, section: chosen }, i) => {
    const partners = partnersOf(i);
    const othersExcept = (skip: ReadonlySet<number>) =>
      picked.filter((_, j) => j !== i && !skip.has(j)).flatMap((p) => iv(p.section));
    const busy = othersExcept(new Set());
    const chosenTimes = timesKey(chosen.meetings);

    const sameTime: Section[] = [];
    const other: (BackupOption & { moved: number })[] = [];
    const candidates = course.sections.filter((s) => s.id !== chosen.id && usable(course, s));

    const scheduleWith = (replace: ReadonlyMap<number, Section>) =>
      picked.map((p, j) => (j === i ? replace.get(i)! : (replace.get(j) ?? p.section)));

    for (const s of candidates) {
      if (timesKey(s.meetings) === chosenTimes) {
        sameTime.push(s);
        continue;
      }
      if (!overlaps(iv(s), busy)) {
        const changes = describeChange(chosen, s);
        other.push({
          sections: [{ courseCode: course.code, sectionId: s.id }],
          changes,
          scoreDelta: scoreOf(scheduleWith(new Map([[i, s]]))) - baseScore,
          moved: changes.length,
        });
        continue;
      }
      // Tek başına sığmıyor: eş dersin şubesi de değişirse sığıyor mu?
      for (const j of partners) {
        const partner = picked[j];
        const rest = othersExcept(new Set([j]));
        if (overlaps(iv(s), rest)) continue;
        for (const p of partner.course.sections) {
          if (p.id === partner.section.id || !usable(partner.course, p)) continue;
          if (overlaps(iv(p), rest) || overlaps(iv(p), iv(s))) continue;
          const own = describeChange(chosen, s);
          const theirs = describeChange(partner.section, p);
          other.push({
            sections: [
              { courseCode: course.code, sectionId: s.id },
              { courseCode: partner.course.code, sectionId: p.id },
            ],
            changes: [...own.map((c) => `${course.code}: ${c}`), ...theirs.map((c) => `${partner.course.code}: ${c}`)],
            scoreDelta: scoreOf(scheduleWith(new Map([[i, s], [j, p]]))) - baseScore,
            moved: own.length + theirs.length,
          });
        }
      }
    }

    other.sort(
      (a, b) =>
        a.sections.length - b.sections.length ||
        a.scoreDelta - b.scoreDelta ||
        a.moved - b.moved ||
        refKey(a.sections).localeCompare(refKey(b.sections), "tr"),
    );

    const kept = other.slice(0, maxOther).map(({ sections, changes, scoreDelta }) => ({ sections, changes, scoreDelta }));
    return {
      courseCode: course.code,
      chosen: chosen.id,
      locked: lockedCodes.has(codeKey[i]),
      sameTime,
      other: kept,
      none: sameTime.length === 0 && kept.length === 0,
      singleSection: course.sections.length === 1,
      partners: partners.map((j) => picked[j].course.code),
    };
  });
}

const refKey = (refs: readonly SectionRef[]) => refs.map((r) => `${r.courseCode} ${r.sectionId}`).join("|");

export interface RegistrationStep {
  backups: CourseBackups;
  reason: string;
}

const backupCount = (b: CourseBackups) => b.sameTime.length + b.other.length;

function ownReason(b: CourseBackups): string {
  const n = backupCount(b);
  if (n === 0 && b.singleSection) return "tek şubesi var, önce bunu al";
  if (n === 0) return "yedeği yok, önce bunu al";
  if (n === 1) return "tek yedeği var";
  if (b.sameTime.length > 0) return "aynı saatte yedeği var";
  return "yedekleri başka saatte";
}

/** Önerilen kayıt sırası: yedeği en az olan başta, eş dersler yan yana. */
export function registrationOrder(result: readonly CourseBackups[]): RegistrationStep[] {
  const sorted = result
    .map((b, index) => ({ b, index }))
    .sort((x, y) => backupCount(x.b) - backupCount(y.b) || x.index - y.index)
    .map((x) => x.b);
  const byCode = new Map(result.map((b) => [normalizeCode(b.courseCode), b]));
  const placed = new Set<CourseBackups>();
  const out: RegistrationStep[] = [];
  for (const b of sorted) {
    if (placed.has(b)) continue;
    placed.add(b);
    out.push({ backups: b, reason: ownReason(b) });
    // Eşleri (ve onların eşlerini) hemen arkasına koy.
    const queue = [b];
    while (queue.length > 0) {
      const lead = queue.shift()!;
      for (const code of lead.partners) {
        const partner = byCode.get(normalizeCode(code));
        if (!partner || placed.has(partner)) continue;
        placed.add(partner);
        out.push({ backups: partner, reason: `${ownReason(partner)}, ${lead.courseCode} ile birlikte al` });
        queue.push(partner);
      }
    }
  }
  return out;
}

function sectionOf(courses: ReadonlyMap<string, Course>, ref: SectionRef): Section | undefined {
  return courses.get(ref.courseCode)?.sections.find((s) => s.id === ref.sectionId);
}

/** Bir dersin yeni saatleri kısaca: "Çar 13:40, Cum 10:40". */
export function shortTimes(section: Section | undefined): string {
  if (!section) return "";
  const seen = new Set<string>();
  for (const m of [...section.meetings].sort(byTime)) seen.add(`${DAY_SHORT[m.day]} ${m.start}`);
  return [...seen].join(", ");
}

/** Başka saatteki bir yedeğin etiketi: "D (Çar 13:40)" ya da "B + CS 201L B1 (Çar 13:40)". */
export function optionLabel(option: BackupOption, courses: ReadonlyMap<string, Course>): string {
  const [own, ...rest] = option.sections;
  const head = [own.sectionId, ...rest.map((r) => `${r.courseCode} ${r.sectionId}`)].join(" + ");
  const times = shortTimes(sectionOf(courses, own));
  return times ? `${head} (${times})` : head;
}

export function instructorsOf(courses: ReadonlyMap<string, Course>, ref: SectionRef): string {
  return (sectionOf(courses, ref)?.instructors ?? []).map(personName).join(", ");
}

/** Kopyalanacak düz metin. */
export function registrationText(
  order: readonly RegistrationStep[],
  courses: ReadonlyMap<string, Course>,
  termLabel?: string,
): string {
  const lines = [termLabel ? `Kayıt günü planı, ${termLabel}` : "Kayıt günü planı", ""];
  order.forEach(({ backups: b, reason }, k) => {
    const who = instructorsOf(courses, { courseCode: b.courseCode, sectionId: b.chosen });
    const labels = [...b.sameTime.map((s) => s.id), ...b.other.map((o) => optionLabel(o, courses))];
    const backup = labels.length > 0 ? `yedek: ${labels.join(", ")}` : "yedek yok";
    lines.push(`${k + 1}. ${b.courseCode} ${b.chosen}${who ? ` (${who})` : ""}, ${backup} (${reason})`);
  });
  return lines.join("\n");
}

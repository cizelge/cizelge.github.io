import type { Course } from "@/lib/types";
import type { Day, RankedSchedule } from "@/lib/engine";
import { parseTime } from "@/lib/engine";
import { formatGap } from "@/lib/format";
import { placeMeetings, timeRange } from "./placed";

export { formatGap };

export interface ScheduleGroup {
  /** Gruptaki ilk (en iyi) programın `schedules` içindeki yeri. */
  first: number;
  /** Aynı haftalık düzene sahip programların yerleri. */
  members: number[];
}

/**
 * Haftalık düzeni birebir aynı olan programları gruplar. Aynı saatte açılan iki şube
 * (ör. CS 201 A ve B) ayrı programlar üretir ama çizelgede aynı görünür.
 */
export function groupSchedules(schedules: readonly RankedSchedule[], courses: ReadonlyMap<string, Course>): ScheduleGroup[] {
  const bySignature = new Map<string, ScheduleGroup>();
  schedules.forEach((s, i) => {
    const signature = placeMeetings(s.sections, courses, () => 0)
      .map((m) => `${m.courseCode}|${m.day}|${m.start}|${m.end}`)
      .sort()
      .join(";");
    const group = bySignature.get(signature);
    if (group) group.members.push(i);
    else bySignature.set(signature, { first: i, members: [i] });
  });
  return [...bySignature.values()];
}

interface Props {
  schedules: RankedSchedule[];
  groups: ScheduleGroup[];
  selected: number;
  onSelect: (index: number) => void;
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
  /** Haritadaki gün sütunları (WeekGrid ile aynı liste). */
  days: Day[];
}

export function ScheduleStrip({ schedules, groups, selected, onSelect, courses, colorOf, days }: Props) {
  const cols = days.length;
  const all = groups.flatMap((g) => placeMeetings(schedules[g.first].sections, courses, colorOf));
  const range = timeRange(all);
  const span = range.end - range.start;

  return (
    <div className="strip" role="group" aria-label="Haftalık düzenler, en uygun olan başta">
      {groups.map((g, rank) => {
        const s = schedules[g.first];
        const meetings = placeMeetings(s.sections, courses, colorOf);
        const hours = s.summary.earliestStart && s.summary.latestEnd ? `${s.summary.earliestStart}–${s.summary.latestEnd}` : "";
        const variants = g.members.length - 1;
        return (
          <button
            key={g.first}
            type="button"
            className="mini"
            aria-pressed={g.members.includes(selected)}
            onClick={() => onSelect(g.first)}
            aria-label={`${rank + 1}. program: ${s.summary.days} gün, ${formatGap(s.summary.gapMinutes)}${hours ? `, ${hours}` : ""}${variants ? `, aynı saatlerde ${variants} şube seçeneği daha` : ""}`}
          >
            <span className="mini-head">
              <span className="mini-rank num">{rank + 1}</span>
              <span className="mini-days num">{s.summary.days} gün</span>
            </span>
            <span className="mini-map" style={{ "--cols": cols } as React.CSSProperties} aria-hidden="true">
              {days.map((d) => (
                <span key={d} className="mini-day">
                  {meetings
                    .filter((m) => m.day === d)
                    .map((m) => (
                      <span
                        key={`${m.courseCode}${m.start}`}
                        className={`mini-block hl-${m.color}`}
                        style={{
                          top: `${((parseTime(m.start) - range.start) / span) * 100}%`,
                          height: `${((parseTime(m.end) - parseTime(m.start)) / span) * 100}%`,
                        }}
                      />
                    ))}
                </span>
              ))}
            </span>
            <span className="mini-meta num">
              <span>{formatGap(s.summary.gapMinutes)}</span>
              {hours && <span>{hours}</span>}
              {variants > 0 && <span className="mini-variants">+{variants} şube seçeneği</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

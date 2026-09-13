import type { Course } from "@/lib/types";
import type { Day, RankedSchedule } from "@/lib/engine";
import { parseTime } from "@/lib/engine";
import { placeMeetings, timeRange } from "./placed";

interface Props {
  schedules: RankedSchedule[];
  selected: number;
  onSelect: (index: number) => void;
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
  /** Haritadaki gün sütunları (WeekGrid ile aynı liste). */
  days: Day[];
}

export function formatGap(minutes: number) {
  if (minutes === 0) return "boşluk yok";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} sa` : "", m ? `${m} dk` : ""].filter(Boolean).join(" ") + " boşluk";
}

export function ScheduleStrip({ schedules, selected, onSelect, courses, colorOf, days }: Props) {
  const cols = days.length;
  const all = schedules.flatMap((s) => placeMeetings(s.sections, courses, colorOf));
  const range = timeRange(all);
  const span = range.end - range.start;

  return (
    <div className="strip" role="group" aria-label="Programlar, en uygun olan başta">
      {schedules.map((s, i) => {
        const meetings = placeMeetings(s.sections, courses, colorOf);
        return (
          <button
            key={s.sections.map((r) => `${r.courseCode}${r.sectionId}`).join("|")}
            type="button"
            className="mini"
            aria-pressed={i === selected}
            onClick={() => onSelect(i)}
            aria-label={`${i + 1}. program: ${s.summary.days} gün, ${formatGap(s.summary.gapMinutes)}`}
          >
            <span className="mini-rank num">{i + 1}.</span>
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
            <span className="mini-meta">
              {s.summary.days} gün
              <br />
              {formatGap(s.summary.gapMinutes)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

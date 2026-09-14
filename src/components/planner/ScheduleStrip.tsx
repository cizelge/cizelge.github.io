import type { Course } from "@/lib/types";
import type { Day } from "@/lib/engine";
import { parseTime } from "@/lib/engine";
import { formatGap } from "@/lib/format";
import type { LayoutCard } from "@/lib/planner/schedule.worker";
import { placeMeetings, timeRange } from "./placed";

export { formatGap };

interface Props {
  layouts: LayoutCard[];
  /** Bütün düzenlerin sayısı; kartlar bundan azsa sonda "daha fazla" düğmesi çıkar. */
  layoutCount: number;
  selected: number;
  onSelect: (index: number) => void;
  onMore: () => void;
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
  /** Haritadaki gün sütunları (WeekGrid ile aynı liste). */
  days: Day[];
}

export function ScheduleStrip({ layouts, layoutCount, selected, onSelect, onMore, courses, colorOf, days }: Props) {
  const cols = days.length;
  const all = layouts.flatMap((l) => placeMeetings(l.best.sections, courses, colorOf));
  const range = timeRange(all);
  const span = range.end - range.start;
  const remaining = layoutCount - layouts.length;

  return (
    <div className="strip" role="group" aria-label="Haftalık düzenler, en uygun olan başta">
      {layouts.map((l, rank) => {
        const s = l.best;
        const meetings = placeMeetings(s.sections, courses, colorOf);
        const hours = s.summary.earliestStart && s.summary.latestEnd ? `${s.summary.earliestStart}–${s.summary.latestEnd}` : "";
        return (
          <button
            key={rank}
            type="button"
            className="mini"
            aria-pressed={rank === selected}
            onClick={() => onSelect(rank)}
            aria-label={`${rank + 1}. program: ${s.summary.days} gün, ${formatGap(s.summary.gapMinutes)}${hours ? `, ${hours}` : ""}${l.size > 1 ? `, ${l.size} şube seçeneği` : ""}`}
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
              {l.size > 1 && <span className="mini-variants">{l.size.toLocaleString("tr-TR")} şube seçeneği</span>}
            </span>
          </button>
        );
      })}
      {remaining > 0 && (
        <button type="button" className="mini mini-more" onClick={onMore}>
          <span>Sonraki {Math.min(50, remaining)} düzeni göster</span>
          <span className="hint num">{remaining.toLocaleString("tr-TR")} düzen daha var</span>
        </button>
      )}
    </div>
  );
}

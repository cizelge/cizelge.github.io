import Link from "next/link";
import type { Day } from "@/lib/engine";
import { parseTime } from "@/lib/engine";
import { DAY_NAMES, DAY_SHORT } from "@/lib/days";
import { personName } from "@/lib/format";
import { assignLanes, type PlacedMeeting } from "./placed";

interface Props {
  meetings: PlacedMeeting[];
  freeDays: Day[];
  /** Tablonun kapsayacağı saat aralığı (dakika). */
  range: { start: number; end: number };
  /** Gösterilecek sütunlar; hafta sonu yalnızca ders varsa eklenir (bkz. `visibleDays`). */
  days: Day[];
  empty?: React.ReactNode;
  /** Blokta yalnızca ders kodu (ana sayfadaki küçük çizim için). */
  compact?: boolean;
  /** Şube harfinin yerine konacak öğe (planlayıcıda şube değiştirme menüsü); null dönerse düz harf yazılır. */
  renderSection?: (m: PlacedMeeting) => React.ReactNode;
  /** Ders kutusunun bağlanacağı sayfa (ders sayfası); null ya da verilmezse kutu bağlantı değildir. */
  hrefOf?: (m: PlacedMeeting) => string | null;
  /** Hoca adının yerine konacak öğe (puanlı bağlantı); null dönerse düz ad yazılır. */
  renderInstructor?: (m: PlacedMeeting) => React.ReactNode;
}

export function WeekGrid({ meetings, freeDays, range, days, empty, compact = false, renderSection, renderInstructor, hrefOf }: Props) {
  const startHour = Math.floor(range.start / 60);
  const endHour = Math.ceil(range.end / 60);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const pxPerMin = `calc(var(--hour-h) / 60)`;
  const height = `calc(var(--hour-h) * ${endHour - startHour})`;
  const at = (min: number) => `calc(${pxPerMin} * ${min - startHour * 60})`;
  const lanes = assignLanes(meetings);

  return (
    <div className={`week-wrap${compact ? " is-compact" : ""}`}>
      <div className="week" style={{ "--cols": days.length } as React.CSSProperties} role="table" aria-label="Haftalık program">
        <div role="row" style={{ display: "contents" }}>
          <div className="week-corner" role="columnheader" aria-label="Saat" />
          {days.map((d) => (
            <div key={d} role="columnheader" className={`week-dayname${freeDays.includes(d) ? " is-free" : ""}`}>
              <span aria-hidden="true" className="sm:hidden">{DAY_SHORT[d]}</span>
              <span className="max-sm:sr-only">{DAY_NAMES[d]}</span>
              {freeDays.includes(d) && <span className="sr-only"> (boş gün)</span>}
            </div>
          ))}
        </div>
        <div role="row" style={{ display: "contents" }}>
          <div className="week-hours num" style={{ height }} aria-hidden="true">
            {(compact ? hours.slice(1) : hours).map((h) => (
              <span key={h} className={`week-hour${h === startHour ? " is-first" : ""}`} style={{ top: at(h * 60) }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} role="cell" className={`week-col${freeDays.includes(d) ? " is-free" : ""}`} style={{ height }}>
              {meetings.map((m, i) => {
                if (m.day !== d) return null;
                const s = parseTime(m.start);
                const e = parseTime(m.end);
                const { lane, lanes: count } = lanes[i];
                return (
                  <div
                    key={`${m.courseCode}-${m.sectionId}-${m.start}-${i}`}
                    className={`block hl-${m.color}${count > 1 ? " is-split" : ""}`}
                    style={
                      {
                        top: at(s),
                        height: `calc(${pxPerMin} * ${e - s})`,
                        "--lane": lane,
                        "--lanes": count,
                      } as React.CSSProperties
                    }
                    title={`${m.courseCode} ${m.sectionId}, ${m.start}–${m.end}${m.room ? `, ${m.room}` : ""}${m.instructor ? `, ${personName(m.instructor)}` : ""}`}
                  >
                    {(() => {
                      const href = hrefOf?.(m);
                      // Bütün kutuyu kaplayan bağlantı; şube menüsü düğmesi üstte kalır (iç içe etkileşimli öğe olmasın diye kardeş).
                      return href ? (
                        <Link
                          href={href}
                          className="block-link"
                          aria-label={`${m.courseCode} ders sayfası: şubeler, hocalar, ön şartlar`}
                        />
                      ) : null;
                    })()}
                    <span className="block-code">
                      {m.courseCode}{" "}
                      {renderSection?.(m) ?? (m.sectionId && <span className="block-section">{m.sectionId}</span>)}
                    </span>
                    {!compact && (
                      <>
                        <span className="block-sub num">
                          {m.start}–{m.end}
                        </span>
                        {m.room && <span className="block-sub block-room">{m.room}</span>}
                        {m.instructor && (
                          <span className="block-sub">{renderInstructor?.(m) ?? personName(m.instructor)}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {empty && <div className="week-empty">{empty}</div>}
    </div>
  );
}

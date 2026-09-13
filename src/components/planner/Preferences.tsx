import type { Day, Weights } from "@/lib/engine";
import { DAY_NAMES } from "@/lib/days";
import { PRESETS, WEIGHT_KEYS } from "@/lib/planner/state";

const DAYS: { day: Day; label: string }[] = [
  { day: 1, label: "Pzt" },
  { day: 2, label: "Sal" },
  { day: 3, label: "Çar" },
  { day: 4, label: "Per" },
  { day: 5, label: "Cum" },
];

const LABELS: Record<(typeof WEIGHT_KEYS)[number], string> = {
  fewDays: "Kampüse az gün gel",
  fewGaps: "Dersler arası boşluk az olsun",
  lunchBreak: "Öğle arası kalsın",
  noEarly: "Sabah erken ders olmasın",
  noLate: "Akşam geç ders olmasın",
};
const LEVELS = ["Önemsiz", "Az", "Önemli", "Çok önemli"];

interface Props {
  freeDays: Day[];
  onFreeDays: (days: Day[]) => void;
  weights: Weights;
  onWeights: (w: Weights) => void;
}

/**
 * Programların üstündeki ayar çubuğu: boş günler ve sıralama önceliği.
 * Etkisi hemen altındaki programlarda görüldüğü için sonuçların yanında durur.
 */
export function Tuning({ freeDays, onFreeDays, weights, onWeights }: Props) {
  const activePreset = PRESETS.find((p) => WEIGHT_KEYS.every((k) => p.weights[k] === weights[k]))?.id;
  return (
    <section className="tuning" aria-label="Program ayarları">
      <div className="tuning-group" role="group" aria-labelledby="bos-gunler">
        <span className="tuning-label" id="bos-gunler">
          Boş gün
        </span>
        <div className="chips">
          {DAYS.map(({ day, label }) => {
            const on = freeDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                className="chip chip-day"
                aria-pressed={on}
                aria-label={`${DAY_NAMES[day]} boş gün`}
                onClick={() => onFreeDays(on ? freeDays.filter((d) => d !== day) : [...freeDays, day])}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="tuning-group" role="group" aria-labelledby="oncelik">
        <span className="tuning-label" id="oncelik">
          Öncelik
        </span>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={activePreset === p.id} onClick={() => onWeights(p.weights)}>
              {p.label}
            </button>
          ))}
          <details className="tuning-more">
            <summary className="chip">Ayrıntılı ayar</summary>
            <div className="tuning-panel">
              {WEIGHT_KEYS.map((k) => (
                <label key={k} className="pref">
                  <span className="pref-label">{LABELS[k]}</span>
                  <span className="pref-value">{LEVELS[weights[k]]}</span>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={weights[k]}
                    aria-valuetext={LEVELS[weights[k]]}
                    onChange={(e) => onWeights({ ...weights, [k]: Number(e.target.value) })}
                  />
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

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
// Boş gün seçimi bilerek yalnızca Pazartesi–Cuma.
const DAY_FULL = DAY_NAMES;

const LABELS: Record<(typeof WEIGHT_KEYS)[number], string> = {
  fewDays: "Kampüse az gün gel",
  fewGaps: "Dersler arası boşluk az olsun",
  lunchBreak: "Öğle arası kalsın",
  noEarly: "Sabah erken ders olmasın",
  noLate: "Akşam geç ders olmasın",
};
const LEVELS = ["Önemsiz", "Az", "Önemli", "Çok önemli"];

export function FreeDays({ value, onChange }: { value: Day[]; onChange: (days: Day[]) => void }) {
  return (
    <section aria-labelledby="bos-gunler">
      <h2 className="group-title" id="bos-gunler">
        Boş günler
      </h2>
      <p className="hint" style={{ marginBottom: "0.6rem" }}>
        Seçtiğin günlere hiç ders konmaz.
      </p>
      <div className="day-toggles">
        {DAYS.map(({ day, label }) => {
          const on = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              className="day-toggle"
              aria-pressed={on}
              aria-label={DAY_FULL[day]}
              onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day])}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function Priorities({ value, onChange }: { value: Weights; onChange: (w: Weights) => void }) {
  const activePreset = PRESETS.find((p) => WEIGHT_KEYS.every((k) => p.weights[k] === value[k]))?.id;
  return (
    <section aria-labelledby="oncelikler">
      <h2 className="group-title" id="oncelikler">
        Neye göre sıralansın?
      </h2>
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="day-toggle"
            aria-pressed={activePreset === p.id}
            style={activePreset === p.id ? { textDecoration: "none" } : undefined}
            onClick={() => onChange(p.weights)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {WEIGHT_KEYS.map((k) => (
        <label key={k} className="pref">
          <span className="pref-label">{LABELS[k]}</span>
          <span className="pref-value">{LEVELS[value[k]]}</span>
          <input
            type="range"
            min={0}
            max={3}
            step={1}
            value={value[k]}
            aria-valuetext={LEVELS[value[k]]}
            onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })}
          />
        </label>
      ))}
    </section>
  );
}

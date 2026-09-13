import type { Course } from "@/lib/types";
import type { SectionRef } from "@/lib/engine";
import { DAY_SHORT } from "@/lib/days";

interface Props {
  cart: readonly string[];
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
  locked: Record<string, string>;
  excluded: readonly SectionRef[];
  onRemove: (code: string) => void;
  onLock: (code: string, sectionId: string | null) => void;
  onToggleExclude: (ref: SectionRef) => void;
}

export function Cart({ cart, courses, colorOf, locked, excluded, onRemove, onLock, onToggleExclude }: Props) {
  const ects = cart.reduce((sum, code) => sum + (courses.get(code)?.ects ?? 0), 0);

  return (
    <section aria-labelledby="sepet">
      <h2 className="group-title" id="sepet">
        Sepetin
        <span className="aside num">{cart.length ? `${ects} AKTS` : ""}</span>
      </h2>
      {cart.length === 0 ? (
        <p className="hint">Eklediğin dersler burada, çizelgedeki renkleriyle görünür.</p>
      ) : (
        <ul className="cart">
          {cart.map((code) => {
            const course = courses.get(code);
            if (!course) return null;
            const lock = locked[code] ?? "";
            return (
              <li key={code} className={`cart-item hl-${colorOf(code)}`}>
                <div className="cart-row">
                  <span>
                    <span className="cart-code num">{code}</span>{" "}
                    <span className="cart-title">{course.title}</span>
                  </span>
                  <button type="button" className="btn btn-small btn-quiet" onClick={() => onRemove(code)} aria-label={`${code} çıkar`}>
                    Çıkar
                  </button>
                </div>
                {course.sections.length > 1 && (
                  <details className="cart-details">
                    <summary>{lock ? `Yalnızca ${lock} şubesi` : "Şube seçimi"}</summary>
                    <label>
                      Şube
                      <select className="select" value={lock} onChange={(e) => onLock(code, e.target.value || null)}>
                        <option value="">Farketmez</option>
                        {course.sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.id}
                            {s.instructors[0] ? `, ${s.instructors[0]}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!lock &&
                      course.sections.map((s) => {
                        const ex = excluded.some((e) => e.courseCode === code && e.sectionId === s.id);
                        return (
                          <label key={s.id}>
                            <input type="checkbox" checked={!ex} onChange={() => onToggleExclude({ courseCode: code, sectionId: s.id })} />
                            <span>
                              {s.id} şubesi
                              <span className="hint">
                                {" "}
                                {s.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}`).join(", ")}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

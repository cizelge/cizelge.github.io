import type { Course } from "@/lib/types";
import type { SectionRef } from "@/lib/engine";
import { DAY_SHORT } from "@/lib/days";
import { personName } from "@/lib/format";

interface Props {
  cart: readonly string[];
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
  locked: Record<string, string>;
  excluded: readonly SectionRef[];
  /** Seçili programda her dersin şubesi (program yoksa boş). */
  chosen: Record<string, string>;
  onRemove: (code: string) => void;
  onLock: (code: string, sectionId: string | null) => void;
  onToggleExclude: (ref: SectionRef) => void;
}

export function Cart({ cart, courses, colorOf, locked, excluded, chosen, onRemove, onLock, onToggleExclude }: Props) {
  const ects = cart.reduce((sum, code) => sum + (courses.get(code)?.ects ?? 0), 0);

  return (
    <section aria-labelledby="sepet">
      <h2 className="group-title" id="sepet">
        Sepetin
        <span className="aside num">{cart.length ? `${cart.length} ders, ${ects} AKTS` : ""}</span>
      </h2>
      {cart.length === 0 ? (
        <p className="hint">Eklediğin dersler burada, çizelgedeki renkleriyle görünür.</p>
      ) : (
        <ul className="cart">
          {cart.map((code) => {
            const course = courses.get(code);
            if (!course) return null;
            const lock = locked[code] ?? "";
            const many = course.sections.length > 1;
            const shown = lock || chosen[code] || "";
            const badge = lock ? `Yalnız ${lock}` : shown ? `Şube ${shown}` : `${course.sections.length} şube`;
            const name = (
              <span className="cart-name">
                <span className="cart-code num">{code}</span>
                <span className="cart-title">{course.title}</span>
              </span>
            );
            return (
              <li key={code} className={`cart-item hl-${colorOf(code)}`}>
                {!many ? (
                  <div className="cart-row">
                    {name}
                    {shown && <span className="cart-badge">{badge}</span>}
                  </div>
                ) : (
                <details className="cart-details">
                  <summary className="cart-row">
                    {name}
                    <span className={`cart-badge${lock ? " is-locked" : ""}`}>
                      {badge}
                      <span aria-hidden="true" className="cart-caret" />
                    </span>
                  </summary>
                  {(
                    <div className="cart-panel">
                      <label className="cart-lock">
                        <span>Şube</span>
                        <select className="select" value={lock} onChange={(e) => onLock(code, e.target.value || null)}>
                          <option value="">Farketmez, en iyisini seç</option>
                          {course.sections.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.id}
                              {s.instructors[0] ? `, ${personName(s.instructors[0])}` : ""}
                              {s.capacity ? `, kota ${s.capacity}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!lock && (
                        <fieldset className="cart-sections">
                          <legend className="hint">Kullanılabilecek şubeler</legend>
                          {course.sections.map((s) => {
                            const ex = excluded.some((e) => e.courseCode === code && e.sectionId === s.id);
                            return (
                              <label key={s.id}>
                                <input type="checkbox" checked={!ex} onChange={() => onToggleExclude({ courseCode: code, sectionId: s.id })} />
                                <span className="num">
                                  <b>{s.id}</b> {s.meetings.map((m) => `${DAY_SHORT[m.day]} ${m.start}`).join(", ") || "saat yok"}
                                </span>
                              </label>
                            );
                          })}
                        </fieldset>
                      )}
                    </div>
                  )}
                </details>
                )}
                <button type="button" className="cart-remove" onClick={() => onRemove(code)} aria-label={`${code} dersini sepetten çıkar`}>
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

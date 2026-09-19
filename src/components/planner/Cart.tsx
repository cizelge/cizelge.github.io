import type { Course } from "@/lib/types";
import type { SectionRef } from "@/lib/engine";
import { DAY_SHORT } from "@/lib/days";

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
  /** Şube listesini büyük panelde aç. */
  onSwap: (code: string) => void;
  onToggleExclude: (ref: SectionRef) => void;
  /** Bütün dersleri sepetten çıkarır. */
  onClear: () => void;
  /** Son boşaltmayı geri alır; geri alınacak bir şey yoksa verilmez. */
  onUndoClear?: () => void;
}

export function Cart({ cart, courses, colorOf, locked, excluded, chosen, onRemove, onLock, onSwap, onToggleExclude, onClear, onUndoClear }: Props) {
  const ects = cart.reduce((sum, code) => sum + (courses.get(code)?.ects ?? 0), 0);

  return (
    <section aria-labelledby="sepet">
      <h2 className="group-title" id="sepet">
        Sepetin
        <span className="aside num">{cart.length ? `${cart.length} ders, ${ects} AKTS` : ""}</span>
        {cart.length > 0 && (
          <button type="button" className="cart-clear" onClick={onClear} aria-label="Sepeti boşalt, bütün dersleri çıkar" title="Sepeti boşalt">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                d="M2.5 4h11M6.5 4V2.75h3V4M4 4l.7 9.25h6.6L12 4M6.6 6.5v4.5M9.4 6.5v4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </h2>
      {cart.length === 0 && onUndoClear ? (
        <p className="hint cart-undo" role="status">
          Sepet boşaltıldı.{" "}
          <button type="button" className="link-btn" onClick={onUndoClear}>
            Geri al
          </button>
        </p>
      ) : cart.length === 0 ? (
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
                      <button type="button" className="btn btn-small cart-swap" onClick={() => onSwap(code)}>
                        Şubeleri gör ve değiştir
                      </button>
                      {lock && (
                        <button type="button" className="btn btn-small cart-swap" onClick={() => onLock(code, null)}>
                          Kilidi kaldır, en iyisini seç
                        </button>
                      )}
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

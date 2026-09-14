import type { NoSolutionReason, RelaxedConstraint, Suggestion } from "@/lib/engine";
import { DAY_NAMES as DAY } from "@/lib/days";

function reasonText(r: NoSolutionReason): string {
  switch (r.kind) {
    case "noEligibleSection": {
      const causes = new Set(r.blocked.map((b) => b.cause));
      if (r.blocked.length === 0) return `${r.courseCode} dersinin bu dönem şubesi yok.`;
      if (causes.size === 1 && causes.has("freeDay")) {
        return `${r.courseCode} dersinin bütün şubeleri boş gün seçtiğin günlerde.`;
      }
      return `${r.courseCode} için seçtiğin şube ayarlarına uyan şube kalmadı.`;
    }
    case "pairConflict":
      return `${r.courseCodes[0]} ile ${r.courseCodes[1]} dersinin bütün şubeleri çakışıyor, örneğin ${DAY[r.overlap.day]} ${r.overlap.start}–${r.overlap.end}.`;
    case "groupConflict":
      return `${r.courseCodes.join(", ")} derslerini aynı haftaya sığdıran bir şube birleşimi yok.`;
  }
}

function suggestionText(c: RelaxedConstraint): string {
  switch (c.kind) {
    case "freeDay":
      return `${DAY[c.day]} boş gün olmasın`;
    case "lock":
      return `${c.courseCode} şube kilidini kaldır`;
    case "exclusion":
      return `${c.courseCode} ${c.sectionId} şubesine izin ver`;
  }
}

/** "Cuma boş gün olmasın ve CS 101 şube kilidini kaldır" */
export function suggestionLabel(s: Pick<Suggestion, "constraints">): string {
  return s.constraints.map(suggestionText).join(" ve ");
}

interface Props {
  reason: NoSolutionReason | null;
  suggestions: Suggestion[];
  /** Önerideki bütün ayarları tek seferde gevşetir. */
  onApply: (constraints: RelaxedConstraint[]) => void;
}

export function NoSolution({ reason, suggestions, onApply }: Props) {
  const useful = suggestions.filter((s) => s.scheduleCount > 0);
  return (
    <div className="notice notice-danger" role="status">
      <h3>Bu derslerle çakışmasız program çıkmıyor</h3>
      {reason && <p>{reasonText(reason)}</p>}
      {useful.length > 0 ? (
        <>
          {useful.every((s) => s.constraints.length > 1) && (
            <p className="hint">Tek bir ayarı değiştirmek yetmiyor, ikisini birlikte değiştirmek işe yarar.</p>
          )}
          <ul>
            {useful.map((s) => (
              <li key={JSON.stringify(s.constraints)}>
                <button type="button" className="btn btn-small" onClick={() => onApply(s.constraints)}>
                  {suggestionLabel(s)}
                  <span className="hint num">
                    {s.scheduleCount}
                    {s.truncated ? "+" : ""} program
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="hint" style={{ marginTop: "0.4rem" }}>
          Bir ya da iki ayarı değiştirmek yetmiyor. Sepetten bir ders çıkarmayı dene.
        </p>
      )}
    </div>
  );
}

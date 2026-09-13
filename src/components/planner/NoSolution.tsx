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

interface Props {
  reason: NoSolutionReason | null;
  suggestions: Suggestion[];
  onApply: (c: RelaxedConstraint) => void;
}

export function NoSolution({ reason, suggestions, onApply }: Props) {
  const useful = suggestions.filter((s) => s.scheduleCount > 0);
  return (
    <div className="notice notice-danger" role="status">
      <h3>Bu derslerle çakışmasız program çıkmıyor</h3>
      {reason && <p>{reasonText(reason)}</p>}
      {useful.length > 0 ? (
        <ul>
          {useful.map((s) => (
            <li key={JSON.stringify(s.constraint)}>
              <button type="button" className="btn btn-small" onClick={() => onApply(s.constraint)}>
                {suggestionText(s.constraint)}
                <span className="hint num">
                  {s.scheduleCount}
                  {s.truncated ? "+" : ""} program
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hint" style={{ marginTop: "0.4rem" }}>
          Tek bir ayarı değiştirmek yetmiyor. Sepetten bir ders çıkarmayı dene.
        </p>
      )}
    </div>
  );
}

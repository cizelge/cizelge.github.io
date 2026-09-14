import type { PlanResult, ProgramProgress, RoadmapProgram } from "@/lib/roadmap/types";
import { KIND_HL, KIND_LABEL } from "./shared";

interface Props {
  programs: RoadmapProgram[];
  progress: ProgramProgress[];
  plan: PlanResult;
  /** Bütün programlarda kalan ders ve seçmeli sayısı. */
  remaining: number;
}

function remainingText(p: ProgramProgress): string {
  const parts: string[] = [];
  if (p.remainingCourses > 0) parts.push(`${p.remainingCourses} ders`);
  if (p.remainingElectives > 0) parts.push(`${p.remainingElectives} seçmeli`);
  return parts.length ? `${parts.join(", ")} kaldı` : "Hepsi tamam";
}

export function Summary({ programs, progress, plan, remaining }: Props) {
  const graduation =
    remaining === 0
      ? "Kalan ders yok"
      : plan.graduation ?? `Tahmin edilemedi, ${plan.unplaced.length} ders yerleşmedi`;

  return (
    <section aria-labelledby="rm-ozet" className="rm-summary">
      <div className="board-head">
        <h1 className="board-title" id="rm-ozet">
          Mezuniyet yol haritası
        </h1>
      </div>
      <dl className="facts">
        <div className="fact">
          <dt>Tahmini mezuniyet</dt>
          <dd className="num">{graduation}</dd>
        </div>
        <div className="fact">
          <dt>Kalan dönem</dt>
          <dd className="num">{plan.terms.length}</dd>
        </div>
      </dl>

      <ul className="rm-bars">
        {programs.map((p, i) => {
          const pr = progress[i];
          if (!pr) return null;
          const total = Math.max(pr.totalCredits, pr.passedCredits);
          const pct = total > 0 ? Math.round((pr.passedCredits / total) * 100) : 0;
          return (
            <li key={`${p.kind}:${p.id}`} className={`rm-bar-row hl-${KIND_HL[p.kind]}`}>
              <div className="rm-bar-head">
                <span className="rm-bar-name">
                  <span className="rm-bar-kind">{KIND_LABEL[p.kind]}</span> {p.name}
                </span>
                <span className="hint num">
                  {pr.passedCredits} / {pr.totalCredits} AKTS
                </span>
              </div>
              <div
                className="rm-bar"
                role="progressbar"
                aria-label={`${p.name} ilerlemesi, AKTS`}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={pr.passedCredits}
                aria-valuetext={`${pr.passedCredits} / ${pr.totalCredits} AKTS, yüzde ${pct}`}
              >
                <span className="rm-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <p className="hint">{remainingText(pr)}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

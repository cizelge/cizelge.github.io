import Link from "next/link";
import { useId } from "react";
import { academicYearLabel, parseTermLabel, SEASON_LABEL, termPath, type TermOption } from "@/lib/terms";

interface Props {
  schoolId: string;
  currentId: string;
  /** termOptions(): önce varsayılan dönemin yılının Güz, Bahar, Yaz'ı, sonra başka yılların dönemleri. */
  options: readonly TermOption[];
  /** Geçişte taşınacak paylaşım linki (termSwitchQuery), "?" olmadan. */
  query: string;
}

const SOON = "henüz yayınlanmadı";

function joinTr(items: string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} ve ${items.at(-1)}`;
}

/** Dönem seçici: akademik yıl ve Güz / Bahar / Yaz. Yayında olmayan dönemler seçilemez. */
export function TermSelect({ schoolId, currentId, options, query }: Props) {
  const id = useId();
  if (options.length === 0) return null;

  const year = options.slice(0, 3).map((o) => ({ ...o, info: parseTermLabel(o.label) }));
  const others = options.slice(3);
  const soon = year.filter((o) => !o.available);
  const listOnly = year.filter((o) => o.available && !o.hasTimes);
  const href = (o: TermOption) => `${termPath(schoolId, o)}${query ? `?${query}` : ""}`;

  return (
    <nav className="term-select" aria-labelledby={`${id}-t`}>
      <p className="term-year" id={`${id}-t`}>
        <span className="field-label">Dönem</span>
        <span className="num">{academicYearLabel(year[0].info.startYear)}</span>
      </p>
      <div className="term-options">
        {year.map((o) => {
          const name = SEASON_LABEL[o.info.season];
          return o.available ? (
            <Link
              key={o.id}
              href={href(o)}
              className="term-option"
              aria-current={o.id === currentId ? "page" : undefined}
              aria-label={o.label}
            >
              {name}
            </Link>
          ) : (
            <button
              key={o.id}
              type="button"
              className="term-option"
              aria-disabled="true"
              aria-label={o.label}
              aria-describedby={`${id}-soon`}
              title={`${name} ${SOON}`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {soon.length > 0 && (
        <p className="hint term-soon" id={`${id}-soon`}>
          {joinTr(soon.map((o) => SEASON_LABEL[o.info.season]))} {SOON}.
        </p>
      )}
      {listOnly.length > 0 && (
        <p className="hint term-others">
          {joinTr(listOnly.map((o) => SEASON_LABEL[o.info.season]))} için yalnızca açılacak dersler belli, saatler
          henüz açıklanmadı.
        </p>
      )}
      {others.length > 0 && (
        <p className="hint term-others">
          Diğer dönemler:{" "}
          {others.map((o, i) => (
            <span key={o.id}>
              {i > 0 && ", "}
              {o.id === currentId ? (
                <span aria-current="page">{o.label}</span>
              ) : (
                <Link className="link" href={href(o)}>
                  {o.label}
                </Link>
              )}
            </span>
          ))}
        </p>
      )}
    </nav>
  );
}

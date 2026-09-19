import Link from "next/link";
import { personName } from "@/lib/format";
import { instructorSlug } from "@/lib/ratings/instructors";

const fmt = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Çizelgedeki ders kutusunda hoca adı ve puanı; tıklayınca hocanın sayfasına gider. */
export function TeacherLink({ name, score }: { name: string; score: number | null }) {
  const label = personName(name);
  return (
    <Link
      href={`/ozyegin/hoca/${instructorSlug(name)}`}
      className="block-teacher"
      title={score === null ? `${label}: henüz puan yok, ilk puanı sen ver` : `${label}: 5 üzerinden ${fmt(score)}`}
    >
      <span className="block-teacher-name">{label}</span>
      <span className="block-star" data-empty={score === null}>
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
          <path
            d="M12 3.4l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.5l5.8-.8z"
            fill={score === null ? "none" : "currentColor"}
            stroke="currentColor"
            strokeWidth={score === null ? 1.6 : 0}
            strokeLinejoin="round"
          />
        </svg>
        {score !== null && <span className="num">{fmt(score)}</span>}
      </span>
    </Link>
  );
}

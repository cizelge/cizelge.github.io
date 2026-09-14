import type { Course } from "@/lib/types";
import type { RankedSchedule } from "@/lib/engine";
import { personName } from "@/lib/format";

interface Props {
  variants: RankedSchedule[];
  /** Düzendeki bütün seçeneklerin sayısı (liste kısaltılmış olabilir). */
  size: number;
  selected: number;
  onSelect: (index: number) => void;
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
}

/** Aynı haftalık düzeni veren şube (ve hoca) birleşimleri. Yalnızca seçenekler arasında değişen dersler yazılır. */
export function Variants({ variants, size, selected, onSelect, courses, colorOf }: Props) {
  if (variants.length < 2) return null;
  const codes = variants[0].sections.map((r) => r.courseCode);
  const differing = codes.filter((code, k) => variants.some((v) => v.sections[k].sectionId !== variants[0].sections[k].sectionId));

  return (
    <section className="variants" aria-labelledby="secenekler">
      <h2 className="variants-title" id="secenekler">
        Aynı saatlerde {size.toLocaleString("tr-TR")} şube seçeneği
        <span className="hint"> Saatler aynı; şube ve hoca değişir.</span>
      </h2>
      <ul className="variants-list">
        {variants.map((v, i) => (
          <li key={i}>
            <button type="button" className="variant" aria-pressed={i === selected} onClick={() => onSelect(i)}>
              <span className="variant-rank num">{i + 1}</span>
              {differing.map((code) => {
                const k = codes.indexOf(code);
                const id = v.sections[k].sectionId;
                const section = courses.get(code)?.sections.find((s) => s.id === id);
                const who = section?.instructors.map(personName).join(", ") || "Hoca belirtilmemiş";
                return (
                  <span key={code} className="variant-pick">
                    <span className={`section-tag hl-${colorOf(code)}`}>
                      <span className="num">{code}</span> {id}
                    </span>
                    <span className="variant-who">{who}</span>
                  </span>
                );
              })}
            </button>
          </li>
        ))}
      </ul>
      {size > variants.length && (
        <p className="hint">
          İlk {variants.length} seçenek listelendi. Belli bir şubeyi istiyorsan sepette o dersin şubesini seç.
        </p>
      )}
    </section>
  );
}

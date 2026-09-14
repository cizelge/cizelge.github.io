// Mezuniyet yol haritası (sunucu bileşeni): müfredatları, yandal listelerini ve dönemlerde açılan
// ders kodlarını okur; hesaplamanın hepsi tarayıcıda yapılır.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Roadmap } from "@/components/roadmap/Roadmap";
import { loadMinors, loadPrograms, loadTerm, loadTerms } from "@/lib/data";
import { parseTermLabel } from "@/lib/terms";
import type { TermData } from "@/lib/types";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Mezuniyet yol haritası, Özyeğin",
  description:
    "Geçtiğin dersleri işaretle, kalan dersleri dönem dönem yerleştir. Anadal, çift anadal ve yandal için tahmini mezuniyet dönemini gör.",
  alternates: { canonical: `/${SCHOOL}/yol-haritasi` },
};

/** Açılma bilgisi için yalnızca ders kodları gerekir; şubeler ve saatler istemciye gitmez. */
function slimTerm(term: TermData): TermData {
  return {
    schoolId: term.schoolId,
    termId: term.termId,
    termLabel: term.termLabel,
    fetchedAt: term.fetchedAt,
    courses: term.courses.map((c) => ({
      code: c.code,
      slug: "",
      title: "",
      ects: null,
      localCredits: null,
      prerequisites: "",
      corequisites: [],
      sections: [],
    })),
  };
}

export default function RoadmapPage() {
  const programs = loadPrograms(SCHOOL);
  const minors = loadMinors(SCHOOL);
  const current = parseTermLabel(loadTerm(SCHOOL).termLabel);

  return (
    <>
      <SiteHeader term="Özyeğin, mezuniyet yol haritası" />
      {programs ? (
        <Roadmap
          programs={programs.programs}
          minors={minors?.minors ?? null}
          terms={loadTerms(SCHOOL).map(slimTerm)}
          current={{ startYear: current.startYear, season: current.season }}
        />
      ) : (
        <main id="icerik" className="page prose">
          <h1 className="board-title">Mezuniyet yol haritası</h1>
          <p className="hint">Bölüm müfredatları henüz yüklenmedi.</p>
        </main>
      )}
      <footer className="site-footer">
        <span>Bu plan bir tahmindir, resmi değildir. Kesin bilgi için bölüm koordinatörüne danış.</span>
        <span>Resmi bir Özyeğin hizmeti değildir.</span>
      </footer>
    </>
  );
}

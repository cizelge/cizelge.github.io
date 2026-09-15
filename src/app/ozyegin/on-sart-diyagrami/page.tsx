// Ön şart diyagramı (sunucu bileşeni): müfredatları ve derslerin ön şart metinlerini okur;
// diyagram ve işaretler tarayıcıda hesaplanır.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { PrereqDiagram } from "@/components/prereq-diagram/PrereqDiagram";
import { loadPrograms, loadTerms } from "@/lib/data";
import type { TermData } from "@/lib/types";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Ön şart diyagramı, Özyeğin",
  description:
    "Programının derslerini dönem dönem gör. Aldığın dersleri işaretle, şimdi alabileceklerini ve bir dersin hangi dersleri açtığını izle.",
  alternates: { canonical: `/${SCHOOL}/on-sart-diyagrami` },
};

/** Diyagram için kod, ad, AKTS ve ön şart yeter; şubeler ve saatler istemciye gitmez. */
function slimTerm(term: TermData): TermData {
  return {
    schoolId: term.schoolId,
    termId: term.termId,
    termLabel: term.termLabel,
    fetchedAt: term.fetchedAt,
    courses: term.courses.map((c) => ({
      code: c.code,
      slug: "",
      title: c.title,
      ects: c.ects,
      localCredits: null,
      prerequisites: c.prerequisites,
      corequisites: [],
      sections: [],
    })),
  };
}

export default function PrereqDiagramPage() {
  const programs = loadPrograms(SCHOOL);

  return (
    <>
      <SiteHeader term="Özyeğin, ön şart diyagramı" />
      {programs ? (
        <PrereqDiagram programs={programs.programs} terms={loadTerms(SCHOOL).map(slimTerm)} />
      ) : (
        <main id="icerik" className="page prose">
          <h1 className="board-title">Ön şart diyagramı</h1>
          <p className="hint">Bölüm müfredatları henüz yüklenmedi.</p>
        </main>
      )}
      <footer className="site-footer">
        <span>Ön şartlar müfredattan okunur ve eksik olabilir. Kesin bilgi için SIS&apos;e bak.</span>
        <span>Resmi bir Özyeğin hizmeti değildir.</span>
      </footer>
    </>
  );
}

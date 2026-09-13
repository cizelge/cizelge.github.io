// /ozyegin ve /ozyegin/donem/[termId] için ortak planlayıcı sayfası (sunucu bileşeni).
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Planner } from "@/components/planner/Planner";
import { loadPrograms, loadTerm, termOptions } from "@/lib/data";
import { slimProgramsForClient } from "@/lib/planner/curriculum";
import { termPath } from "@/lib/terms";
import type { TermData } from "@/lib/types";

const SCHOOL = "ozyegin";

export function plannerMetadata(term: TermData): Metadata {
  const isDefault = term.termId === loadTerm(SCHOOL).termId;
  return {
    title: `Özyeğin ders programı planlayıcı, ${term.termLabel}`,
    description: `Özyeğin Üniversitesi ${term.termLabel} dersleri için çakışmasız program oluştur ve önceliklerine göre sırala.`,
    // Varsayılan dönemin /ozyegin/donem/<id> kopyası /ozyegin'e işaret eder.
    alternates: { canonical: termPath(SCHOOL, { id: term.termId, isDefault }) },
  };
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(
    new Date(iso),
  );
}

export function PlannerPage({ term }: { term: TermData }) {
  const programs = loadPrograms(SCHOOL);
  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <Planner
        term={term}
        programs={programs ? slimProgramsForClient(programs) : null}
        termOptions={termOptions(SCHOOL)}
      />
      <footer className="site-footer">
        <span>Veriler en son {formatDate(term.fetchedAt)} tarihinde güncellendi.</span>
        <span>Resmi bir Özyeğin hizmeti değildir. Kaydından önce bilgileri SIS üzerinden kontrol et.</span>
      </footer>
    </>
  );
}

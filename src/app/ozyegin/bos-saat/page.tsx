// Ortak boş saat sayfası: arkadaşlarla kesişen boş saatler. Hesap tarayıcıda yapılır.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { FreeTime } from "@/components/planner/FreeTime";
import { loadTerm } from "@/lib/data";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Ortak boş saat",
  description:
    "Arkadaşlarınla aynı anda boş olduğun saatleri bul. Herkes program linkini ekler, kesişen boşluklar çıkar.",
  alternates: { canonical: `/${SCHOOL}/bos-saat` },
};

export default function FreeTimePage() {
  const term = loadTerm(SCHOOL);
  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <FreeTime schoolId={term.schoolId} termId={term.termId} termLabel={term.termLabel} />
      <footer className="site-footer">
        <span>Paylaşılan kodda ders adı yoktur, yalnızca dolu saatler taşınır.</span>
      </footer>
    </>
  );
}

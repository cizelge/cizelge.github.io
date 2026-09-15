// Akademik takvim (sunucu bileşeni): takvim verisini derlemede okur; "bugün"e göre işaretleme tarayıcıda yapılır.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { AcademicCalendar } from "@/components/academic-calendar/AcademicCalendar";
import { loadAcademicCalendar } from "@/lib/academic-calendar/load";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Akademik takvim, Özyeğin 2026-2027",
  description:
    "Özyeğin 2026-2027 lisans akademik takvimi: ders kayıtları, ekleme-bırakma, dersten çekilme, dönem sonu sınavları, tatiller ve başvuru tarihleri. Tarihleri takvimine ekle.",
  alternates: { canonical: `/${SCHOOL}/takvim` },
};

export default function AcademicCalendarPage() {
  const data = loadAcademicCalendar(SCHOOL);

  return (
    <>
      <SiteHeader term="Özyeğin, akademik takvim" />
      {data ? (
        <AcademicCalendar data={data} />
      ) : (
        <main id="icerik" className="page prose">
          <h1 className="board-title">Akademik takvim</h1>
          <p className="hint">Akademik takvim henüz yüklenmedi.</p>
        </main>
      )}
      <footer className="site-footer">
        <span>Resmi bir Özyeğin hizmeti değildir. Kesin tarihler için akademik takvimi kontrol et.</span>
      </footer>
    </>
  );
}

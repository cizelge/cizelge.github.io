// Bugün (sunucu bileşeni): takvim ve servis verisi derlemede okunur; program ve saat tarayıcıda bilinir.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Today } from "@/components/today/Today";
import { loadAcademicCalendar } from "@/lib/academic-calendar/load";
import { loadShuttle } from "@/lib/data";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Bugün",
  description: "Bugünkü derslerin, sıradaki dersin dersliği, servis saatin ve yaklaşan akademik tarih. Telefonuna uygulama gibi ekle.",
  alternates: { canonical: `/${SCHOOL}/bugun` },
};

const DAY_MS = 86_400_000;

export default function TodayPage() {
  const calendar = loadAcademicCalendar(SCHOOL);
  // Aylarca süren dönemler "yaklaşan tarih" olarak gösterilmez.
  const events = (calendar?.events ?? []).filter(
    (e) => !e.end || (Date.parse(`${e.end}T00:00:00Z`) - Date.parse(`${e.start}T00:00:00Z`)) / DAY_MS <= 21,
  );
  return (
    <>
      <SiteHeader term="Özyeğin, bugün" />
      <Today schoolId={SCHOOL} events={events} shuttle={loadShuttle(SCHOOL)} />
    </>
  );
}

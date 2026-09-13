import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Planner } from "@/components/planner/Planner";
import { loadTerm } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const term = loadTerm("ozyegin");
  return {
    title: `Özyeğin ders programı planlayıcı, ${term.termLabel}`,
    description: `Özyeğin Üniversitesi ${term.termLabel} dersleri için çakışmasız program oluştur ve önceliklerine göre sırala.`,
    alternates: { canonical: "/ozyegin" },
  };
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(
    new Date(iso),
  );
}

export default function OzyeginPlanner() {
  const term = loadTerm("ozyegin");
  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <Planner term={term} />
      <footer className="site-footer">
        <span>Veriler en son {formatDate(term.fetchedAt)} tarihinde güncellendi.</span>
        <span>Resmi bir Özyeğin hizmeti değildir. Kaydından önce bilgileri SIS üzerinden kontrol et.</span>
      </footer>
    </>
  );
}

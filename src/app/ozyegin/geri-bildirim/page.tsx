// Geri bildirim sayfası: öneri, hata ve ders verisi düzeltmeleri.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Feedback } from "@/components/Feedback";
import { loadTerm } from "@/lib/data";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Geri bildirim",
  description: "OzuHelper'a öneri, hata bildirimi ya da yanlış ders verisi düzeltmesi gönder.",
  alternates: { canonical: `/${SCHOOL}/geri-bildirim` },
};

export default function FeedbackPage() {
  const term = loadTerm(SCHOOL);
  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <main id="icerik" className="page prose">
        <h1>Geri bildirim</h1>
        <p>
          Eksik bulduğun, bozuk çalışan ya da yanlış görünen bir şey varsa yaz. Ders verisi doğrudan okulun
          açık sayfalarından geliyor; yanlış bir saat ya da şube görürsen bildirmen bütün kullanıcıların işine
          yarar.
        </p>
        <Feedback school={SCHOOL} />
      </main>
      <footer className="site-footer">
        <span>Resmi bir Özyeğin hizmeti değildir.</span>
      </footer>
    </>
  );
}

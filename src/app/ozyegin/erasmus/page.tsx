// Erasmus başvurusu ve ders eşleştirme (sunucu bileşeni): Erasmus verisini ve hafifletilmiş müfredatları okur;
// uygunluk, puan, hibe ve eşleştirme hesabı tarayıcıda, öğrencinin girdiği bilgilerle yapılır.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Erasmus } from "@/components/erasmus/Erasmus";
import { loadErasmus, loadPartners, loadPrograms } from "@/lib/data";
import { slimPrograms } from "@/lib/erasmus/prefill";
import { partnerItems } from "@/lib/erasmus/universities";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Erasmus başvurusu ve ders eşleştirme, Özyeğin",
  description:
    "Not ortalamanı ve ELE puanını gir. Özyeğin Erasmus başvuru şartlarını, tahmini Erasmus puanını ve hibeyi gör; yurt dışında alacağın dersleri kalan derslerinle eşleştir.",
  alternates: { canonical: `/${SCHOOL}/erasmus` },
};

export default function ErasmusPage() {
  const data = loadErasmus(SCHOOL);
  const programs = loadPrograms(SCHOOL)?.programs ?? [];
  // Anlaşmalı okullar hafif listeyle (ad, ülke, şehir, kod) gider; geniş ECHE listesi tarayıcıda gerektiğinde yüklenir.
  const partners = partnerItems(loadPartners(SCHOOL));

  return (
    <>
      <SiteHeader term="Özyeğin, Erasmus" />
      {data ? (
        <Erasmus data={data} programs={slimPrograms(programs)} partners={partners} />
      ) : (
        <main id="icerik" className="page prose">
          <h1 className="board-title">Erasmus başvurusu</h1>
          <p className="hint">Erasmus bilgileri henüz yüklenmedi.</p>
        </main>
      )}
      <footer className="site-footer">
        <span>Puan ve hibe tahminidir, kabul garantisi değildir. Kesin bilgi için Uluslararası Ofis&apos;e danış.</span>
        <span>Resmi bir Özyeğin hizmeti değildir.</span>
      </footer>
    </>
  );
}

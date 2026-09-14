// Yatay geçiş ve çift anadal (sunucu bileşeni): geçiş verisini ve bölüm adlarını okur;
// uygunluk hesabı tarayıcıda, öğrencinin girdiği bilgilerle yapılır.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Transfer } from "@/components/transfer/Transfer";
import { loadPrograms, loadTransfer } from "@/lib/data";
import { buildPrefillIndex } from "@/lib/transfer/profile-storage";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Yatay geçiş ve çift anadal, Özyeğin",
  description:
    "Not ortalamanı, dönemini ve YKS bilgilerini gir. Özyeğin'de hangi bölüme yatay geçiş ya da çift anadal şartlarını sağladığını ve kontenjanları gör.",
  alternates: { canonical: `/${SCHOOL}/gecis` },
};

export default function TransferPage() {
  const data = loadTransfer(SCHOOL);
  const programs = loadPrograms(SCHOOL)?.programs ?? [];

  return (
    <>
      <SiteHeader term="Özyeğin, yatay geçiş ve çift anadal" />
      {data ? (
        <Transfer
          data={data}
          programs={programs.map((p) => ({ id: p.id, name: p.name, faculty: p.faculty }))}
          prefillIndex={buildPrefillIndex(programs)}
        />
      ) : (
        <main id="icerik" className="page prose">
          <h1 className="board-title">Yatay geçiş ve çift anadal</h1>
          <p className="hint">Geçiş ve çift anadal bilgileri henüz yüklenmedi.</p>
        </main>
      )}
      <footer className="site-footer">
        <span>Kabul garantisi değildir. Kesin bilgi için Öğrenci İşleri&apos;ne danış.</span>
        <span>Resmi bir Özyeğin hizmeti değildir.</span>
      </footer>
    </>
  );
}

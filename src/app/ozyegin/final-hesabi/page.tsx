// Finalden kaç almalıyım: veri gerektirmez, hesap tarayıcıda yapılır.
import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { FinalCalculator } from "@/components/grades/FinalCalculator";

export const metadata: Metadata = {
  title: "Finalden kaç almalıyım, not hesaplama",
  description:
    "Vize, ödev ve quiz notlarını yüzdeleriyle gir; her harf notu için finalden kaç alman gerektiğini gör. Harf sınırlarını dersin izlencesine göre değiştirebilirsin.",
  alternates: { canonical: "/ozyegin/final-hesabi" },
};

export default function FinalCalculatorPage() {
  return (
    <>
      <SiteHeader term="Not hesabı" />
      <FinalCalculator />
      <footer className="site-footer">
        <span>Resmi bir Özyeğin hizmeti değildir. Harf sınırlarını dersin hocası belirler.</span>
      </footer>
    </>
  );
}

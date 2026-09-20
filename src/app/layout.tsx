import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { DeadlineBanner } from "@/components/DeadlineBanner";
import { ServiceWorker } from "@/components/ServiceWorker";
import { THEME_SCRIPT } from "@/components/theme-script";
import { USING_SAMPLE_DATA } from "@/lib/data";
import { loadAcademicCalendar } from "@/lib/academic-calendar/load";
import { isDeadline } from "@/lib/academic-calendar/deadline";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "latin-ext"],
});

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "OzuHelper: çakışmasız ders programı",
    template: "%s | OzuHelper",
  },
  description:
    "Derslerini seç, çakışmayan bütün programları gör. Kampüse az gün gelmek ya da sabah dersinden kaçmak gibi önceliklerine göre sıralar.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "OzuHelper",
    // Paylaşım önizlemesi (WhatsApp, Instagram, arama).
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "OzuHelper: Özyeğin çakışmasız ders programı" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  appleWebApp: { capable: true, title: "OzuHelper", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

// Telefonda alt gezinme çubuğu ekranın alt kenarına (çentikli cihazlarda güvenli alana) yerleşir.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Bant yalnızca kayıt, ekleme-bırakma ve çekilme tarihlerini gösterir; küçük bir liste gider.
  const deadlines = (loadAcademicCalendar("ozyegin")?.events ?? []).filter(isDeadline);

  return (
    <html lang="tr" className={onest.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/* Site künyesi: arama sonuçlarında ad ve adres. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "OzuHelper",
              url: siteUrl,
              inLanguage: "tr",
              description: "Özyeğin Üniversitesi için çakışmasız ders programı, hoca ve ders puanları.",
            }),
          }}
        />
        <a href="#icerik" className="skip-link">
          İçeriğe geç
        </a>
        <DeadlineBanner events={deadlines} />
        {USING_SAMPLE_DATA && (
          <div className="sample-banner">Örnek veri gösteriliyor. Buradaki dersler gerçek değil.</div>
        )}
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}

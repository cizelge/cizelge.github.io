import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import { THEME_SCRIPT } from "@/components/theme-script";
import { USING_SAMPLE_DATA } from "@/lib/data";
import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "latin-ext"],
});

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Çizelge: çakışmasız ders programı",
    template: "%s | Çizelge",
  },
  description:
    "Derslerini seç, çakışmayan bütün programları gör. Kampüse az gün gelmek ya da sabah dersinden kaçmak gibi önceliklerine göre sıralar.",
  openGraph: { type: "website", locale: "tr_TR", siteName: "Çizelge" },
  appleWebApp: { capable: true, title: "Çizelge", statusBarStyle: "default" },
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
  return (
    <html lang="tr" className={onest.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a href="#icerik" className="skip-link">
          İçeriğe geç
        </a>
        {USING_SAMPLE_DATA && (
          <div className="sample-banner">Örnek veri gösteriliyor. Buradaki dersler gerçek değil.</div>
        )}
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}

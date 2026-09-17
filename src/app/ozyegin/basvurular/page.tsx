// Başvurular: yatay geçiş, çift anadal, yandal ve Erasmus sayfalarının giriş kapısı.
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import styles from "@/components/apply/apply.module.css";
import { loadErasmus, loadTransfer } from "@/lib/data";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Başvurular: yatay geçiş, çift anadal ve Erasmus",
  description:
    "Özyeğin'de yatay geçiş, çift anadal, yandal ve Erasmus başvuruları: şartlar, ortalama sınırları, kontenjanlar, puan ve hibe hesabı.",
  alternates: { canonical: `/${SCHOOL}/basvurular` },
};

export default function ApplyPage() {
  const transfer = loadTransfer(SCHOOL);
  const erasmus = loadErasmus(SCHOOL);
  const when = (iso: string | undefined) =>
    iso ? new Date(iso).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric" }) : null;

  return (
    <>
      <SiteHeader term="Özyeğin, başvurular" />
      <main id="icerik" className={styles.root}>
        <div className={styles.band}>
          <div className={styles.bandInner}>
            <h1 className={styles.title}>Başvurular</h1>
            <p className={styles.lede}>
              Yılda bir iki kez açılan başvurular: bölüm değiştirme, ikinci bir bölüm okuma ve yurt dışında bir dönem.
              Şartları sağlıyor musun, buradan bak.
            </p>
          </div>
        </div>

        <div className={styles.body}>
          <ul className={styles.cards}>
            <li className={styles.card}>
              <Link href="/ozyegin/gecis" className={styles.cardLink}>
                <span className={styles.cardTitle}>Yatay geçiş, çift anadal, yandal</span>
                <span className={styles.cardText}>
                  Ortalamanı ve dönemini gir; hangi bölüme başvurabileceğini, kontenjanları ve geçmiş yıllarda kaç
                  kişinin kabul edildiğini gör.
                </span>
                <ul className={styles.cardList}>
                  <li>Ortalama ve kredi şartları</li>
                  <li>Bölüm bölüm kontenjanlar</li>
                  <li>Geçmiş dönem sonuçlarına göre &ldquo;olur mu&rdquo; değerlendirmesi</li>
                </ul>
                <span className={styles.cardGo}>Aç →</span>
              </Link>
            </li>

            <li className={styles.card}>
              <Link href="/ozyegin/erasmus" className={styles.cardLink}>
                <span className={styles.cardTitle}>Erasmus</span>
                <span className={styles.cardText}>
                  Başvuru şartları, tahmini Erasmus puanın ve alacağın aylık hibe.
                </span>
                <ul className={styles.cardList}>
                  <li>Ortalama ve dil sınavı şartı</li>
                  <li>Puan hesabı, ek puan ve kesintiler</li>
                  <li>Aylık hibe ve toplam tutar</li>
                </ul>
                <span className={styles.cardGo}>Aç →</span>
              </Link>
            </li>
          </ul>

          <p className={styles.note}>
            {transfer && `Geçiş verileri ${when(transfer.fetchedAt)} tarihinde alındı. `}
            {erasmus && `Erasmus bilgileri ${erasmus.callYear} çağrısına ait. `}
            Kesin şartlar için okulun duyurularını takip et.
          </p>
        </div>
      </main>
    </>
  );
}

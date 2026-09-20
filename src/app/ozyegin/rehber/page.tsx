// Rehberler: yönetmelikteki kuralların sade anlatımı.
import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { GUIDES } from "@/lib/guides/ozyegin";
import { loadTerm } from "@/lib/data";
import styles from "./[slug]/guide.module.css";

const SCHOOL = "ozyegin";

export const metadata: Metadata = {
  title: "Özyeğin öğrenci rehberi: ders kaydı, AKTS sınırı, çekilme, tekrar",
  description:
    "Özyeğin'de ders kaydı, ekle-bırak, dönemlik AKTS sınırı, dersten çekilme ve ders tekrarı kuralları. Yönetmelikten sade anlatım, madde numaralarıyla.",
  alternates: { canonical: `/${SCHOOL}/rehber` },
};

export default function GuidesPage() {
  const term = loadTerm(SCHOOL);
  return (
    <>
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <main id="icerik" className={styles.root}>
        <h1 className={styles.title}>Öğrenci rehberi</h1>
        <p className={styles.lede}>
          Özyeğin yönetmeliğinde öğrencinin en çok takıldığı kurallar, sade anlatımla ve madde numaralarıyla.
          Her sayfanın sonunda resmi kaynak var.
        </p>

        <ul className={styles.list}>
          {GUIDES.map((guide) => (
            <li key={guide.slug} style={{ marginBottom: "0.9rem" }}>
              <Link href={`/ozyegin/rehber/${guide.slug}`} className="link" style={{ fontWeight: 600 }}>
                {guide.title}
              </Link>
              <p className={styles.p} style={{ margin: "0.2rem 0 0", color: "var(--ink-2)" }}>
                {guide.description}
              </p>
            </li>
          ))}
        </ul>
      </main>
      <footer className="site-footer">
        <span>Resmi bir Özyeğin hizmeti değildir.</span>
      </footer>
    </>
  );
}

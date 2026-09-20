// Tek rehber sayfası. İçerik src/lib/guides/ozyegin.ts içinde; burada yalnızca düzen var.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { GUIDES, guideBySlug, type GuideBlock } from "@/lib/guides/ozyegin";
import { loadTerm } from "@/lib/data";
import styles from "./guide.module.css";

export const dynamicParams = false;

const SCHOOL = "ozyegin";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/ozyegin/rehber/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const guide = guideBySlug(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/${SCHOOL}/rehber/${guide.slug}` },
  };
}

function Block({ block }: { block: GuideBlock }) {
  if (block.kind === "p") return <p className={styles.p}>{block.text}</p>;
  if (block.kind === "note") return <p className={styles.note}>{block.text}</p>;
  if (block.kind === "list") {
    return (
      <ul className={styles.list}>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {block.head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (
                <td key={cell} className={i === 0 ? styles.firstCell : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function GuidePage(props: PageProps<"/ozyegin/rehber/[slug]">) {
  const { slug } = await props.params;
  const guide = guideBySlug(slug);
  if (!guide) notFound();
  const term = loadTerm(SCHOOL);

  // Arama sonuçlarında makale künyesi.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "tr",
    about: { "@type": "CollegeOrUniversity", name: "Özyeğin Üniversitesi", url: "https://www.ozyegin.edu.tr" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader term={`Özyeğin, ${term.termLabel}`} />
      <main id="icerik" className={styles.root}>
        <p className={styles.back}>
          <Link href="/ozyegin/rehber" className="link">
            Rehberler
          </Link>
        </p>
        <h1 className={styles.title}>{guide.title}</h1>
        <p className={styles.lede}>{guide.lede}</p>

        {guide.sections.map((section) => (
          <section key={section.heading} className={styles.section}>
            <h2 className={styles.heading}>{section.heading}</h2>
            {section.blocks.map((block, i) => (
              <Block key={i} block={block} />
            ))}
          </section>
        ))}

        <section className={styles.section}>
          <h2 className={styles.heading}>Sitede ilgili sayfalar</h2>
          <ul className={styles.list}>
            {guide.related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="link">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.sources}>
          <h2 className={styles.heading}>Kaynaklar</h2>
          <ul className={styles.list}>
            {guide.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} className="link" target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className={styles.warn}>
            Bu sayfa yönetmeliğin sade bir özetidir, resmi metin değildir. Kuralların güncel hâli ve senin
            durumuna özel istisnalar için Öğrenci Hizmetleri&rsquo;ne ya da danışmanına sor.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <span>Resmi bir Özyeğin hizmeti değildir.</span>
      </footer>
    </>
  );
}

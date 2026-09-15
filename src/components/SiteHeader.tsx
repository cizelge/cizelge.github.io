import Link from "next/link";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader({ term }: { term?: string }) {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        <span className="wordmark-mark">Çizelge</span>
      </Link>
      {term && <span className="topbar-term">{term}</span>}
      <span className="topbar-spacer" />
      <nav className="topbar-nav" aria-label="Sayfalar">
        <Link href="/ozyegin/yol-haritasi" className="btn btn-small btn-quiet">
          Yol haritası
        </Link>
        <Link href="/ozyegin/gecis" className="btn btn-small btn-quiet">
          <span className="nav-long">Geçiş ve ÇAP</span>
          <span className="nav-short">Geçiş</span>
        </Link>
        <Link href="/ozyegin/on-sart-diyagrami" className="btn btn-small btn-quiet">
          Ön şart
        </Link>
        <Link href="/ozyegin/erasmus" className="btn btn-small btn-quiet">
          Erasmus
        </Link>
        <Link href="/hakkinda" className="btn btn-small btn-quiet">
          Hakkında
        </Link>
      </nav>
      <ThemeToggle />
      <MobileNav />
    </header>
  );
}

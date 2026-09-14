import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader({ term }: { term?: string }) {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        <span className="wordmark-mark">Çizelge</span>
      </Link>
      {term && <span className="topbar-term">{term}</span>}
      <span className="topbar-spacer" />
      <Link href="/ozyegin/yol-haritasi" className="btn btn-small btn-quiet">
        Yol haritası
      </Link>
      <Link href="/hakkinda" className="btn btn-small btn-quiet">
        Hakkında
      </Link>
      <ThemeToggle />
    </header>
  );
}

import Link from "next/link";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";
import { TopNav } from "./TopNav";

export function SiteHeader({ term }: { term?: string }) {
  return (
    <header className="topbar">
      <Link href="/" className="wordmark">
        <span className="wordmark-mark">Çizelge</span>
      </Link>
      {term && <span className="topbar-term">{term}</span>}
      <span className="topbar-spacer" />
      <TopNav />
      <ThemeToggle />
      <MobileNav />
    </header>
  );
}

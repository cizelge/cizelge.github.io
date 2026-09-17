"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./MobileNav";

// Geniş ekranda üst menü: alt çubukla aynı araçlar ve aynı etkin sayfa işareti.
const LONG_LABEL: Record<string, string> = {};

export function TopNav() {
  const pathname = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const aboutActive = pathname === "/hakkinda";
  return (
    <nav className="topbar-nav" aria-label="Sayfalar">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="btn btn-small btn-quiet"
          aria-current={item.match(pathname) ? "page" : undefined}
        >
          <span className="nav-label">{LONG_LABEL[item.href] ?? item.label}</span>
        </Link>
      ))}
      <Link
        href="/ozyegin/takvim"
        className="btn btn-small btn-quiet nav-about"
        aria-current={pathname === "/ozyegin/takvim" ? "page" : undefined}
      >
        <span className="nav-label">Takvim</span>
      </Link>
      <Link href="/hakkinda" className="btn btn-small btn-quiet nav-about" aria-current={aboutActive ? "page" : undefined}>
        <span className="nav-label">Hakkında</span>
      </Link>
    </nav>
  );
}

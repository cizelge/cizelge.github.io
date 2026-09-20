"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Telefonda alt gezinme çubuğu. Etkin sayfanın adının altında logodaki fosforlu kalem çizgisi.
export const NAV_ITEMS: { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode }[] = [
  {
    href: "/ozyegin",
    label: "Program",
    // Planlayıcı ve dönem sayfaları; tek ders sayfaları "Dersler" sekmesine ait.
    match: (p) => p === "/ozyegin" || p.startsWith("/ozyegin/donem"),
    icon: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9h17M9 9v10.5M15 9v10.5" />
      </>
    ),
  },
  {
    href: "/ozyegin/dersler",
    label: "Dersler",
    match: (p) => p === "/ozyegin/dersler" || (/^\/ozyegin\/[^/]+$/.test(p) && !TOOL_PATHS.includes(p) && p !== "/ozyegin"),
    icon: (
      <>
        <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
        <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
      </>
    ),
  },
  {
    href: "/ozyegin/hocalar",
    label: "Hocalar",
    match: (p) => p === "/ozyegin/hocalar" || p.startsWith("/ozyegin/hoca/"),
    icon: (
      <>
        <path d="M12 3.8l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
      </>
    ),
  },
  {
    href: "/ozyegin/yol-haritasi",
    label: "Yol haritası",
    match: (p) => p === "/ozyegin/yol-haritasi",
    icon: <path d="M4 19c3-1 3-6 8-7s5-6 8-7M4 19h.01M20 5h.01" />,
  },
  {
    href: "/ozyegin/on-sart-diyagrami",
    label: "Ön şart",
    match: (p) => p === "/ozyegin/on-sart-diyagrami",
    icon: (
      <>
        <rect x="8.5" y="3" width="7" height="5" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
        <rect x="14" y="16" width="7" height="5" rx="1.5" />
        <path d="M12 8v4M6.5 16v-2.5a1.5 1.5 0 0 1 1.5-1.5h8a1.5 1.5 0 0 1 1.5 1.5V16" />
      </>
    ),
  },
  {
    href: "/ozyegin/basvurular",
    label: "Başvurular",
    match: (p) => p === "/ozyegin/basvurular" || p === "/ozyegin/gecis" || p === "/ozyegin/erasmus",
    icon: (
      <>
        <path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
        <path d="M13.5 3.8V8h4.2M9 13h6M9 16.5h4" />
      </>
    ),
  },
];

const TOOL_PATHS = ["/ozyegin/dersler", "/ozyegin/hocalar", "/ozyegin/bos-saat", "/ozyegin/rehber", "/ozyegin/geri-bildirim", "/ozyegin/basvurular", "/ozyegin/yol-haritasi", "/ozyegin/on-sart-diyagrami", "/ozyegin/gecis", "/ozyegin/erasmus", "/ozyegin/takvim"];

export function MobileNav() {
  // Statik yayında adresler "/" ile bitiyor (trailingSlash); eşleştirmeden önce atılır.
  const pathname = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  return (
    <nav className="bottom-nav" aria-label="Araçlar">
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.href} href={item.href} className="bottom-nav-item" aria-current={active ? "page" : undefined}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="bottom-nav-icon">
              <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                {item.icon}
              </g>
            </svg>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

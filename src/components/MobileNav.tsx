"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Telefonda alt gezinme çubuğu. Etkin sayfanın adının altında logodaki fosforlu kalem çizgisi.
export const NAV_ITEMS: { href: string; label: string; match: (p: string) => boolean; icon: React.ReactNode }[] = [
  {
    href: "/ozyegin",
    label: "Program",
    // Planlayıcı, dönem sayfaları ve ders sayfaları (araç sayfaları hariç).
    match: (p) => p === "/ozyegin" || p.startsWith("/ozyegin/donem") || (/^\/ozyegin\/[^/]+$/.test(p) && !TOOL_PATHS.includes(p)),
    icon: (
      <>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M3.5 9h17M9 9v10.5M15 9v10.5" />
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
    href: "/ozyegin/gecis",
    label: "Geçiş",
    match: (p) => p === "/ozyegin/gecis",
    icon: <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />,
  },
  {
    href: "/ozyegin/erasmus",
    label: "Erasmus",
    match: (p) => p === "/ozyegin/erasmus",
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.5 2.3 3.5 5.2 3.5 8.5s-1 6.2-3.5 8.5M12 3.5C9.5 5.8 8.5 8.7 8.5 12s1 6.2 3.5 8.5" />
      </>
    ),
  },
];

const TOOL_PATHS = ["/ozyegin/hocalar", "/ozyegin/yol-haritasi", "/ozyegin/on-sart-diyagrami", "/ozyegin/gecis", "/ozyegin/erasmus", "/ozyegin/takvim"];

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

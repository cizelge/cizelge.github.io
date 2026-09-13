"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tema yalnızca tarayıcıda bilinir
  useEffect(() => setTheme(currentTheme()), []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="btn btn-small btn-quiet"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("tema", next);
        } catch {
          /* yok say */
        }
        setTheme(next);
      }}
      aria-label={theme ? (next === "dark" ? "Koyu temaya geç" : "Açık temaya geç") : "Temayı değiştir"}
    >
      {theme === "dark" ? "Açık tema" : "Koyu tema"}
    </button>
  );
}

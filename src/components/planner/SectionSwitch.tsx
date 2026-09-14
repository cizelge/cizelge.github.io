"use client";

import { useId, useRef } from "react";
import type { Section } from "@/lib/types";
import { personName } from "@/lib/format";

interface Props {
  courseCode: string;
  current: string;
  /** Aynı saatlerde seçilebilecek şubeler (mevcut dahil). */
  options: readonly Section[];
  onPick: (sectionId: string) => void;
}

/** Çizelgedeki ders kutusunda şube değiştirme menüsü. Menü üst katmanda açılır, kutunun taşmasına takılmaz. */
export function SectionSwitch({ courseCode, current, options, onPick }: Props) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function place(e: React.ToggleEvent<HTMLDivElement>) {
    if (e.newState !== "open" || !buttonRef.current || !menuRef.current) return;
    const b = buttonRef.current.getBoundingClientRect();
    const menu = menuRef.current;
    const width = Math.min(18 * 16, window.innerWidth - 16);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(8, Math.min(b.left, window.innerWidth - width - 8))}px`;
    // Aşağıda yer yoksa yukarı açılır.
    const below = window.innerHeight - b.bottom;
    const estimated = Math.min(options.length * 44 + 44, window.innerHeight * 0.6);
    if (below < estimated && b.top > below) {
      menu.style.top = "auto";
      menu.style.bottom = `${window.innerHeight - b.top + 4}px`;
    } else {
      menu.style.bottom = "auto";
      menu.style.top = `${b.bottom + 4}px`;
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="switch-btn"
        popoverTarget={id}
        aria-label={`${courseCode} için şube değiştir, ${options.length} şube aynı saatte`}
      >
        {current}
        <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div ref={menuRef} id={id} popover="auto" className="switch-menu" onBeforeToggle={place}>
        <p className="switch-title">
          <span className="num">{courseCode}</span>, aynı saatteki şubeler
        </p>
        <ul>
          {options.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="switch-option"
                aria-pressed={s.id === current}
                onClick={() => {
                  onPick(s.id);
                  menuRef.current?.hidePopover();
                }}
              >
                <span className="switch-id num">{s.id}</span>
                <span className="switch-who">{s.instructors.map(personName).join(", ") || "Hoca belirtilmemiş"}</span>
                {s.capacity !== null && <span className="switch-cap num">kota {s.capacity}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GenerateInput, SectionRef } from "@/lib/engine";
import { backupSections, instructorsOf, optionLabel, registrationOrder, registrationText } from "@/lib/planner/backups";
import type { Course } from "@/lib/types";
import styles from "./RegistrationPlan.module.css";

interface Props {
  input: GenerateInput | null;
  current: { sections: SectionRef[] } | null | undefined;
  courses: ReadonlyMap<string, Course>;
  colorOf: (code: string) => number;
  termLabel?: string;
}

/** Kayıt günü planı: önerilen kayıt sırası ve şube dolarsa geçilebilecek yedekler. */
export function RegistrationPlan({ input, current, courses, colorOf, termLabel }: Props) {
  const order = useMemo(
    () => (input && current ? registrationOrder(backupSections(input, current, courses)) : []),
    [input, current, courses],
  );
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (order.length === 0) return null;

  async function copy() {
    let ok = true;
    try {
      await navigator.clipboard.writeText(registrationText(order, courses, termLabel));
    } catch {
      ok = false;
    }
    setCopied(ok ? "ok" : "fail");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(""), 2500);
  }

  return (
    <details className={styles.plan}>
      <summary className={styles.summary}>
        <span className={styles.title}>Kayıt günü planı</span>
        <span className={styles.hint}>Bir şube dolarsa programın bozulmadan geçebileceğin yedekler.</span>
      </summary>

      <div className={styles.body}>
        <ol className={styles.list}>
          {order.map(({ backups: b, reason }) => {
            const who = instructorsOf(courses, { courseCode: b.courseCode, sectionId: b.chosen });
            return (
              <li key={b.courseCode} className={styles.row}>
                <div className={styles.head}>
                  <span className={`${styles.tag} hl-${colorOf(b.courseCode)} num`}>
                    {b.courseCode} {b.chosen}
                  </span>
                  <span className={styles.who}>{who || "Hoca belirtilmemiş"}</span>
                  {b.locked && <span className={styles.note}>kilitli</span>}
                </div>
                <p className={styles.reason}>{reason}</p>
                {b.none && b.singleSection ? null : b.none ? (
                  <p className={styles.warn} role="note">
                    Yedeği yok: dolarsa programı yeniden kurman gerekir
                  </p>
                ) : (
                  <ul className={styles.chips}>
                    {b.sameTime.length > 0 && (
                      <li className={styles.chip}>
                        <span className={styles.chipLabel}>aynı saatte:</span>{" "}
                        <span className="num">{b.sameTime.map((s) => s.id).join(", ")}</span>
                      </li>
                    )}
                    {b.other.length > 0 && (
                      <li className={`${styles.chip} ${styles.chipOther}`}>
                        <span className={styles.chipLabel}>başka saatte:</span>{" "}
                        <span className="num">{b.other.map((o) => optionLabel(o, courses)).join(", ")}</span>
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>

        <div className={styles.foot}>
          <button type="button" className={`btn ${styles.copy}`} onClick={copy}>
            Listeyi kopyala
          </button>
          <span className={styles.status} aria-live="polite">
            {copied === "ok" ? "Kopyalandı" : copied === "fail" ? "Kopyalanamadı, tarayıcı izin vermedi" : ""}
          </span>
        </div>
      </div>
    </details>
  );
}

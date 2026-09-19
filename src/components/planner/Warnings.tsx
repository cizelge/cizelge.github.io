"use client";
// Planlayıcıdaki uyarı kutusu: şubende değişiklik var mı, ön şartını sağlıyor musun.
// Hiçbir şeyi değiştirmez; ne olduğunu söyler, kararı öğrenci verir.

import { personName } from "@/lib/format";
import { DAY_SHORT } from "@/lib/days";
import type { Change, PrereqWarning } from "@/lib/planner/warnings";
import styles from "./Warnings.module.css";

interface Props {
  changes: Change[];
  prereqs: PrereqWarning[];
  /** AKTS sınırı aşıldıysa cümle; aşılmadıysa null. */
  overload: string | null;
  /** Değişiklikleri okudum: bir daha gösterme. */
  onSeen: () => void;
}

/** "3 16:40-18:30" -> "Çar 16:40-18:30" */
function readable(time: string): string {
  const [day, rest] = time.split(" ");
  return `${DAY_SHORT[Number(day)] ?? day} ${rest}`;
}

function changeText(change: Change): { head: string; detail: string } {
  switch (change.kind) {
    case "courseGone":
      return { head: `${change.code} bu dönem açılmıyor`, detail: "Ders listeden kalktı; sepetinden çıkarman gerekiyor." };
    case "sectionGone":
      return {
        head: `${change.code} ${change.sectionId} şubesi kapandı`,
        detail: change.left > 0 ? `Dersin ${change.left} şubesi daha var, başka şubeye geçebilirsin.` : "Dersin başka şubesi kalmadı.",
      };
    case "time":
      return {
        head: `${change.code} ${change.sectionId} şubesinin saati değişti`,
        detail: `Önce ${change.before.map(readable).join(", ") || "saatsiz"} idi, şimdi ${change.after.map(readable).join(", ") || "saatsiz"}.`,
      };
    case "instructor":
      return {
        head: `${change.code} ${change.sectionId} şubesinin hocası değişti`,
        detail: `Önce ${change.before.map(personName).join(", ") || "belirtilmemişti"}, şimdi ${
          change.after.map(personName).join(", ") || "belirtilmemiş"
        }.`,
      };
  }
}

export function Warnings({ changes, prereqs, overload, onSeen }: Props) {
  if (changes.length === 0 && prereqs.length === 0 && !overload) return null;

  return (
    <section className={styles.root} aria-labelledby="uyarilar-baslik">
      <h2 id="uyarilar-baslik" className={styles.title}>
        Uyarılar
      </h2>

      {changes.length > 0 && (
        <div className={styles.group}>
          <ul className={styles.list}>
            {changes.map((change, i) => {
              const { head, detail } = changeText(change);
              return (
                <li key={`${change.kind}-${change.code}-${i}`} className={styles.item} data-kind="degisiklik">
                  <span className={styles.head}>{head}</span>
                  <span className={styles.detail}>{detail}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" className={styles.seen} onClick={onSeen}>
            Gördüm, bir daha gösterme
          </button>
        </div>
      )}

      {overload && (
        <ul className={styles.list}>
          <li className={styles.item} data-kind="akts">
            <span className={styles.head}>Dönem AKTS sınırını aştın</span>
            <span className={styles.detail}>{overload}</span>
          </li>
        </ul>
      )}

      {prereqs.length > 0 && (
        <ul className={styles.list}>
          {prereqs.map((warning) => (
            <li key={warning.code} className={styles.item} data-kind="onsart">
              <span className={styles.head}>
                {warning.code}:{" "}
                {warning.state === "missing"
                  ? warning.missing.length > 0
                    ? `ön şartını sağlamıyor görünüyorsun, eksik: ${warning.missing.join(", ")}`
                    : "ön şartını sağlamıyor görünüyorsun"
                  : "ön şartı okunamadı, kendin kontrol et"}
              </span>
              <span className={styles.detail}>
                Ön koşul: {warning.text}. Yol haritasında geçtiğin dersleri işaretledikçe bu uyarı düzelir.
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

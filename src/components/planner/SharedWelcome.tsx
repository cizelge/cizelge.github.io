"use client";
// Arkadaşının linkiyle gelen kişiye: baktığın program başkasının, sen de kendininkini kurabilirsin.
// Bir kez kapatılınca bu tarayıcıda bir daha görünmez.

import styles from "./SharedWelcome.module.css";

interface Props {
  /** Sepetteki ders sayısı. */
  count: number;
  /** Bu derslerle devam: şerit kapanır. */
  onKeep: () => void;
  /** Sıfırdan başla: sepet boşalır, arama kutusuna gidilir. */
  onReset: () => void;
}

export function SharedWelcome({ count, onKeep, onReset }: Props) {
  return (
    <section className={styles.root} aria-labelledby="paylasilan-baslik">
      <div className={styles.text}>
        <h2 className={styles.title} id="paylasilan-baslik">
          Bu program sana gönderildi
        </h2>
        <p className={styles.lede}>
          Şu an <span className="num">{count}</span> derslik bir programa bakıyorsun. Burası Özyeğin için
          çakışmasız program kurma aracı: dersleri seç, bütün çakışmasız haftaları gör, hoca puanlarına bak.
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn btn-pen" onClick={onReset}>
          Kendi programımı kurayım
        </button>
        <button type="button" className={`btn ${styles.keep}`} onClick={onKeep}>
          Bu derslerle devam
        </button>
      </div>
    </section>
  );
}

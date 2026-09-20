"use client";
// Geri bildirim formu: öneri, hata ve ders verisi düzeltmeleri.
// Kimlik istenmez; iletişim bilgisi yalnızca cevap isteyenler için ve isteğe bağlıdır.

import { useState } from "react";
import { deviceId, RATINGS_API } from "@/lib/ratings/client";
import styles from "./feedback.module.css";

const KINDS = [
  { id: "oneri", label: "Öneri", hint: "eksik bir şey, yeni fikir" },
  { id: "hata", label: "Hata", hint: "bozuk çalışan bir yer" },
  { id: "veri", label: "Ders verisi yanlış", hint: "saat, şube, hoca tutmuyor" },
  { id: "diger", label: "Diğer", hint: "" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

const MIN = 10;
const MAX = 1000;

export function Feedback({ school }: { school: string }) {
  const [kind, setKind] = useState<Kind>("oneri");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"" | "sending" | "done" | string>("");

  if (!RATINGS_API) {
    return <p className={styles.closed}>Geri bildirim şu an kapalı.</p>;
  }

  const text = message.trim();
  const ready = text.length >= MIN && status !== "sending";

  async function send() {
    if (!ready) return;
    setStatus("sending");
    try {
      const res = await fetch(`${RATINGS_API}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school,
          kind,
          message: text,
          contact: contact.trim() || null,
          page: window.location.pathname,
          device: deviceId(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? "Gönderilemedi");
        return;
      }
      setMessage("");
      setContact("");
      setStatus("done");
    } catch {
      setStatus("İnternete ulaşılamadı");
    }
  }

  if (status === "done") {
    return (
      <div className={styles.done} role="status">
        <p className={styles.doneTitle}>Aldım, teşekkürler.</p>
        <p className={styles.doneText}>
          Mesajın kaydedildi. Cevap istediysen ve iletişim bıraktıysan döneceğim.
        </p>
        <button type="button" className="btn btn-small" onClick={() => setStatus("")}>
          Bir tane daha yaz
        </button>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <fieldset className={styles.kinds}>
        <legend className={styles.legend}>Konu</legend>
        <div className={styles.kindRow} role="radiogroup" aria-label="Konu">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              className={styles.kind}
              data-on={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              <span className={styles.kindLabel}>{k.label}</span>
              {k.hint && <span className={styles.kindHint}>{k.hint}</span>}
            </button>
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span className={styles.legend}>Mesajın</span>
        <textarea
          className={styles.textarea}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={MAX}
          rows={5}
          placeholder="Ne eksik, ne bozuk, ne olsa daha iyi olurdu?"
        />
        <span className={styles.counter}>
          <span className="num">{text.length}</span>/{MAX}
          {text.length > 0 && text.length < MIN ? ` · en az ${MIN} karakter` : ""}
        </span>
      </label>

      <label className={styles.field}>
        <span className={styles.legend}>
          E-posta ya da kullanıcı adın <span className={styles.optional}>isteğe bağlı, cevap istersen</span>
        </span>
        <input
          className={styles.input}
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          maxLength={120}
          placeholder="boş bırakabilirsin"
        />
      </label>

      <div className={styles.actions}>
        <button type="submit" className="btn btn-pen" disabled={!ready}>
          {status === "sending" ? "Gönderiliyor" : "Gönder"}
        </button>
        {status && status !== "sending" && (
          <span className={styles.error} role="status">
            {status}
          </span>
        )}
      </div>

      <p className={styles.privacy}>
        Ad, numara ya da not sorulmaz. Yazdığın mesaj ve varsa iletişim bilgin saklanır; başka hiçbir şey
        kaydedilmez. Hangi sayfadan yazdığın bilgisi mesaja eklenir ki hatayı bulabileyim.
      </p>
    </form>
  );
}

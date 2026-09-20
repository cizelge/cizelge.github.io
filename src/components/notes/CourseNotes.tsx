"use client";
// Ders notu bağlantıları: öğrenciler kendi Drive/Notion bağlantılarını paylaşır.
// Dosya bizde durmaz; bildirilen bağlantı kendiliğinden gizlenir.

import { useEffect, useMemo, useRef, useState } from "react";
import { personName } from "@/lib/format";
import { instructorSlug } from "@/lib/ratings/instructors";
import { RATINGS_API } from "@/lib/ratings/client";
import { recentTerms, termLabel } from "@/lib/grades/types";
import {
  ALLOWED_LABEL,
  deleteNote,
  fetchNotes,
  KIND_LABEL,
  NOTE_KINDS,
  reportNote,
  shareNote,
  type Note,
  type NoteKind,
} from "@/lib/notes/client";
import styles from "./notes.module.css";

interface Props {
  school: string;
  code: string;
  instructors: readonly string[];
}

/** "2 gün önce" gibi kısa yaş. */
function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} ay önce` : `${Math.floor(months / 12)} yıl önce`;
}

export function CourseNotes({ school, code, instructors }: Props) {
  const terms = useMemo(() => recentTerms(), []);
  const people = useMemo(() => {
    const seen = new Map<string, string>();
    for (const name of instructors) seen.set(instructorSlug(name), name);
    return [...seen].map(([slug, name]) => ({ slug, name: personName(name) }));
  }, [instructors]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<NoteKind>("ozet");
  const [term, setTerm] = useState("");
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetchNotes(school, code).then((list) => {
      setNotes(list ?? []);
      setReady(true);
    });
  }, [school, code]);

  if (!RATINGS_API) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNote("");
    const res = await shareNote(school, code, { url, title, kind, term, instructor: who });
    setBusy(false);
    if (!res.ok) {
      setNote(res.error);
      return;
    }
    setNotes(res.notes);
    setUrl("");
    setTitle("");
    setOpen(false);
    setNote("Bağlantı eklendi, teşekkürler.");
  }

  async function drop(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await deleteNote(school, code, id);
    setBusy(false);
    if (res.ok) setNotes(res.notes);
    setNote(res.ok ? "Bağlantın kaldırıldı." : res.error);
  }

  async function report(id: string) {
    if (busy) return;
    setBusy(true);
    const res = await reportNote(school, code, id);
    setBusy(false);
    if (res.ok) setNotes(res.notes);
    setNote(res.ok ? "Bildirildi. Yeterince bildirim alırsa gizlenir." : res.error);
  }

  return (
    <section className={styles.root} aria-labelledby="ders-notlari">
      <h2 className="group-title" style={{ fontSize: "1.25rem" }} id="ders-notlari">
        Ders notları
      </h2>

      <div className={styles.cols}>
        <div className={styles.listCol}>
      {!ready ? (
        <p className="hint">Yükleniyor…</p>
      ) : notes.length === 0 ? (
        <p className={styles.empty}>Bu ders için henüz bağlantı paylaşılmadı. İlk paylaşan sen ol.</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((n) => (
            <li key={n.id} className={styles.item}>
              <span className={styles.kind} data-kind={n.kind}>
                {KIND_LABEL[n.kind]}
              </span>
              <a className={styles.link} href={n.url} target="_blank" rel="noopener noreferrer nofollow">
                {n.title}
              </a>
              <p className={styles.meta}>
                {n.term ? termLabel(n.term) : "dönem belirtilmemiş"}
                {n.instructor && ` · ${people.find((p) => p.slug === n.instructor)?.name ?? n.instructor}`}
                {` · ${ago(n.at)}`}
              </p>
              <div className={styles.rowActions}>
                {n.mine ? (
                  <button type="button" className={styles.quiet} onClick={() => drop(n.id)} disabled={busy}>
                    Kaldır
                  </button>
                ) : (
                  <button type="button" className={styles.quiet} onClick={() => report(n.id)} disabled={busy}>
                    Bildir
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

        </div>

      {!open ? (
        <div className={styles.actions}>
          <button type="button" className="btn btn-small" onClick={() => setOpen(true)}>
            Bağlantı paylaş
          </button>
          {note && (
            <span className={styles.note} role="status">
              {note}
            </span>
          )}
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <h3 className={styles.formTitle}>Bağlantı paylaş</h3>
          <p className="hint">
            Dosya bizde durmaz, yalnızca bağlantı tutulur. {ALLOWED_LABEL} bağlantısı olabilir. Bağlantıyı
            herkese açık paylaşmayı unutma.
          </p>

          <label className={styles.field}>
            <span>Bağlantı</span>
            <input
              className={styles.input}
              type="url"
              inputMode="url"
              placeholder="https://drive.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>

          <label className={styles.field}>
            <span>Başlık</span>
            <input
              className={styles.input}
              type="text"
              placeholder="Final özeti, 2. vize soruları…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
            />
          </label>

          <div className={styles.row}>
            <label className={styles.field}>
              <span>Tür</span>
              <select className="select" value={kind} onChange={(e) => setKind(e.target.value as NoteKind)}>
                {NOTE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Dönem</span>
              <select className="select" value={term} onChange={(e) => setTerm(e.target.value)}>
                <option value="">Belirtmeyeceğim</option>
                {terms.map((t) => (
                  <option key={t} value={t}>
                    {termLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span>Hoca</span>
              <select className="select" value={who} onChange={(e) => setWho(e.target.value)}>
                <option value="">Belirtmeyeceğim</option>
                {people.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className={styles.warn}>
            Hocanın izin vermediği materyali paylaşma. Bildirilen bağlantılar gizlenir.
          </p>

          <div className={styles.actions}>
            <button type="submit" className="btn btn-pen" disabled={busy || !url || title.trim().length < 3}>
              Paylaş
            </button>
            <button type="button" className="btn btn-small" onClick={() => setOpen(false)} disabled={busy}>
              Vazgeç
            </button>
            {note && (
              <span className={styles.note} role="status">
                {note}
              </span>
            )}
          </div>
        </form>
      )}
      </div>
    </section>
  );
}

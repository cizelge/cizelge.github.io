"use client";
// Ders notu bağlantıları: dosya barındırmıyoruz, yalnızca bağlantı saklıyoruz (bkz. server/notes.ts).
import { deviceId, RATINGS_API } from "@/lib/ratings/client";

export const NOTE_KINDS = ["ozet", "cikmis", "slayt", "video", "diger"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export const KIND_LABEL: Record<NoteKind, string> = {
  ozet: "Özet",
  cikmis: "Çıkmış soru",
  slayt: "Slayt",
  video: "Video",
  diger: "Diğer",
};

/** Bağlantı hangi sitelerden olabilir (sunucudaki listenin aynısı). */
export const ALLOWED_LABEL = "Drive, Docs, OneDrive, Dropbox, Notion, GitHub, YouTube, Mega";

export interface Note {
  id: string;
  url: string;
  title: string;
  kind: NoteKind;
  term: string | null;
  instructor: string | null;
  at: string;
  /** Bu tarayıcı mı eklemiş. */
  mine: boolean;
}

export interface NoteDraft {
  url: string;
  title: string;
  kind: NoteKind;
  term: string;
  instructor: string;
}

export type NoteResult = { ok: true; notes: Note[] } | { ok: false; error: string };

const key = (course: string) => course.replace(/\s+/g, "").toUpperCase();

export async function fetchNotes(school: string, course: string): Promise<Note[] | null> {
  if (!RATINGS_API) return null;
  try {
    const url = `${RATINGS_API}/notes?school=${encodeURIComponent(school)}&course=${encodeURIComponent(key(course))}&device=${encodeURIComponent(deviceId())}`;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as { notes?: Note[] };
    return data.notes ?? null;
  } catch {
    return null;
  }
}

async function post(path: string, body: Record<string, unknown>): Promise<NoteResult> {
  if (!RATINGS_API) return { ok: false, error: "Paylaşım kapalı" };
  const device = deviceId();
  if (!device) return { ok: false, error: "Tarayıcın depolamaya izin vermiyor" };
  try {
    const res = await fetch(`${RATINGS_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, device }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string; notes?: Note[] };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? "İşlem yapılamadı" };
    return { ok: true, notes: data.notes ?? [] };
  } catch {
    return { ok: false, error: "İnternete ulaşılamadı" };
  }
}

export const shareNote = (school: string, course: string, draft: NoteDraft) =>
  post("/notes", { school, course: key(course), ...draft });

export const deleteNote = (school: string, course: string, id: string) =>
  post("/unnote", { school, course: key(course), id });

export const reportNote = (school: string, course: string, id: string) =>
  post("/notereport", { school, course: key(course), id });

"use client";
// Kısa paylaşım kodu: uzun linki "K7M4PQ" gibi altı haneye indirir (bkz. server/share.ts).
import { RATINGS_API } from "@/lib/ratings/client";

export type ShareKind = "program" | "bos";

/** Karıştırılabilecek harfler yok: I, O, 0, 1. */
export const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

const CODE_RE = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export const isCode = (value: string) => CODE_RE.test(value);

/** Kullanıcının yazdığını kurtarır: küçük harf, boşluk, O/0 ve I/L/1 karışması. */
export function cleanCode(raw: string): string | null {
  const text = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/0/g, "Q")
    .replace(/1/g, "J");
  return isCode(text) ? text : null;
}

/** Kod alma kapalıysa (servis adresi yoksa) null döner. */
export async function createCode(kind: ShareKind, data: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  if (!RATINGS_API) return { ok: false, error: "Kod servisi kapalı" };
  try {
    const res = await fetch(`${RATINGS_API}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, data }),
    });
    const body = (await res.json()) as { ok?: boolean; code?: string; error?: string };
    if (!res.ok || !body.ok || !body.code) return { ok: false, error: body.error ?? "Kod alınamadı" };
    return { ok: true, code: body.code };
  } catch {
    return { ok: false, error: "İnternete ulaşılamadı" };
  }
}

export async function readCode(code: string): Promise<{ kind: ShareKind; data: string } | null> {
  if (!RATINGS_API) return null;
  const clean = cleanCode(code);
  if (!clean) return null;
  try {
    const res = await fetch(`${RATINGS_API}/share?kod=${clean}`, { cache: "no-cache" });
    if (!res.ok) return null;
    const body = (await res.json()) as { ok?: boolean; kind?: ShareKind; data?: string };
    if (!body.ok || !body.kind || !body.data) return null;
    return { kind: body.kind, data: body.data };
  } catch {
    return null;
  }
}

// Ön koşul haritası ve ders sayfası zinciri için saf yardımcılar: etiket kısaltma, erişilebilir ad, bağlantı.
import type { EdgeKind, GraphEdge, PrereqGraph } from "@/lib/prereq-graph/types";

const ELLIPSIS = "…";

/** Metni en çok `max` karaktere indirir; kesilirse sonuna "…" koyar, kelime ortasında kesmemeye çalışır. */
export function truncateLabel(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (max <= 0) return "";
  if (clean.length <= max) return clean;
  if (max === 1) return ELLIPSIS;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  // Son boşluk çok gerideyse kelimeyi bölmek daha çok bilgi bırakır.
  const base = space >= Math.floor((max - 1) * 0.6) ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s,.;:–-]+$/, "")}${ELLIPSIS}`;
}

/** SVG kutusuna sığacak yaklaşık karakter sayısı (orantılı yazı için ortalama genişlik ~0.55em). */
export function charsForWidth(width: number, fontSize: number, padding = 10): number {
  return Math.max(1, Math.floor((width - 2 * padding) / (fontSize * 0.55)));
}

export type NodeStatus = "passed" | "remaining";

export interface NodeDescription {
  code: string;
  title: string;
  status: NodeStatus;
  prereqCount: number;
  unlockCount: number;
  critical?: boolean;
  unreadable?: boolean;
}

/** "CS 201 Veri Yapıları, kalan, 2 ön koşul, 3 dersin önünü açıyor" */
export function nodeAriaLabel(d: NodeDescription): string {
  const parts = [`${d.code} ${d.title}`.trim(), d.status === "passed" ? "geçildi" : "kalan"];
  if (d.critical) parts.push("kritik");
  parts.push(d.prereqCount === 0 ? "ön koşulu yok" : `${d.prereqCount} ön koşul`);
  if (d.unlockCount > 0) parts.push(`${d.unlockCount} dersin önünü açıyor`);
  if (d.unreadable) parts.push("koşulun bir kısmı okunamadı");
  return parts.join(", ");
}

const TURKISH_ASCII: Record<string, string> = {
  İ: "i", I: "i", ı: "i", Ş: "s", ş: "s", Ç: "c", ç: "c", Ğ: "g", ğ: "g", Ö: "o", ö: "o", Ü: "u", ü: "u",
};

/** Ders sayfası adresi için kod: scrapers/ozyegin/import.ts courseSlug ile aynı kural. "MİM 105" -> "mim-105". */
export function courseSlug(code: string): string {
  return code
    .replace(/[İIıŞşÇçĞğÖöÜü]/g, (ch) => TURKISH_ASCII[ch])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Karşılaştırma anahtarı: boşluksuz büyük harf ("cs201" -> "CS201"). */
export function codeKey(code: string): string {
  return code.normalize("NFC").replace(/\s+/g, "").toLocaleUpperCase("en");
}

export interface Neighbors {
  requires: { code: string; kind: EdgeKind; group: number | null }[];
  unlocks: { code: string; kind: EdgeKind }[];
}

/** Grafikteki doğrudan komşular; kod başına bir kez, kenar sırasıyla. */
export function directNeighbors(edges: readonly GraphEdge[], code: string): Neighbors {
  const requires: Neighbors["requires"] = [];
  const unlocks: Neighbors["unlocks"] = [];
  for (const e of edges) {
    if (e.to === code && e.from !== code && !requires.some((r) => r.code === e.from)) {
      requires.push({ code: e.from, kind: e.kind, group: e.group });
    }
    if (e.from === code && e.to !== code && !unlocks.some((u) => u.code === e.to)) {
      unlocks.push({ code: e.to, kind: e.kind });
    }
  }
  return { requires, unlocks };
}

/** Her düğüm için doğrudan ön koşul ve açtığı ders sayısı. */
export function degreeCounts(graph: PrereqGraph): Map<string, { prereqs: number; unlocks: number }> {
  const out = new Map<string, { prereqs: number; unlocks: number }>();
  for (const code of graph.nodes.keys()) out.set(code, { prereqs: 0, unlocks: 0 });
  const seen = new Set<string>();
  for (const e of graph.edges) {
    const key = `${e.from}>${e.to}`;
    if (seen.has(key) || e.from === e.to) continue;
    seen.add(key);
    const to = out.get(e.to);
    if (to) to.prereqs++;
    const from = out.get(e.from);
    if (from) from.unlocks++;
  }
  return out;
}

/** Türkçe liste: "A", "A ve B", "A, B ve C" (bağlaç değiştirilebilir: "ya da"). */
export function joinList(items: readonly string[], conjunction = "ve"): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`;
}

/** Görünür ilk `limit` öğe ve kalanlar. */
export function splitVisible<T>(items: readonly T[], limit: number): { visible: T[]; hidden: T[] } {
  return { visible: items.slice(0, limit), hidden: items.slice(limit) };
}

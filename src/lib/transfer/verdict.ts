// "Olur mu olmaz mı": şart kontrolü + geçmiş dönemlerin kabul oranı. Saf mantık.
// Geçmiş sonuç listelerinde not ortalaması yok; oran şartları sağlamayan başvuruları da içerir,
// bu yüzden şartları sağlayan biri için gerçek şans genelde bu orandan yüksektir. Metin bunu söyler.
import type { PathResult } from "./types";

export type VerdictLevel = "no" | "likely" | "maybe" | "hard" | "eligible" | "unknown";

export interface HistoryStats {
  terms: number;
  applications: number;
  accepted: number;
  conditional: number;
  rejected: number;
  rate: number | null;
}

export interface Verdict {
  level: VerdictLevel;
  /** Kısa cevap: "Olmaz", "Büyük ihtimalle olur" ... */
  title: string;
  /** Tek cümle gerekçe. */
  detail: string;
  /** Eksik bilgi yüzünden kontrol edilemeyen şartlar (kullanıcı girerse netleşir). */
  missing: string[];
}

/** Bu kadar başvurudan az geçmiş veriyle oran söylenmez. */
export const MIN_APPLICATIONS = 5;
export const LIKELY_RATE = 0.75;
export const MAYBE_RATE = 0.45;

// Hiçbir zaman kullanıcı girdisiyle çözülemeyen kontroller (veride yok); kararı "bilinmiyor"a çekmez.
const ALWAYS_UNKNOWN = new Set(["score:internal", "notes:internal"]);

const pct = (r: number) => `%${Math.round(r * 100)}`;

/** Veride olmayan bilgi (kullanıcı giremez): "2024 taban puanı veride yok", "kontenjan yayınlanmamış". */
const DATA_GAP = /veride yok|bu sitede yok|yayınlanmamış/;

export function verdictFor(result: PathResult, history: HistoryStats | null): Verdict {
  const fail = result.checks.find((c) => c.status === "fail");
  const unknown = result.checks.filter((c) => c.status === "unknown" && !ALWAYS_UNKNOWN.has(`${c.id}:${result.path}`));
  const missing = unknown.filter((c) => !DATA_GAP.test(c.text)).map((c) => c.text);
  const gaps = unknown.filter((c) => DATA_GAP.test(c.text)).map((c) => c.text);

  if (fail) return { level: "no", title: "Olmaz", detail: fail.text, missing: [] };
  const verdict = decide(history, missing);
  // Kurum içi geçişte Türkiye geneli taban puan şartı veride yok; cevap bunu hatırlatır.
  if (result.path === "internal") verdict.detail += " YKS puanının eşdeğer programların en düşük tabanını geçtiğini ayrıca kontrol et.";
  if (gaps.length > 0) {
    verdict.detail += ` Kontrol edilemeyen: ${gaps.join(" ")}`;
    // Bir şart hiç kontrol edilemediyse "büyük ihtimalle" denmez.
    if (verdict.level === "likely") Object.assign(verdict, { level: "maybe", title: "Olabilir" });
  }
  return verdict;
}

function decide(history: HistoryStats | null, missing: string[]): Verdict {
  const enough = history !== null && history.rate !== null && history.applications >= MIN_APPLICATIONS;
  const past = enough
    ? `Son ${history!.terms} dönemde ${history!.applications} başvurunun ${history!.accepted + history!.conditional} tanesi kabul edildi (${pct(history!.rate!)}).`
    : history && history.applications > 0
      ? `Geçmişte yalnızca ${history.applications} başvuru var; oran söylemek için az.`
      : "Geçmiş dönemlerde bu bölüme bu yolla başvuru sonucu bulunamadı.";

  if (missing.length > 0) {
    return {
      level: "unknown",
      title: "Bilgilerin eksik",
      detail: `Şu ana kadar eksik şart yok, ama bazı şartlar kontrol edilemedi. ${past}`,
      missing,
    };
  }
  if (!enough) return { level: "eligible", title: "Şartları sağlıyorsun", detail: past, missing };

  const rate = history!.rate!;
  if (rate >= LIKELY_RATE) return { level: "likely", title: "Büyük ihtimalle olur", detail: past, missing };
  if (rate >= MAYBE_RATE) return { level: "maybe", title: "Olabilir", detail: past, missing };
  return { level: "hard", title: "Zor", detail: past, missing };
}

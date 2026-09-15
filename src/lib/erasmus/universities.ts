// Karşı üniversite seçimi: Özyeğin'in anlaşmalı okulları (data/ozyegin/partners.json) ve isteğe bağlı
// Avrupa Komisyonu ECHE listesi (public/data/eche-institutions.json) içinde arama.
// Kaynaklar ve yöntem: scrapers/ozyegin/partners-sources.md.

export type PartnerProgram = "erasmus" | "bilateral" | "other";

export interface Partner {
  name: string;
  country: string;
  city: string | null;
  erasmusCode: string | null;
  departments: string[];
  programs: PartnerProgram[];
}

export interface PartnersData {
  schoolId: string;
  fetchedAt: string;
  sources: { label: string; url: string }[];
  partners: Partner[];
}

export interface UniversityItem {
  name: string;
  country: string | null;
  city: string | null;
  erasmusCode: string | null;
  isPartner: boolean;
}

/** public/data/eche-institutions.json satırı: [ad, ülke (Türkçe), şehir, Erasmus kodu]. */
export type EcheRow = [string, string, string | null, string | null];

export interface UniversitySearchResult {
  partners: UniversityItem[];
  others: UniversityItem[];
  /** Sınırdan dolayı gösterilmeyen eşleşme var mı. */
  morePartners: boolean;
  moreOthers: boolean;
}

const LETTER_MAP: Record<string, string> = { ı: "i", ß: "ss", ø: "o", æ: "ae", œ: "oe", đ: "d", ł: "l", þ: "th", ð: "d" };

/** Türkçe kurala göre küçük harf, aksanlar atılır (ı→i, ş→s, ü→u, é→e, ß→ss, ø→o ...), boşluklar teke iner. */
export function foldForSearch(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[ıßøæœđłþð]/g, (c) => LETTER_MAP[c])
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Eşleştirme anahtarı: katlanmış metin, noktalama boşluk olur ve Almanca harf çevirisi eşitlenir
 * (ECHE listesinde "MUENCHEN", sayfalarda "München": ikisi de "munchen"). Sorguya da aynısı uygulanır.
 */
function searchKey(s: string): string {
  return foldForSearch(s)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .trim();
}

interface Prepared {
  item: UniversityItem;
  index: number;
  name: string;
  words: string[];
  initials: string;
  rest: string; // şehir, ülke, kod
}

const prepared = new WeakMap<readonly UniversityItem[], Prepared[]>();

function prepare(list: readonly UniversityItem[]): Prepared[] {
  let p = prepared.get(list);
  if (!p) {
    p = list.map((item, index) => {
      const name = searchKey(item.name);
      const words = name.split(" ").filter(Boolean);
      return {
        item,
        index,
        name,
        words,
        initials: words.map((w) => w[0]).join(""),
        rest: [item.city, item.country, item.erasmusCode].filter(Boolean).map((x) => searchKey(x!)).join(" "),
      };
    });
    prepared.set(list, p);
  }
  return p;
}

/** Kısaltma: "tu" → "Technische Universiteit", "kit" → "Karlsruhe Institute of Technology"'nin baş harfleri arka arkaya. */
function isAcronym(token: string, p: Prepared): boolean {
  return token.length >= 2 && token.length <= 6 && /^\p{L}+$/u.test(token) && p.initials.includes(token);
}

/** 0: ad sorguyla başlıyor, 1: her parça bir kelimenin başı, 2: her parça adda geçiyor, 3: şehir/ülke/kodla eşleşti; null: eşleşmedi. */
function rank(tokens: string[], query: string, p: Prepared): number | null {
  let level = 0;
  if (!p.name.startsWith(query)) level = 1;
  for (const t of tokens) {
    if (p.words.some((w) => w.startsWith(t)) || isAcronym(t, p)) continue;
    if (p.name.includes(t)) {
      level = Math.max(level, 2);
      continue;
    }
    if (p.rest.includes(t)) {
      level = 3;
      continue;
    }
    return null;
  }
  return level;
}

function run(tokens: string[], query: string, list: Prepared[], limit: number, skip?: (p: Prepared) => boolean) {
  const hits: { p: Prepared; r: number }[] = [];
  for (const p of list) {
    if (skip?.(p)) continue;
    const r = tokens.length === 0 ? 0 : rank(tokens, query, p);
    if (r !== null) hits.push({ p, r });
  }
  // Aynı düzeyde: adında "üniversite" geçenler önce, sonra kısa adlar ("TU München" uzun vakıf okulu adlarının önüne).
  const uni = (p: Prepared) => (/uni(v|w)/.test(p.name) ? 0 : 1);
  hits.sort((a, b) => a.r - b.r || uni(a.p) - uni(b.p) || a.p.name.length - b.p.name.length || a.p.index - b.p.index);
  return { items: hits.slice(0, limit).map((h) => h.p.item), more: hits.length > limit };
}

/**
 * Sorgunun her parçası ad, şehir, ülke ya da Erasmus kodunda geçmeli. Önce anlaşmalı okullar.
 * Boş sorguda anlaşmalı okulların hepsi (sınıra kadar) döner, diğer liste boş kalır.
 * Diğer liste, anlaşmalı okullarda da bulunan kurumları (aynı ad ya da aynı Erasmus kodu) içermez.
 */
export function searchUniversities(
  query: string,
  partners: readonly UniversityItem[],
  others: readonly UniversityItem[],
  limit = 50,
): UniversitySearchResult {
  const q = searchKey(query);
  const tokens = q.split(" ").filter(Boolean);
  const p = run(tokens, q, prepare(partners), limit);
  if (tokens.length === 0) return { partners: p.items, others: [], morePartners: p.more, moreOthers: false };

  const partnerNames = new Set(prepare(partners).map((x) => x.name));
  const partnerCodes = new Set(partners.map((x) => x.erasmusCode).filter((c): c is string => !!c));
  const o = run(
    tokens,
    q,
    prepare(others),
    limit,
    (x) => partnerNames.has(x.name) || (x.item.erasmusCode !== null && partnerCodes.has(x.item.erasmusCode)),
  );
  return { partners: p.items, others: o.items, morePartners: p.more, moreOthers: o.more };
}

/** Yazılan ad listedeki bir kurumla aynı mı (büyük/küçük harf ve aksan farkı gözetmeden). */
export function findUniversity(name: string, ...lists: readonly (readonly UniversityItem[])[]): UniversityItem | null {
  const key = foldForSearch(name);
  if (!key) return null;
  for (const list of lists) {
    const hit = list.find((u) => foldForSearch(u.name) === key);
    if (hit) return hit;
  }
  return null;
}

/** Sayfaya gidecek hafif liste: bölüm ve program bilgisi atılır. */
export function partnerItems(data: PartnersData | null): UniversityItem[] {
  return (data?.partners ?? []).map((p) => ({ name: p.name, country: p.country, city: p.city, erasmusCode: p.erasmusCode, isPartner: true }));
}

/** ECHE dosyasını doğrular; bozuk satırlar atlanır. */
export function echeItems(raw: unknown): UniversityItem[] {
  if (!Array.isArray(raw)) return [];
  const out: UniversityItem[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || !row[0].trim()) continue;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
    out.push({ name: row[0], country: str(row[1]), city: str(row[2]), erasmusCode: str(row[3]), isPartner: false });
  }
  return out;
}

/** "Almanya, Erasmus kodu D MUNCHEN02" gibi kısa açıklama; bilgi yoksa null. */
export function universityDetail(u: UniversityItem | null): string | null {
  if (!u) return null;
  const parts = [u.country, u.erasmusCode ? `Erasmus kodu ${u.erasmusCode}` : null].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

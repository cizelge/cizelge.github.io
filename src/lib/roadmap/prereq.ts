// Serbest yazılmış ön koşul metnini (Türkçe/İngilizce karışık) PrereqExpr ağacına çevirir.
// Emin olunamayan her parça "unknown" olur: sessizce yanlış yorumlamaktansa "bilinmiyor" demek daha iyi.
import { normalizeCode } from "../engine";
import type { PrereqExpr } from "./types";

type Token =
  | { t: "lp"; start: number; end: number }
  | { t: "rp"; start: number; end: number }
  | { t: "and"; start: number; end: number }
  | { t: "or"; start: number; end: number }
  | { t: "slash"; start: number; end: number }
  | { t: "atom"; expr: PrereqExpr; start: number; end: number; num?: string };

const UPPER = "A-ZÇĞİÖŞÜ";
const LOWER = "a-zçğıöşü";
const SUFFIX = `(?:['’][${LOWER}]+)?`; // "EE 341'den", "135 ECTS'yi"

const RE_SPACE = /\s+/y;
const RE_ECTS = new RegExp(`(\\d{1,3})\\s*(?:AKTS|ECTS)(?![\\p{L}\\d])${SUFFIX}`, "iuy");
const RE_CODE = new RegExp(
  `([${UPPER}]{2,5}|[${UPPER}][${LOWER}]{1,4})\\s?(\\d{3})([A-Z]|_[A-Z])?(?![\\p{L}\\d])${SUFFIX}`,
  "uy",
);
const RE_OP = /(and|ve|nad|or|veya)(?![\p{L}\d])/iuy;
const RE_NUM = /\d+(?:[.,]\d+)?/y;
const RE_WORD = /[\p{L}'’.]+/uy;
const RE_MASK = /\uE000+/y;

// Anlamı değiştirmeyen dolgu kelimeleri (küçük harfle).
const FILLER = new Set([
  "en", "az", "a", "min", "minimum", "at", "least", "having", "completed", "complete", "to",
  "tamamlamış", "tamamlamak", "tamamlama", "olmak", "olarak", "derslerini", "dersini", "dersinden",
  "başarı", "ile", "başarıyla", "başarılı", "başarmış", "geçmiş", "kredisi", "kredi", "credits", "credit",
  "akts", "ects",
]);

// "şu derslerden en az ikisi" gibi sayı seçimleri: çevreleyen parantez grubu (yoksa bütün metin) unknown.
const RE_QUANTIFIER =
  /en az (?:ikisi|biri|üçü|dördü|\d+ ?tane\S*)|\d+ tanesi\S*|of the following|at least (?:one|two|three|\d+) of/giu;

const lower = (s: string) => s.toLocaleLowerCase("tr");

/** "CS101l" -> "CS 101L"; normalizeCode kompakt anahtar verir, boşluğu geri koyarız. */
function formatCode(dept: string, num: string, suffix: string): string {
  const compact = normalizeCode(dept + num + suffix);
  const m = /^(\p{Lu}+)(\d{3}.*)$/u.exec(compact);
  return m ? `${m[1]} ${m[2]}` : compact;
}

/** Sayı seçimi içeren grupları aynı uzunlukta maske karakterleriyle örter; konumlar korunur. */
function maskQuantifiers(text: string): string | null {
  let out = text;
  for (const m of text.matchAll(RE_QUANTIFIER)) {
    const at = m.index;
    let depth = 0;
    let open = -1;
    for (let i = at - 1; i >= 0; i--) {
      if (text[i] === ")") depth++;
      else if (text[i] === "(") {
        if (depth === 0) { open = i; break; }
        depth--;
      }
    }
    if (open < 0) return null; // grup yok: bütün metin okunamaz
    depth = 0;
    let close = text.length - 1;
    for (let i = at; i < text.length; i++) {
      if (text[i] === "(") depth++;
      else if (text[i] === ")") {
        if (depth === 0) { close = i; break; }
        depth--;
      }
    }
    out = out.slice(0, open) + "\uE000".repeat(close - open + 1) + out.slice(close + 1);
  }
  return out;
}

function tokenize(src: string, original: string): Token[] {
  const tokens: Token[] = [];
  const unknown = (start: number, end: number): Token => ({
    t: "atom", expr: { kind: "unknown", text: original.slice(start, end).trim() }, start, end,
  });
  let i = 0;
  const at = (re: RegExp) => {
    re.lastIndex = i;
    return re.exec(src);
  };
  while (i < src.length) {
    let m: RegExpExecArray | null;
    const ch = src[i];
    if ((m = at(RE_SPACE))) { i += m[0].length; continue; }
    if (ch === "(") { tokens.push({ t: "lp", start: i, end: i + 1 }); i++; continue; }
    if (ch === ")") { tokens.push({ t: "rp", start: i, end: i + 1 }); i++; continue; }
    if (ch === "&" || ch === ",") { tokens.push({ t: "and", start: i, end: i + 1 }); i++; continue; }
    if (ch === "/") { tokens.push({ t: "slash", start: i, end: i + 1 }); i++; continue; }
    if ((m = at(RE_MASK))) { tokens.push(unknown(i, i + m[0].length)); i += m[0].length; continue; }
    if ((m = at(RE_ECTS))) {
      tokens.push({ t: "atom", expr: { kind: "minEcts", ects: Number(m[1]) }, start: i, end: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if ((m = at(RE_CODE)) && !FILLER.has(lower(m[1]))) {
      tokens.push({
        t: "atom", expr: { kind: "course", code: formatCode(m[1], m[2], m[3] ?? "") }, start: i, end: i + m[0].length,
      });
      i += m[0].length;
      continue;
    }
    if ((m = at(RE_OP))) {
      tokens.push({ t: /^(or|veya)$/i.test(m[1]) ? "or" : "and", start: i, end: i + m[0].length });
      i += m[0].length;
      continue;
    }
    if ((m = at(RE_NUM))) {
      const tok = unknown(i, i + m[0].length);
      if (/^\d{3}$/.test(m[0])) (tok as { num?: string }).num = m[0];
      tokens.push(tok);
      i += m[0].length;
      continue;
    }
    if ((m = at(RE_WORD))) {
      const word = lower(m[0]).replace(/^['’.]+|['’.]+$/g, "");
      if (!FILLER.has(word) && word !== "") tokens.push(unknown(i, i + m[0].length));
      i += m[0].length;
      continue;
    }
    // Tırnak, iki nokta vb. yok sayılır; "-" gibi anlamı belirsiz işaretler unknown.
    if (ch === "-") tokens.push(unknown(i, i + 1));
    i++;
  }
  // "SAS 103/105", "MKTG 502 or 802": "veya"dan sonra çıplak üç hane önceki dersin bölümünü alır
  // ("and 165 credits" gibi durumlar ders sanılmasın diye yalnız "veya").
  for (let k = 2; k < tokens.length; k++) {
    const cur = tokens[k];
    const prev = tokens[k - 2];
    if (cur.t === "atom" && cur.num && (tokens[k - 1].t === "or" || tokens[k - 1].t === "slash")
      && prev.t === "atom" && prev.expr.kind === "course") {
      const dept = prev.expr.code.split(" ")[0];
      cur.expr = { kind: "course", code: formatCode(dept, cur.num, "") };
    }
  }
  return tokens;
}

function simplify(kind: "and" | "or", items: PrereqExpr[]): PrereqExpr {
  const flat: PrereqExpr[] = [];
  for (const it of items) {
    if (it.kind === "none") continue;
    if (it.kind === kind) flat.push(...it.items);
    else flat.push(it);
  }
  if (flat.length === 0) return { kind: "none" };
  if (flat.length === 1) return flat[0];
  return { kind, items: flat };
}

/** Özyinelemeli iniş: or < and < "/" < yan yana (operatörsüz) < parantez. Dengesiz parantez tolere edilir. */
function parseTokens(tokens: Token[], original: string): PrereqExpr {
  // Eşi olmayan ")" için başa "(" eklenir: "MATH 217 or CE 217) and X" -> "(MATH 217 or CE 217) and X".
  let balance = 0;
  const openers: Token[] = [];
  for (const tok of tokens) {
    if (tok.t === "lp") balance++;
    else if (tok.t === "rp") {
      if (balance === 0) openers.push({ t: "lp", start: 0, end: 0 });
      else balance--;
    }
  }
  tokens = [...openers, ...tokens];
  let pos = 0;

  const parseOr = (depth: number): PrereqExpr => {
    const items = [parseAnd(depth)];
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok.t === "or") { pos++; items.push(parseAnd(depth)); continue; }
      if (tok.t === "rp") {
        if (depth > 0) break;
        pos++; // fazla kapanan parantez
        continue;
      }
      break;
    }
    return simplify("or", items);
  };

  const parseAnd = (depth: number): PrereqExpr => {
    const items = [parseSlash(depth)];
    while (pos < tokens.length && tokens[pos].t === "and") {
      pos++;
      items.push(parseSlash(depth));
    }
    return simplify("and", items);
  };

  // "MATH 102/MATH 103": eğik çizgi en sıkı bağlanan "veya"dır.
  const parseSlash = (depth: number): PrereqExpr => {
    const items = [parseJuxt(depth)];
    while (pos < tokens.length && tokens[pos].t === "slash") {
      pos++;
      items.push(parseJuxt(depth));
    }
    return simplify("or", items);
  };

  // Operatörsüz yan yana gelen işlenenler ("EE 433 almamış", "105 AKTS -(...)") tek unknown olur.
  const parseJuxt = (depth: number): PrereqExpr => {
    const parts: { expr: PrereqExpr; start: number; end: number }[] = [];
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok.t === "atom") {
        parts.push({ expr: tok.expr, start: tok.start, end: tok.end });
        pos++;
      } else if (tok.t === "lp") {
        pos++;
        const inner = parseOr(depth + 1);
        let end = tokens[pos - 1]?.end ?? tok.end;
        if (pos < tokens.length && tokens[pos].t === "rp") { end = tokens[pos].end; pos++; }
        if (inner.kind !== "none") parts.push({ expr: inner, start: tok.start, end });
      } else if (tok.t === "rp" && depth === 0) {
        pos++; // fazla kapanan parantez
      } else break;
    }
    if (parts.length === 0) return { kind: "none" };
    if (parts.length === 1) return parts[0].expr;
    return { kind: "unknown", text: original.slice(parts[0].start, parts[parts.length - 1].end).trim() };
  };

  let result = parseOr(0);
  // Arta kalan (ör. baştaki operatörler) varsa devam et.
  while (pos < tokens.length) {
    pos++;
    const rest = parseOr(0);
    result = simplify("and", [result, rest]);
  }
  return result;
}

export function parsePrerequisite(text: string): PrereqExpr {
  const original = text ?? "";
  if (original.trim() === "") return { kind: "none" };
  const masked = maskQuantifiers(original);
  if (masked === null) return { kind: "unknown", text: original.trim() };
  // "120 AKTS (ECTS)": açıklama parantezi atılır (uzunluk korunur).
  const src = masked.replace(/\(\s*(?:AKTS|ECTS)\s*\)/gi, (s) => " ".repeat(s.length));
  const expr = parseTokens(tokenize(src, original), original);
  if (expr.kind === "none" || expr.kind === "unknown") return { kind: "unknown", text: original.trim() };
  return expr;
}

export function evaluatePrerequisite(
  expr: PrereqExpr,
  passed: ReadonlySet<string>,
  passedEcts: number,
): boolean | null {
  switch (expr.kind) {
    case "none":
      return true;
    case "course":
      return passed.has(expr.code) || passed.has(normalizeCode(expr.code));
    case "minEcts":
      return passedEcts >= expr.ects;
    case "unknown":
      return null;
    case "and": {
      let sawNull = false;
      for (const it of expr.items) {
        const v = evaluatePrerequisite(it, passed, passedEcts);
        if (v === false) return false;
        if (v === null) sawNull = true;
      }
      return sawNull ? null : true;
    }
    case "or": {
      let sawNull = false;
      for (const it of expr.items) {
        const v = evaluatePrerequisite(it, passed, passedEcts);
        if (v === true) return true;
        if (v === null) sawNull = true;
      }
      return sawNull ? null : false;
    }
  }
}

export function prerequisiteCodes(expr: PrereqExpr): string[] {
  const out = new Set<string>();
  const walk = (e: PrereqExpr) => {
    if (e.kind === "course") out.add(e.code);
    else if (e.kind === "and" || e.kind === "or") e.items.forEach(walk);
  };
  walk(expr);
  return [...out];
}

export function hasUnknown(expr: PrereqExpr): boolean {
  if (expr.kind === "unknown") return true;
  if (expr.kind === "and" || expr.kind === "or") return expr.items.some(hasUnknown);
  return false;
}

import { describe, expect, it } from "vitest";
import { ALPHABET, cleanCode, CODE_LENGTH, isCode, makeCode, parseShare } from "./share.ts";

describe("makeCode", () => {
  it("altı haneli ve alfabeden", () => {
    const code = makeCode(() => 0.5);
    expect(code).toHaveLength(CODE_LENGTH);
    expect([...code].every((c) => ALPHABET.includes(c))).toBe(true);
  });

  it("karıştırılan harfleri içermez", () => {
    for (const bad of ["I", "O", "0", "1"]) expect(ALPHABET.includes(bad)).toBe(false);
  });
});

describe("cleanCode", () => {
  it("küçük harfi ve boşluğu düzeltir", () => {
    expect(cleanCode(" k7m4pq ")).toBe("K7M4PQ");
  });

  it("benzeyen harfleri kurtarır", () => {
    // O -> 0 -> Q, I/L -> 1 -> J
    expect(cleanCode("KOM4PI")).toBe("KQM4PJ");
  });

  it("uzunluk tutmazsa almaz", () => {
    expect(cleanCode("K7M4P")).toBeNull();
    expect(cleanCode("K7M4PQR")).toBeNull();
    expect(cleanCode(42)).toBeNull();
  });
});

describe("isCode", () => {
  it("yalnızca temiz kodu kabul eder", () => {
    expect(isCode("K7M4PQ")).toBe(true);
    expect(isCode("k7m4pq")).toBe(false);
    expect(isCode("K7M4P0")).toBe(false);
  });
});

describe("parseShare", () => {
  const valid = { kind: "program", data: "d=CS201,MATH211&kilit=CS201:A" };

  it("geçerli paylaşımı kabul eder", () => {
    const r = parseShare(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.share.kind).toBe("program");
  });

  it("dolu saat kodunu kabul eder", () => {
    expect(parseShare({ kind: "bos", data: "AAAAAPz_BwAAAA" })).toMatchObject({ ok: true });
  });

  it("bilinmeyen türü almaz", () => {
    expect(parseShare({ ...valid, kind: "baska" })).toMatchObject({ ok: false });
  });

  it("boş ya da çok uzun içeriği almaz", () => {
    expect(parseShare({ ...valid, data: "" })).toMatchObject({ ok: false });
    expect(parseShare({ ...valid, data: "a".repeat(2001) })).toMatchObject({ ok: false });
  });

  it("tehlikeli karakteri almaz", () => {
    expect(parseShare({ ...valid, data: "<script>" })).toMatchObject({ ok: false });
  });
});

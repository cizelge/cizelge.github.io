import { describe, expect, it } from "vitest";
import { EMPTY_STATE, parseState, planStart, serializeState, validateState, type RoadmapState } from "./storage";

const full: RoadmapState = {
  version: 1,
  anadal: "BSCS",
  cap: "BSEE",
  yandal: "yandal-matematik",
  start: { year: 2, season: "bahar" },
  completion: { "BSCS:y1-guz:0": true, "BSCS:y1-guz:4": "MATH 103" },
  grades: { "BSCS:y1-guz:0": "B+", "BSCS:y1-guz:2": "F" },
  maxCredits: 35,
};

describe("validateState", () => {
  it("geçerli durumu olduğu gibi döndürür", () => {
    expect(validateState(full)).toEqual(full);
  });

  it("biçim ya da sürüm yanlışsa boş durum", () => {
    for (const raw of [null, 3, "x", [], {}, { ...full, version: 2 }]) {
      expect(validateState(raw)).toEqual(EMPTY_STATE);
    }
  });

  it("bozuk alanları tek tek varsayılana çevirir", () => {
    const s = validateState({
      version: 1,
      anadal: 5,
      cap: "",
      yandal: null,
      start: { year: 1.5, season: "yaz" },
      completion: { a: true, b: false, c: "", d: "CS 101", e: 3 },
      grades: { a: "A", b: "E", c: 4 },
      maxCredits: 500,
    });
    expect(s).toEqual({ ...EMPTY_STATE, completion: { a: true, d: "CS 101" }, grades: { a: "A" } });
  });

  it("notları olmayan eski kaydı boş notlarla açar", () => {
    const { grades: _, ...old } = full;
    void _;
    expect(validateState(old).grades).toEqual({});
  });

  it("çift anadal anadalla aynıysa düşer", () => {
    expect(validateState({ ...full, cap: "BSCS" }).cap).toBeNull();
  });

  it("kredi sınırı yuvarlanır, sınır dışıysa 30", () => {
    expect(validateState({ ...full, maxCredits: 37.6 }).maxCredits).toBe(38);
    expect(validateState({ ...full, maxCredits: 5 }).maxCredits).toBe(30);
    expect(validateState({ ...full, maxCredits: Number.NaN }).maxCredits).toBe(30);
  });
});

describe("parseState / serializeState", () => {
  it("gidiş dönüş aynı", () => {
    expect(parseState(serializeState(full))).toEqual(full);
  });
  it("boş ya da bozuk metin boş durum verir", () => {
    expect(parseState(null)).toEqual(EMPTY_STATE);
    expect(parseState("{bozuk")).toEqual(EMPTY_STATE);
  });
  it("boş durum paylaşılan nesneyi değiştirmez", () => {
    const s = parseState(null);
    s.completion.x = true;
    expect(EMPTY_STATE.completion).toEqual({});
  });
});

describe("planStart", () => {
  it("şu an Güz", () => {
    expect(planStart({ startYear: 2026, season: "guz" }, "guz")).toEqual({ startYear: 2026, season: "guz" });
    expect(planStart({ startYear: 2026, season: "guz" }, "bahar")).toEqual({ startYear: 2026, season: "bahar" });
  });
  it("şu an Bahar: Güz bir sonraki akademik yıla kayar", () => {
    expect(planStart({ startYear: 2026, season: "bahar" }, "bahar")).toEqual({ startYear: 2026, season: "bahar" });
    expect(planStart({ startYear: 2026, season: "bahar" }, "guz")).toEqual({ startYear: 2027, season: "guz" });
  });
  it("şu an Yaz: bir sonraki akademik yıl", () => {
    expect(planStart({ startYear: 2026, season: "yaz" }, "bahar")).toEqual({ startYear: 2027, season: "bahar" });
  });
});

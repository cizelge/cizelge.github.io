import { describe, expect, it } from "vitest";
import {
  buildTermOptions,
  compareTerms,
  defaultTerm,
  parseTermLabel,
  termInfo,
  termPath,
  type TermInfo,
} from "./terms";

describe("parseTermLabel", () => {
  it("parses Özyeğin's own label", () => {
    expect(parseTermLabel("2026 - 2027 Güz")).toEqual({
      id: "2026-2027-guz",
      startYear: 2026,
      season: "guz",
      label: "2026 - 2027 Güz",
    });
  });

  it("normalises the inconsistent spacing around the dash", () => {
    expect(parseTermLabel("2026 -2027 Bahar")).toEqual({
      id: "2026-2027-bahar",
      startYear: 2026,
      season: "bahar",
      label: "2026 - 2027 Bahar",
    });
    expect(parseTermLabel("  2026-2027   yaz ").label).toBe("2026 - 2027 Yaz");
    expect(parseTermLabel("2026–2027 Güz").id).toBe("2026-2027-guz");
  });

  it("accepts any case and the ASCII spelling of Güz", () => {
    expect(parseTermLabel("2026 - 2027 GÜZ").season).toBe("guz");
    expect(parseTermLabel("2026 - 2027 guz").season).toBe("guz");
    expect(parseTermLabel("2026 - 2027 BAHAR").season).toBe("bahar");
  });

  it("rejects labels without a year range or season", () => {
    expect(() => parseTermLabel("Örnek veri, Güz")).toThrow(/Dönem adı okunamadı: "Örnek veri, Güz"/);
    expect(() => parseTermLabel("2026 - 2027")).toThrow(/okunamadı/);
    expect(() => parseTermLabel("2026 - 2027 Kış")).toThrow(/okunamadı/);
    expect(() => parseTermLabel("")).toThrow(/okunamadı/);
  });

  it("rejects year ranges that are not one academic year", () => {
    expect(() => parseTermLabel("2026 - 2028 Güz")).toThrow(/ardışık/);
    expect(() => parseTermLabel("2027 - 2026 Güz")).toThrow(/ardışık/);
  });
});

describe("compareTerms / defaultTerm", () => {
  const t = (label: string) => parseTermLabel(label);

  it("orders by start year, then güz < bahar < yaz", () => {
    const sorted = [t("2026 - 2027 Yaz"), t("2027 - 2028 Güz"), t("2026 - 2027 Güz"), t("2026 - 2027 Bahar")]
      .sort(compareTerms)
      .map((x) => x.id);
    expect(sorted).toEqual(["2026-2027-guz", "2026-2027-bahar", "2026-2027-yaz", "2027-2028-guz"]);
  });

  it("picks the latest term as default", () => {
    expect(defaultTerm([t("2026 - 2027 Bahar"), t("2026 - 2027 Güz")]).id).toBe("2026-2027-bahar");
    expect(() => defaultTerm([])).toThrow();
  });
});

describe("termInfo / termPath", () => {
  it("builds a term from year and season", () => {
    expect(termInfo(2026, "yaz")).toEqual({ id: "2026-2027-yaz", startYear: 2026, season: "yaz", label: "2026 - 2027 Yaz" });
  });

  it("routes the default term to the school page and others under donem", () => {
    expect(termPath("ozyegin", { id: "2026-2027-guz", isDefault: true })).toBe("/ozyegin");
    expect(termPath("ozyegin", { id: "2026-2027-guz", isDefault: false })).toBe("/ozyegin/donem/2026-2027-guz");
  });
});

describe("buildTermOptions", () => {
  const t = (label: string): TermInfo => parseTermLabel(label);

  it("with only Güz available, lists Güz, Bahar and Yaz with Güz as default", () => {
    expect(buildTermOptions([t("2026 - 2027 Güz")])).toEqual([
      { id: "2026-2027-guz", label: "2026 - 2027 Güz", available: true, isDefault: true },
      { id: "2026-2027-bahar", label: "2026 - 2027 Bahar", available: false, isDefault: false },
      { id: "2026-2027-yaz", label: "2026 - 2027 Yaz", available: false, isDefault: false },
    ]);
  });

  it("makes the latest term the default and appends terms of other years after the three", () => {
    const options = buildTermOptions([t("2026 - 2027 Güz"), t("2025 - 2026 Yaz"), t("2026 -2027 Bahar"), t("2025 - 2026 Güz")]);
    expect(options.map((o) => [o.id, o.available, o.isDefault])).toEqual([
      ["2026-2027-guz", true, false],
      ["2026-2027-bahar", true, true],
      ["2026-2027-yaz", false, false],
      ["2025-2026-guz", true, false],
      ["2025-2026-yaz", true, false],
    ]);
  });

  it("returns nothing when no term is available", () => {
    expect(buildTermOptions([])).toEqual([]);
  });
});

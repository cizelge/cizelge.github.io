import { describe, expect, it } from "vitest";
import { recentTerms, termLabel } from "./types";

describe("termLabel", () => {
  it("dönem kodunu okunur yazar", () => {
    expect(termLabel("2025-2026-guz")).toBe("2025-2026 Güz");
    expect(termLabel("2024-2025-bahar")).toBe("2024-2025 Bahar");
  });
});

describe("recentTerms", () => {
  it("eylülde içinde bulunulan güz dönemiyle başlar", () => {
    expect(recentTerms(new Date("2026-09-19T00:00:00Z"), 4)).toEqual([
      "2026-2027-guz",
      "2025-2026-yaz",
      "2025-2026-bahar",
      "2025-2026-guz",
    ]);
  });

  it("martta bahar dönemiyle başlar", () => {
    expect(recentTerms(new Date("2026-03-10T00:00:00Z"), 3)).toEqual([
      "2025-2026-bahar",
      "2025-2026-guz",
      "2024-2025-yaz",
    ]);
  });

  it("temmuzda yaz dönemiyle başlar", () => {
    expect(recentTerms(new Date("2026-07-10T00:00:00Z"), 2)).toEqual(["2025-2026-yaz", "2025-2026-bahar"]);
  });

  it("istenen kadar dönem verir", () => {
    expect(recentTerms(new Date("2026-09-19T00:00:00Z"), 9)).toHaveLength(9);
  });
});

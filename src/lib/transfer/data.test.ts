import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import transferJson from "../../../data/ozyegin/transfer.json";
import type { QuotaByYear, ScoreType, TransferData } from "./types";

const data = transferJson as TransferData;
const programIds = new Set(programsData.programs.map((p) => p.id));

const SCORE_TYPES: ScoreType[] = ["SAY", "EA", "SÖZ", "DİL"];
const SCHOLARSHIPS = ["tam", "yuzde50", "yuzde25", "ucretli", "diger"];
const QUOTA_KEYS = ["hazirlik", "1", "2", "3", "4"];

const isQuota = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;

function sumQuota(key: keyof QuotaByYear, field: "internalQuota" | "centralQuota") {
  return data.programs.reduce((s, p) => s + (p[field]?.[key] ?? 0), 0);
}

describe("data/ozyegin/transfer.json", () => {
  it("has the top-level shape", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(Number.isNaN(Date.parse(data.fetchedAt))).toBe(false);
    expect(data.applicationTerm).toBe("2026-2027 Güz");
    expect(data.sources.length).toBeGreaterThan(0);
    for (const s of data.sources) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.url).not.toContain("sis.ozyegin.edu.tr");
    }
    expect(data.programs.length).toBeGreaterThan(0);
  });

  it("has the published rules", () => {
    const r = data.rules;
    expect(r.capMinGpa).toBe(2.72);
    expect(r.yandalMinGpa).toBe(2.5);
    expect(r.capCreditsBySemester).toEqual([
      { semester: 3, minCredits: 48 },
      { semester: 4, minCredits: 84 },
      { semester: 5, minCredits: 120 },
    ]);
    expect(r.capSemesters).toEqual({ min: 3, max: 5 });
    expect(r.internalSemesters).toEqual({ min: 2, max: 5 });
  });

  it("maps programIds to programs.json or null, without duplicates", () => {
    const seen = new Set<string>();
    for (const p of data.programs) {
      if (p.programId !== null) {
        expect(programIds.has(p.programId), p.programId).toBe(true);
        expect(seen.has(p.programId), p.programId).toBe(false);
        seen.add(p.programId);
      }
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.faculty.length).toBeGreaterThan(0);
      if (p.scoreType !== null) expect(SCORE_TYPES).toContain(p.scoreType);
      expect(typeof p.capOpen).toBe("boolean");
      expect(Array.isArray(p.notes)).toBe(true);
      for (const n of p.notes) expect(typeof n).toBe("string");
    }
  });

  it("has non-negative integer quotas with valid keys", () => {
    for (const p of data.programs) {
      for (const q of [p.internalQuota, p.centralQuota]) {
        if (q === null) continue;
        for (const [k, v] of Object.entries(q)) {
          expect(QUOTA_KEYS, `${p.name} ${k}`).toContain(k);
          expect(isQuota(v), `${p.name} ${k}=${v}`).toBe(true);
        }
      }
      for (const b of p.baseScores) {
        if (b.quota !== null) expect(isQuota(b.quota), `${p.name} ${b.year}`).toBe(true);
      }
    }
  });

  it("internal quota totals equal the TOPLAM row on the kurum-ici page", () => {
    // Stated on ozyegin.edu.tr .../kurum-ici-basariya-gore-yatay (2026-2027 Güz): TOPLAM 207 (2. sınıf), 194 (3. sınıf).
    // (The page's own faculty subtotals for İşletme and Mimarlık-Tasarım at 3. sınıf do not add up; the program rows do.)
    expect(sumQuota("2", "internalQuota")).toBe(207);
    expect(sumQuota("3", "internalQuota")).toBe(194);
  });

  it("central (Ek Madde-1) quota totals equal the TOPLAM row on the merkezi-yerlestirme page", () => {
    // Stated on ozyegin.edu.tr .../merkezi-yerlestirme-puani-ile (2026-2027 Güz): TOPLAM 429/429/424/424/404.
    expect(sumQuota("hazirlik", "centralQuota")).toBe(429);
    expect(sumQuota("1", "centralQuota")).toBe(429);
    expect(sumQuota("2", "centralQuota")).toBe(424);
    expect(sumQuota("3", "centralQuota")).toBe(424);
    expect(sumQuota("4", "centralQuota")).toBe(404);
  });

  it("has plausible base scores and ranks", () => {
    for (const p of data.programs) {
      for (const b of p.baseScores) {
        const where = `${p.name} ${b.year} ${b.scholarshipLabel}`;
        expect(Number.isInteger(b.year), where).toBe(true);
        expect(b.year, where).toBeGreaterThanOrEqual(2019);
        expect(SCHOLARSHIPS, where).toContain(b.scholarship);
        expect(b.scholarshipLabel.length, where).toBeGreaterThan(0);
        for (const s of [b.minScore, b.maxScore]) {
          if (s === null) continue;
          expect(s, where).toBeGreaterThanOrEqual(100);
          expect(s, where).toBeLessThanOrEqual(600);
        }
        for (const r of [b.minRank, b.maxRank]) {
          if (r === null) continue;
          expect(Number.isInteger(r) && r > 0, where).toBe(true);
        }
        if (b.minScore !== null && b.maxScore !== null) expect(b.minScore, where).toBeLessThanOrEqual(b.maxScore);
        if (b.minRank !== null && b.maxRank !== null) expect(b.minRank, where).toBeGreaterThanOrEqual(b.maxRank);
      }
    }
  });

  it("has well-formed ÇAP rank rules and closed programmes", () => {
    for (const p of data.programs) {
      for (const r of [...p.capRankRules, ...p.internalRankRules, ...p.centralRankRules]) {
        expect(SCORE_TYPES).toContain(r.scoreType);
        expect(Number.isInteger(r.maxRank) && r.maxRank > 0).toBe(true);
        if (r.fromYear !== null && r.toYear !== null) expect(r.fromYear).toBeLessThanOrEqual(r.toYear);
        expect(r.text.length).toBeGreaterThan(0);
      }
    }
    const withTransferRank = data.programs.filter((p) => p.internalRankRules.length > 0).map((p) => p.programId).sort();
    expect(withTransferRank).toEqual(["BLAW", "BSAI", "BSARCH (ENG)", "BSCE", "BSCS", "BSEE", "BSIE", "BSME"]);
    const closed = data.programs.filter((p) => !p.capOpen).map((p) => p.programId).sort();
    expect(closed).toEqual(["BSGARM", "BSPLT"]);
  });
});

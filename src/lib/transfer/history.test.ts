import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import historyJson from "../../../data/ozyegin/transfer-history.json";
import { historyFor, summary, type TransferHistoryData } from "./history";

const fixture: TransferHistoryData = {
  schoolId: "test",
  fetchedAt: "2026-01-01T00:00:00Z",
  sources: [],
  terms: [
    {
      term: "2022-2023 Güz",
      termCode: "202210",
      path: "cap",
      programs: [
        { programId: "BSCS", name: "Bilgisayar Mühendisliği", applications: 10, firstChoice: 8, accepted: 2, conditional: 1, rejected: 7, other: 0 },
        { programId: null, name: "Kamu Hukuku", applications: 3, firstChoice: 3, accepted: 3, conditional: 0, rejected: 0, other: 0 },
      ],
    },
    {
      term: "2023-2024 Bahar",
      termCode: "202320",
      path: "cap",
      programs: [
        { programId: "BSCS", name: "Bilgisayar Mühendisliği", applications: 0, firstChoice: 0, accepted: 0, conditional: 0, rejected: 0, other: 0 },
      ],
    },
    {
      term: "2023-2024 Güz",
      termCode: "202310",
      path: "cap",
      programs: [
        { programId: "BSCS", name: "Bilgisayar Mühendisliği", applications: 20, firstChoice: null, accepted: 5, conditional: 0, rejected: 14, other: 1 },
      ],
    },
    {
      term: "2023-2024 Güz",
      termCode: "202310",
      path: "yandal",
      programs: [
        { programId: "BSCS", name: "Bilgisayar Mühendisliği", applications: 30, firstChoice: 20, accepted: 30, conditional: 0, rejected: 0, other: 0 },
      ],
    },
  ],
};

describe("historyFor", () => {
  it("returns the programme's rows for one path, newest first, with rate", () => {
    const rows = historyFor("BSCS", "cap", fixture);
    expect(rows.map((r) => r.termCode)).toEqual(["202320", "202310", "202210"]);
    expect(rows[0].rate).toBeNull();
    expect(rows[1].rate).toBeCloseTo(5 / 20);
    expect(rows[1].firstChoice).toBeNull();
    expect(rows[2].rate).toBeCloseTo(3 / 10);
    expect(rows[2].term).toBe("2022-2023 Güz");
  });

  it("returns nothing for an unknown programme or a path without data", () => {
    expect(historyFor("NOPE", "cap", fixture)).toEqual([]);
    expect(historyFor("BSCS", "central", fixture)).toEqual([]);
  });
});

describe("summary", () => {
  it("sums all terms", () => {
    expect(summary("BSCS", "cap", fixture)).toEqual({
      terms: 3,
      applications: 30,
      accepted: 7,
      conditional: 1,
      rejected: 21,
      rate: 8 / 30,
    });
  });

  it("has a null rate when there are no applications", () => {
    expect(summary("NOPE", "yandal", fixture)).toEqual({
      terms: 0,
      applications: 0,
      accepted: 0,
      conditional: 0,
      rejected: 0,
      rate: null,
    });
  });
});

describe("data/ozyegin/transfer-history.json", () => {
  const data = historyJson as TransferHistoryData;
  const programIds = new Set(programsData.programs.map((p) => p.id));
  const PATHS = ["cap", "yandal", "internal", "central"];

  it("has the top-level shape", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(Number.isNaN(Date.parse(data.fetchedAt))).toBe(false);
    expect(data.terms.length).toBeGreaterThan(0);
    expect(data.sources.length).toBeGreaterThan(0);
    for (const s of data.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(PATHS).toContain(s.path);
      expect(data.terms.some((t) => t.term === s.term && t.path === s.path)).toBe(true);
    }
  });

  it("has unique, well-formed terms", () => {
    const seen = new Set<string>();
    for (const t of data.terms) {
      expect(PATHS).toContain(t.path);
      expect(t.termCode).toMatch(/^20\d\d(10|20)$/);
      const y = Number(t.termCode.slice(0, 4));
      const season = t.termCode.endsWith("10") ? "Güz" : "Bahar";
      expect(t.term).toBe(`${y}-${y + 1} ${season}`);
      const k = `${t.termCode}/${t.path}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
      expect(t.programs.length).toBeGreaterThan(0);
      expect(data.sources.some((s) => s.term === t.term && s.path === t.path)).toBe(true);
    }
  });

  it("has non-negative, consistent counts and valid programme ids", () => {
    for (const t of data.terms) {
      const ids = new Set<string>();
      for (const p of t.programs) {
        for (const n of [p.applications, p.accepted, p.conditional, p.rejected, p.other]) {
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
        }
        expect(p.accepted + p.conditional + p.rejected + p.other).toBe(p.applications);
        if (p.firstChoice !== null) {
          expect(Number.isInteger(p.firstChoice)).toBe(true);
          expect(p.firstChoice).toBeGreaterThanOrEqual(0);
          expect(p.firstChoice).toBeLessThanOrEqual(p.applications);
        }
        expect(p.applications).toBeGreaterThan(0);
        if (p.programId !== null) {
          expect(programIds.has(p.programId)).toBe(true);
          expect(ids.has(p.programId)).toBe(false);
          ids.add(p.programId);
        }
        expect(p.name.length).toBeGreaterThan(0);
      }
      // Either every programme has a preference count or none does (one PDF per term/path).
      const withPref = t.programs.filter((p) => p.firstChoice !== null).length;
      expect([0, t.programs.length]).toContain(withPref);
    }
  });

  it("contains no personal data", () => {
    const allowedKeys = new Set([
      "schoolId", "fetchedAt", "sources", "terms", "term", "termCode", "path", "url", "programs",
      "programId", "name", "applications", "firstChoice", "accepted", "conditional", "rejected", "other",
    ]);
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) return v.forEach(walk);
      if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          expect(allowedKeys.has(k)).toBe(true);
          walk(x);
        }
      }
    };
    walk(data);
    const text = JSON.stringify(data);
    expect(text).not.toMatch(/\*\*/); // masked IDs / names
    expect(text).not.toMatch(/\b\d{11}\b/); // TC kimlik no
    expect(text).not.toMatch(/\bS0\d{5}\b/); // student numbers
    expect(text).not.toMatch(/"(tc|tcNo|studentNo|studentId|fullName|surname|ad|soyad)"/i);
    // Programme names only: every name is either mapped or a known unmapped programme label.
    for (const t of data.terms) {
      for (const p of t.programs) {
        expect(p.name).not.toMatch(/\d{5,}|\*/);
        if (p.programId === null) {
          expect(p.name).toMatch(/Hukuk|Law|Mimarlık|Architecture|Program|Yandal|Minor|Lisans|[a-zçğıöşü]{4,}/i);
        }
      }
    }
  });
});

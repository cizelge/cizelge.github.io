import { describe, expect, it } from "vitest";
import { evaluateAll, evaluateCap, evaluateCentral, evaluateInternal, targetYearLevel } from "./eligibility";
import type { BaseScore, StudentProfile, TransferData, TransferProgram } from "./types";

const base = (year: number, scholarship: BaseScore["scholarship"], minScore: number | null): BaseScore => ({
  year,
  scholarship,
  scholarshipLabel: scholarship,
  quota: 10,
  minScore,
  maxScore: null,
  minRank: null,
  maxRank: null,
});

const program = (over: Partial<TransferProgram>): TransferProgram => ({
  programId: "BSCS",
  name: "Bilgisayar Mühendisliği",
  faculty: "Mühendislik",
  scoreType: "SAY",
  baseScores: [base(2025, "tam", 500.5), base(2025, "ucretli", 400.12345), base(2025, "yuzde50", null), base(2024, "tam", 480)],
  internalQuota: { "2": 3, "3": 0 },
  centralQuota: { "1": 2, "2": 4 },
  capOpen: true,
  capRankRules: [],
  internalRankRules: [],
  centralRankRules: [],
  notes: [],
  ...over,
});

const data: TransferData = {
  schoolId: "ozyegin",
  fetchedAt: "2026-09-01",
  applicationTerm: "2026-2027 Güz",
  sources: [],
  rules: {
    capMinGpa: 2.72,
    capCreditsBySemester: [
      { semester: 3, minCredits: 48 },
      { semester: 4, minCredits: 84 },
      { semester: 5, minCredits: 120 },
    ],
    capSemesters: { min: 3, max: 5 },
    internalSemesters: { min: 2, max: 5 },
    yandalMinGpa: 2.5,
  },
  programs: [],
};

const profile = (over: Partial<StudentProfile> = {}): StudentProfile => ({
  programId: "BSEE",
  gpa: 3,
  completedSemesters: 2,
  completedCredits: 60,
  hasFailedCourse: false,
  entryYear: 2025,
  scoreType: "SAY",
  score: 450,
  rank: 50000,
  top20: true,
  ...over,
});

const check = (r: { checks: { id: string; status: string; text: string }[] }, id: string) => r.checks.find((c) => c.id === id);

describe("targetYearLevel", () => {
  it("dönemden sınıfa", () => {
    expect(targetYearLevel(profile({ completedSemesters: null }))).toBeNull();
    expect(targetYearLevel(profile({ completedSemesters: 1 }))).toBeNull();
    expect(targetYearLevel(profile({ completedSemesters: 2 }))).toBe("2");
    expect(targetYearLevel(profile({ completedSemesters: 3 }))).toBe("2");
    expect(targetYearLevel(profile({ completedSemesters: 4 }))).toBe("3");
    expect(targetYearLevel(profile({ completedSemesters: 5 }))).toBe("3");
    expect(targetYearLevel(profile({ completedSemesters: 6 }))).toBe("4");
    expect(targetYearLevel(profile({ completedSemesters: 8 }))).toBeNull();
  });
});

describe("evaluateInternal", () => {
  it("dönem sınırları", () => {
    expect(check(evaluateInternal(program({}), profile({ completedSemesters: 1 }), data), "semesters")?.status).toBe("fail");
    expect(check(evaluateInternal(program({}), profile({ completedSemesters: 6 }), data), "semesters")?.status).toBe("fail");
    expect(check(evaluateInternal(program({}), profile({ completedSemesters: 5 }), data), "semesters")?.status).toBe("ok");
    expect(check(evaluateInternal(program({}), profile({ completedSemesters: null }), data), "semesters")?.status).toBe("unknown");
  });

  it("eşdeğer taban puanı her zaman unknown, en iyi durum unknown", () => {
    const r = evaluateInternal(program({}), profile(), data);
    expect(check(r, "score")).toEqual({
      id: "score",
      status: "unknown",
      text: "Türkiye'deki eşdeğer programların en düşük taban puanı bu sitede yok; ÖSYM/YÖK Atlas'tan kontrol et.",
    });
    expect(r.status).toBe("unknown");
    expect(r.quota).toBe(3);
    expect(check(r, "quota")?.status).toBe("ok");
    expect(check(r, "notes")).toBeUndefined();
  });

  it("puan türü farklıysa fail", () => {
    const r = evaluateInternal(program({}), profile({ scoreType: "EA" }), data);
    expect(check(r, "scoreType")?.status).toBe("fail");
    expect(check(r, "scoreType")?.text).toContain("Puan türün farklı");
    expect(r.status).toBe("fail");
  });

  it("kontenjan: 0 fail, anahtar yok unknown, tablo yok unknown", () => {
    expect(check(evaluateInternal(program({}), profile({ completedSemesters: 4 }), data), "quota")?.status).toBe("fail");
    expect(evaluateInternal(program({}), profile({ completedSemesters: 4 }), data).quota).toBe(0);
    const r = evaluateInternal(program({ internalQuota: { "2": 3 } }), profile({ completedSemesters: 4 }), data);
    expect(check(r, "quota")?.status).toBe("unknown");
    expect(r.quota).toBeNull();
    expect(check(evaluateInternal(program({ internalQuota: null }), profile(), data), "quota")?.status).toBe("unknown");
    expect(check(evaluateInternal(program({}), profile({ completedSemesters: null }), data), "quota")?.status).toBe("unknown");
  });

  it("bölüme özel notlar unknown ekler", () => {
    const r = evaluateInternal(program({ notes: ["2027'den itibaren MATH 101 en az B"] }), profile(), data);
    expect(check(r, "notes")?.status).toBe("unknown");
  });
});

describe("evaluateCentral", () => {
  it("o yılın en düşük tabanı (burs türlerinin en düşüğü) ile fark", () => {
    const r = evaluateCentral(program({}), profile({ score: 450 }), data);
    expect(check(r, "score")?.status).toBe("ok");
    expect(r.scoreMargin).toBeCloseTo(49.87655, 5);
    expect(check(r, "score")?.text).toContain("400,12345");
    expect(check(r, "score")?.text).toContain("2025");
  });

  it("taban altında fail, negatif fark", () => {
    const r = evaluateCentral(program({}), profile({ entryYear: 2024, score: 470 }), data);
    expect(check(r, "score")?.status).toBe("fail");
    expect(r.scoreMargin).toBe(-10);
    expect(r.status).toBe("fail");
  });

  it("yılın verisi yoksa unknown", () => {
    const r = evaluateCentral(program({}), profile({ entryYear: 2023 }), data);
    expect(check(r, "score")).toMatchObject({ status: "unknown", text: "2023 taban puanı veride yok." });
    expect(r.scoreMargin).toBeNull();
  });

  it("puan türü farklıysa fail ve fark yok", () => {
    const r = evaluateCentral(program({}), profile({ scoreType: "EA" }), data);
    expect(check(r, "scoreType")?.status).toBe("fail");
    expect(r.scoreMargin).toBeNull();
    expect(r.status).toBe("fail");
  });

  it("boş alanlar unknown", () => {
    const r = evaluateCentral(program({}), profile({ scoreType: null, score: null }), data);
    expect(check(r, "scoreType")?.status).toBe("unknown");
    expect(check(r, "score")?.status).toBe("unknown");
    expect(r.scoreMargin).toBeNull();
  });

  it("kontenjan: 0-1 dönem -> 1. sınıf, sonra targetYearLevel", () => {
    const ok = evaluateCentral(program({}), profile({ completedSemesters: 0 }), data);
    expect(ok.quota).toBe(2);
    expect(ok.status).toBe("ok");
    expect(evaluateCentral(program({}), profile({ completedSemesters: 1 }), data).quota).toBe(2);
    expect(evaluateCentral(program({}), profile({ completedSemesters: 3 }), data).quota).toBe(4);
    expect(check(evaluateCentral(program({}), profile({ completedSemesters: 4 }), data), "quota")?.status).toBe("unknown");
  });
});

describe("evaluateCap", () => {
  const capProfile = (over: Partial<StudentProfile> = {}) => profile({ completedSemesters: 3, completedCredits: 90, ...over });

  it("tüm şartlar tamam", () => {
    const r = evaluateCap(program({}), capProfile(), data);
    expect(r.status).toBe("ok");
    expect(r.path).toBe("cap");
    expect(check(r, "credits")?.text).toBe("84 AKTS gerekiyor, 90 AKTS tamamladın.");
  });

  it("kapalı bölüm ve kendi bölümü fail", () => {
    expect(evaluateCap(program({ capOpen: false }), capProfile(), data).status).toBe("fail");
    const self = evaluateCap(program({}), capProfile({ programId: "BSCS" }), data);
    expect(check(self, "self")?.status).toBe("fail");
  });

  it("ortalama", () => {
    expect(check(evaluateCap(program({}), capProfile({ gpa: 2.72 }), data), "gpa")?.status).toBe("ok");
    const low = check(evaluateCap(program({}), capProfile({ gpa: 2.7 }), data), "gpa");
    expect(low?.status).toBe("fail");
    expect(low?.text).toContain("2,72");
    expect(low?.text).toContain("2,70");
    const none = check(evaluateCap(program({}), capProfile({ gpa: null }), data), "gpa");
    expect(none?.status).toBe("unknown");
    expect(none?.text).toContain("Ortalamanı gir.");
  });

  it("dönem ve AKTS", () => {
    expect(check(evaluateCap(program({}), capProfile({ completedSemesters: 1 }), data), "semesters")?.status).toBe("fail");
    expect(check(evaluateCap(program({}), capProfile({ completedSemesters: 5 }), data), "semesters")?.status).toBe("fail");
    expect(check(evaluateCap(program({}), capProfile({ completedSemesters: 2, completedCredits: 48 }), data), "credits")?.status).toBe(
      "ok",
    );
    expect(check(evaluateCap(program({}), capProfile({ completedSemesters: 4, completedCredits: 119 }), data), "credits")?.status).toBe(
      "fail",
    );
    expect(check(evaluateCap(program({}), capProfile({ completedCredits: null }), data), "credits")?.status).toBe("unknown");
    expect(check(evaluateCap(program({}), capProfile({ completedSemesters: null }), data), "credits")?.status).toBe("unknown");
  });

  it("kaldığı ders", () => {
    expect(check(evaluateCap(program({}), capProfile({ hasFailedCourse: true }), data), "failed")?.status).toBe("fail");
    expect(check(evaluateCap(program({}), capProfile({ hasFailedCourse: null }), data), "failed")?.status).toBe("unknown");
  });

  describe("ilk %20 ve başarı sırası", () => {
    const rules: TransferProgram["capRankRules"] = [
      { scoreType: "SAY", maxRank: 125000, fromYear: 2023, toYear: 2024, text: "2023-2024 SAY 125.000" },
      { scoreType: "SAY", maxRank: 100000, fromYear: 2025, toYear: null, text: "2025 ve sonrası SAY 100.000" },
    ];
    const rank = (over: Partial<StudentProfile>) => check(evaluateCap(program({ capRankRules: rules }), capProfile(over), data), "rank");

    it("top20 true ok; kural yoksa top20 false fail, null unknown", () => {
      expect(check(evaluateCap(program({}), capProfile({ top20: true }), data), "rank")?.status).toBe("ok");
      expect(check(evaluateCap(program({}), capProfile({ top20: false }), data), "rank")?.status).toBe("fail");
      expect(check(evaluateCap(program({}), capProfile({ top20: null }), data), "rank")?.status).toBe("unknown");
    });

    it("yıl pencereleri", () => {
      // 2024 kaydı: 120.000 ilk kurala uyar
      expect(rank({ top20: false, entryYear: 2024, rank: 120000 })?.status).toBe("ok");
      // 2025 kaydı: 120.000 ikinci kurala uymaz, ilk kuralın penceresi dışında
      expect(rank({ top20: false, entryYear: 2025, rank: 120000 })?.status).toBe("fail");
      expect(rank({ top20: false, entryYear: 2025, rank: 90000 })?.status).toBe("ok");
      expect(rank({ top20: false, entryYear: 2022, rank: 1000 })?.status).toBe("fail");
      // top20 null ama kural geçiyor: ok
      expect(rank({ top20: null, entryYear: 2026, rank: 90000 })?.status).toBe("ok");
    });

    it("eksik bilgi unknown, farklı puan türü fail", () => {
      expect(rank({ top20: false, entryYear: null, rank: 90000 })?.status).toBe("unknown");
      expect(rank({ top20: false, rank: null })?.status).toBe("unknown");
      expect(rank({ top20: false, scoreType: "EA", rank: 10 })?.status).toBe("fail");
    });

    it("sınırsız pencere", () => {
      const open = [{ scoreType: "EA" as const, maxRank: 50000, fromYear: null, toYear: null, text: "EA 50.000" }];
      const r = evaluateCap(program({ capRankRules: open }), capProfile({ top20: false, scoreType: "EA", entryYear: null, rank: 40000 }), data);
      expect(check(r, "rank")?.status).toBe("ok");
    });
  });
});

describe("evaluateAll", () => {
  it("kendi programını çıkarır ve sıralar", () => {
    const programs = [
      program({ programId: "BSEE", name: "Elektrik-Elektronik Mühendisliği" }),
      program({ programId: "GAST", name: "Gastronomi", capOpen: false }),
      program({ programId: "PSY", name: "Psikoloji", capRankRules: [], notes: [] }),
      program({ programId: "IE", name: "Endüstri Mühendisliği" }),
      program({ programId: "ARCH", name: "Çizim", capOpen: true }),
      program({ programId: null, name: "İşletme", capOpen: false }),
    ];
    // Açık bölümlerde ÇAP ok; kapalılarda ÇAP fail, kurum içi unknown
    const p = profile({ programId: "BSEE", completedSemesters: 3, completedCredits: 90, top20: true });
    const all = evaluateAll(p, { ...data, programs });
    expect(all.map((r) => r.program.name)).toEqual(["Çizim", "Endüstri Mühendisliği", "Psikoloji", "Gastronomi", "İşletme"]);
    expect(all[0].cap.status).toBe("ok");

    // ok > unknown > fail
    const mixed = evaluateAll(profile({ programId: "X", completedSemesters: 3, completedCredits: 90, top20: null }), {
      ...data,
      programs: [program({ name: "B", capOpen: false }), program({ name: "C", capOpen: false, internalQuota: { "2": 0 } }), program({ name: "A" })],
    });
    // A: cap unknown; B: cap fail, internal unknown; C: cap fail, internal fail
    expect(mixed.map((r) => r.program.name)).toEqual(["A", "B", "C"]);
    expect(mixed[2].internal.status).toBe("fail");
  });
});

describe("required rank rules for transfer paths", () => {
  const rule = (maxRank: number, fromYear: number | null, toYear: number | null) => ({
    scoreType: "SAY" as const,
    maxRank,
    fromYear,
    toYear,
    text: "",
  });
  const target = program({ internalRankRules: [rule(300000, 2021, null)], centralRankRules: [rule(300000, 2019, null)] });
  const rankCheck = (r: ReturnType<typeof evaluateInternal>) => r.checks.find((c) => c.id === "rank");

  it("fails a transfer path when the rank is worse than required", () => {
    const p = profile({ rank: 400000 });
    expect(rankCheck(evaluateInternal(target, p, data))?.status).toBe("fail");
    const central = evaluateCentral(target, p, data);
    expect(rankCheck(central)?.status).toBe("fail");
    expect(central.status).toBe("fail");
  });

  it("passes when the rank is good enough", () => {
    expect(rankCheck(evaluateCentral(target, profile({ rank: 250000 }), data))?.status).toBe("ok");
  });

  it("ignores rules outside the entry-year window and asks for missing inputs", () => {
    expect(rankCheck(evaluateInternal(target, profile({ entryYear: 2020, rank: 900000 }), data))).toBeUndefined();
    expect(rankCheck(evaluateInternal(target, profile({ entryYear: null }), data))?.status).toBe("unknown");
    expect(rankCheck(evaluateCentral(target, profile({ rank: null }), data))?.status).toBe("unknown");
  });
});

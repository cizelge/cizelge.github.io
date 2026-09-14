import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import guzData from "../../../data/ozyegin/2026-2027-guz.json";
import baharData from "../../../data/ozyegin/2026-2027-bahar.json";
import type { ProgramsData, TermData } from "../types";
import type { TermSeason } from "../terms";
import { buildOfferingMap } from "./offering";
import { buildPlan, planTermLabel, type PrereqApi } from "./plan";
import { canonicalCode } from "./progress";
import { programRequirements } from "./requirements";
import type { PrereqExpr, Requirement, RoadmapProgram } from "./types";

// Sahte ön koşul okuyucu: "A 1 and B 2", "A 1 or B 2", "ECTS 30", "?" (okunamaz).
const fake: PrereqApi = {
  parse(text) {
    const t = text.trim();
    if (!t) return { kind: "none" };
    if (t.includes("?")) return { kind: "unknown", text: t };
    const m = t.match(/^ECTS (\d+)$/);
    if (m) return { kind: "minEcts", ects: Number(m[1]) };
    if (t.includes(" or ")) return { kind: "or", items: t.split(" or ").map((code) => ({ kind: "course", code })) };
    return { kind: "and", items: t.split(" and ").map((code) => ({ kind: "course", code })) };
  },
  evaluate(expr, passed, ects): boolean | null {
    switch (expr.kind) {
      case "none":
        return true;
      case "course":
        return passed.has(expr.code);
      case "minEcts":
        return ects >= expr.ects;
      case "unknown":
        return null;
      case "and": {
        const r = expr.items.map((i) => fake.evaluate(i, passed, ects));
        return r.includes(false) ? false : r.includes(null) ? null : true;
      }
      case "or": {
        const r = expr.items.map((i) => fake.evaluate(i, passed, ects));
        return r.includes(true) ? true : r.includes(null) ? null : false;
      }
    }
  },
  codes(expr: PrereqExpr): string[] {
    if (expr.kind === "course") return [expr.code];
    if (expr.kind === "and" || expr.kind === "or") return [...new Set(expr.items.flatMap((i) => fake.codes(i)))];
    return [];
  },
  hasUnknown: (expr) => expr.kind === "unknown" || ((expr.kind === "and" || expr.kind === "or") && expr.items.some(fake.hasUnknown)),
};

let n = 0;
const course = (code: string, credits: number, over: Partial<Requirement> = {}): Requirement => ({
  id: `P:${n++}`,
  programId: "P",
  kind: "course",
  code,
  title: code,
  credits,
  prerequisites: "",
  corequisites: [],
  pool: null,
  slot: { year: 1, season: "guz" },
  ...over,
});
const prog = (requirements: Requirement[], id = "P", kind: RoadmapProgram["kind"] = "anadal"): RoadmapProgram => ({
  id,
  kind,
  name: id,
  requirements,
  totalCredits: 0,
});
const both = new Set<TermSeason>(["guz", "bahar"]);
const offer = (entries: Record<string, TermSeason[]>) => new Map(Object.entries(entries).map(([k, v]) => [k, new Set(v)]));
const opts = { start: { startYear: 2026, season: "guz" as const }, maxCredits: 30, prereq: fake };
const termOf = (plan: ReturnType<typeof buildPlan>, id: string) => plan.terms.findIndex((t) => t.requirementIds.includes(id));

describe("planTermLabel", () => {
  it("takvim yılıyla yazar", () => {
    expect(planTermLabel(2026, "guz")).toBe("2026 Güz");
    expect(planTermLabel(2026, "bahar")).toBe("2027 Bahar");
  });
});

describe("buildPlan", () => {
  it("ön koşul hep önceki döneme, aynı döneme asla", () => {
    const a = course("A 1", 5);
    const b = course("B 1", 5, { prerequisites: "A 1" });
    const c = course("C 1", 5, { prerequisites: "B 1" });
    const plan = buildPlan([prog([c, b, a])], {}, new Map(), opts);
    expect([termOf(plan, a.id), termOf(plan, b.id), termOf(plan, c.id)]).toEqual([0, 1, 2]);
    expect(plan.terms.map((t) => t.label)).toEqual(["2026 Güz", "2027 Bahar", "2027 Güz"]);
    expect(plan.graduation).toBe("2027 Güz");
    expect(plan.unplaced).toEqual([]);
  });

  it("tamamlanan ön koşul ve AKTS şartı sayılır", () => {
    const a = course("A 1", 20);
    const b = course("B 1", 5, { prerequisites: "A 1" });
    const e = course("E 1", 5, { prerequisites: "ECTS 20" });
    const plan = buildPlan([prog([a, b, e])], { [a.id]: true }, new Map(), opts);
    expect(plan.terms).toHaveLength(1);
    expect(plan.terms[0].requirementIds).toEqual([b.id, e.id]);
  });

  it("açıldığı mevsime konur", () => {
    const a = course("A 1", 5);
    const b = course("B 1", 5, { slot: { year: 1, season: "bahar" } });
    const plan = buildPlan([prog([a, b])], {}, offer({ "A 1": ["bahar"], "B 1": ["guz"] }), opts);
    expect(plan.terms.map((t) => [t.label, t.requirementIds])).toEqual([
      ["2026 Güz", [b.id]],
      ["2027 Bahar", [a.id]],
    ]);
  });

  it("AKTS sınırını aşmaz, sonraki müfredat dersini boşluk varsa öne çeker", () => {
    const reqs = [
      course("A 1", 20),
      course("A 2", 20),
      course("A 3", 8, { slot: { year: 3, season: "guz" } }),
    ];
    const plan = buildPlan([prog(reqs)], {}, new Map(), { ...opts, maxCredits: 30 });
    expect(plan.terms.map((t) => t.credits)).toEqual([28, 20]);
    expect(plan.terms[0].requirementIds).toEqual([reqs[0].id, reqs[2].id]);
  });

  it("yan koşullu ders aynı döneme, krediye sayılmadan", () => {
    const lec = course("CS 101", 6, { corequisites: ["CS 101L"] });
    const lab = course("CS 101L", 2, { slot: { year: 2, season: "bahar" } });
    const plan = buildPlan([prog([lec, course("X 1", 24), lab])], {}, new Map(), opts);
    expect(plan.terms).toHaveLength(1);
    expect(plan.terms[0].requirementIds).toEqual([lec.id, lab.id, expect.any(String)]);
    expect(plan.terms[0].credits).toBe(30);
  });

  it("aynı kod anadal ve çapta tek ders olarak yerleşir", () => {
    const a = course("CS 101", 6);
    const b = course("CS101", 6, { programId: "C", id: "C:y1-guz:0" });
    const plan = buildPlan([prog([a]), prog([b], "C", "cap")], {}, new Map(), opts);
    expect(plan.terms).toEqual([
      { startYear: 2026, season: "guz", label: "2026 Güz", requirementIds: [a.id, b.id], credits: 6 },
    ]);
  });

  it("seçmeli slot mevsiminde; 'other' ya da yandalda iki mevsimde de", () => {
    const e1: Requirement = { ...course("", 5, { slot: { year: 1, season: "bahar" } }), kind: "elective", code: null };
    const e2: Requirement = { ...course("", 5, { slot: { year: 1, season: "other" } }), kind: "elective", code: null };
    const e3: Requirement = { ...course("", 5, { slot: null }), kind: "elective", code: null };
    const plan = buildPlan([prog([e1, e2, e3])], {}, new Map(), opts);
    expect(termOf(plan, e1.id)).toBe(1);
    expect(termOf(plan, e2.id)).toBe(0);
    expect(termOf(plan, e3.id)).toBe(0);
  });

  it("dönem sınırında kalanlar nedeniyle unplaced'e düşer", () => {
    const chain = Array.from({ length: 5 }, (_, i) => course(`K ${i}`, 5, { prerequisites: i ? `K ${i - 1}` : "" }));
    const yaz = course("Y 1", 5);
    const loop1 = course("L 1", 5, { prerequisites: "L 2" });
    const loop2 = course("L 2", 5, { prerequisites: "L 1" });
    const plan = buildPlan([prog([...chain, yaz, loop1, loop2])], {}, offer({ "Y 1": ["yaz"] }), { ...opts, maxTerms: 3 });
    expect(plan.terms).toHaveLength(3);
    expect(plan.graduation).toBeNull();
    expect(plan.unplaced).toEqual([
      { requirementId: chain[3].id, reason: "unknown" },
      { requirementId: chain[4].id, reason: "prerequisite" },
      { requirementId: yaz.id, reason: "notOffered" },
      { requirementId: loop1.id, reason: "prerequisite" },
      { requirementId: loop2.id, reason: "prerequisite" },
    ]);
  });

  it("okunamayan ön koşul engellemez", () => {
    const a = course("A 1", 5, { prerequisites: "ne? bilinmez" });
    expect(buildPlan([prog([a])], {}, new Map([["A 1", both]]), opts).graduation).toBe("2026 Güz");
  });
});

describe("buildPlan: gerçek BSCS", () => {
  it("sıfırdan, 30 AKTS ile mezuniyet tarihi verir", () => {
    const bscs = programRequirements((programsData as ProgramsData).programs.find((p) => p.id === "BSCS")!, "anadal");
    const offering = buildOfferingMap([guzData as TermData, baharData as TermData], [bscs]);
    const plan = buildPlan([bscs], {}, offering, { start: { startYear: 2026, season: "guz" }, maxCredits: 30 });

    const placed = new Map<string, number>();
    plan.terms.forEach((t, i) => t.requirementIds.forEach((id) => placed.set(id, i)));
    for (const r of bscs.requirements) {
      expect(placed.has(r.id) || plan.unplaced.some((u) => u.requirementId === r.id)).toBe(true);
    }
    for (const t of plan.terms) expect(t.credits).toBeLessThanOrEqual(30);
    expect(plan.unplaced).toEqual([]);
    expect(plan.graduation).toMatch(/^\d{4} (Güz|Bahar)$/);

    // Ön koşul dersi, varsa, kendisinden önceki bir dönemde.
    const byCode = new Map(bscs.requirements.filter((r) => r.code).map((r) => [canonicalCode(r.code!), r.id]));
    const at = (code: string) => placed.get(byCode.get(code)!)!;
    expect(at("CS 101")).toBeLessThan(at("CS 102"));
    expect(at("CS 102")).toBeLessThan(at("CS 201"));
    expect(at("CS 201")).toBeLessThan(at("CS 202"));
    expect(at("CS 401")).toBeLessThan(at("CS 402"));
    // Müfredat dönem başına tam 30 AKTS: sekiz dönem, 2030 Bahar.
    expect(plan.terms).toHaveLength(8);
    expect(plan.graduation).toBe("2030 Bahar");
  });
});

describe("buildPlan: Erasmus dönemi", () => {
  const elective = (credits: number, slot: Requirement["slot"]): Requirement => ({
    ...course("", credits, { slot }),
    kind: "elective",
    code: null,
  });
  const at = (startYear: number, season: "guz" | "bahar", ects = 30) => ({ term: { startYear, season }, ects });

  it("yoksa plan aynı; Erasmus dönemi planın dışındaysa yok sayılır", () => {
    const reqs = [course("A 1", 5), elective(5, { year: 1, season: "bahar" })];
    const base = buildPlan([prog(reqs)], {}, new Map(), opts);
    expect(base.terms.some((t) => "erasmus" in t)).toBe(false);
    expect(buildPlan([prog(reqs)], {}, new Map(), { ...opts, erasmus: at(2025, "bahar") })).toEqual(base);
    expect(buildPlan([prog(reqs)], {}, new Map(), { ...opts, erasmus: at(2035, "guz") })).toEqual(base);
  });

  it("zorunlu ders sonraki döneme kayar, seçmeli mevsime bakmadan AKTS hakkı kadar yurt dışına gider", () => {
    const a = course("A 1", 5);
    const eG = elective(5, { year: 1, season: "guz" });
    const eB = elective(5, { year: 1, season: "bahar" });
    const eB2 = elective(5, { year: 1, season: "bahar" });
    const plan = buildPlan([prog([a, eG, eB, eB2])], {}, new Map(), { ...opts, erasmus: at(2026, "guz", 10) });
    expect(plan.terms[0]).toEqual({
      startYear: 2026,
      season: "guz",
      label: "2026 Güz",
      requirementIds: [eG.id, eB.id],
      credits: 10,
      erasmus: true,
    });
    expect(plan.terms[1].erasmus).toBeUndefined();
    expect(plan.terms[1].requirementIds).toEqual([a.id, eB2.id]);
    expect(plan.graduation).toBe("2027 Bahar");
  });

  it("önce yalnızca o mevsimde yer bulabilen seçmeli yurt dışına gider", () => {
    const eAny = elective(5, { year: 1, season: "other" });
    const eG = elective(5, { year: 1, season: "guz" });
    const plan = buildPlan([prog([eAny, eG])], {}, new Map(), { ...opts, erasmus: at(2026, "guz", 5) });
    expect(plan.terms.map((t) => [t.label, t.requirementIds, !!t.erasmus])).toEqual([
      ["2026 Güz", [eG.id], true],
      ["2027 Bahar", [eAny.id], false],
    ]);
  });

  it("boş Erasmus dönemi de dönem sayılır; ön koşul zinciri bekler", () => {
    const a = course("A 1", 5);
    const b = course("B 1", 5, { prerequisites: "A 1" });
    const plan = buildPlan([prog([a, b])], {}, new Map(), { ...opts, erasmus: at(2026, "bahar") });
    expect(plan.terms.map((t) => [t.label, t.requirementIds.length, !!t.erasmus])).toEqual([
      ["2026 Güz", 1, false],
      ["2027 Bahar", 0, true],
      ["2027 Güz", 1, false],
    ]);
    expect(termOf(plan, b.id)).toBe(2);
    expect(plan.graduation).toBe("2027 Güz");
  });

  it("AKTS hakkı 0 ise yurt dışına seçmeli gitmez", () => {
    const e = elective(5, { year: 1, season: "guz" });
    const plan = buildPlan([prog([e])], {}, new Map(), { ...opts, erasmus: at(2026, "guz", 0) });
    expect(plan.terms[0]).toMatchObject({ erasmus: true, requirementIds: [], credits: 0 });
    expect(plan.terms.map((t) => t.label)).toEqual(["2026 Güz", "2027 Bahar", "2027 Güz"]);
    expect(plan.graduation).toBe("2027 Güz");
  });
});

describe("buildPlan: gerçek BSCS ile Erasmus", () => {
  it("3. yıl Bahar yurt dışında: zorunlu ders yok, seçmeliler en fazla 30 AKTS, mezuniyet bir dönem kayar", () => {
    const bscs = programRequirements((programsData as ProgramsData).programs.find((p) => p.id === "BSCS")!, "anadal");
    const offering = buildOfferingMap([guzData as TermData, baharData as TermData], [bscs]);
    const plan = buildPlan([bscs], {}, offering, {
      start: { startYear: 2026, season: "guz" },
      maxCredits: 30,
      erasmus: { term: { startYear: 2028, season: "bahar" }, ects: 30 },
    });
    const byId = new Map(bscs.requirements.map((r) => [r.id, r]));
    const abroad = plan.terms.filter((t) => t.erasmus);
    expect(abroad.map((t) => t.label)).toEqual(["2029 Bahar"]);
    expect(abroad[0].requirementIds.length).toBeGreaterThan(0);
    expect(abroad[0].requirementIds.every((id) => byId.get(id)!.kind === "elective")).toBe(true);
    expect(abroad[0].credits).toBeLessThanOrEqual(30);
    expect(plan.unplaced).toEqual([]);
    expect(plan.terms).toHaveLength(9);
    expect(plan.graduation).toBe("2030 Güz");
  });
});

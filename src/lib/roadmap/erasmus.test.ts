import { describe, expect, it } from "vitest";
import programsData from "../../../data/ozyegin/programs.json";
import guzData from "../../../data/ozyegin/2026-2027-guz.json";
import baharData from "../../../data/ozyegin/2026-2027-bahar.json";
import type { ProgramsData, TermData } from "../types";
import { suggestErasmusTerms } from "./erasmus";
import { buildOfferingMap } from "./offering";
import { buildPlan } from "./plan";
import { programRequirements } from "./requirements";
import type { Requirement, RoadmapProgram } from "./types";

let n = 0;
const req = (code: string | null, credits: number, season: "guz" | "bahar"): Requirement => ({
  id: `P:${n++}`,
  programId: "P",
  kind: code ? "course" : "elective",
  code,
  title: code ?? "Seçmeli",
  credits,
  prerequisites: "",
  corequisites: [],
  pool: null,
  slot: { year: 1, season },
});
const prog = (requirements: Requirement[]): RoadmapProgram => ({ id: "P", kind: "anadal", name: "P", requirements, totalCredits: 0 });
const offer = (entries: Record<string, ("guz" | "bahar")[]>) => new Map(Object.entries(entries).map(([k, v]) => [k, new Set(v)]));
const opts = { start: { startYear: 2026, season: "guz" as const }, maxCredits: 10 };

describe("suggestErasmusTerms", () => {
  // Güz: A 1 (yalnız Güz açılır) + seçmeli; Bahar: iki seçmeli. Dönem başına 10 AKTS, iki dönem.
  const programs = [prog([req("A 1", 5, "guz"), req(null, 5, "guz"), req(null, 5, "bahar"), req(null, 5, "bahar")])];
  const offering = offer({ "A 1": ["guz"] });

  it("mezuniyeti değiştirmeyen dönemi öne koyar, kayan zorunlu dersi söyler", () => {
    expect(buildPlan(programs, {}, offering, opts).graduation).toBe("2027 Bahar");
    expect(suggestErasmusTerms(programs, {}, offering, opts)).toEqual([
      {
        term: { startYear: 2026, season: "bahar" },
        label: "2027 Bahar",
        graduation: "2027 Bahar",
        delayTerms: 0,
        electivesAbroad: 10,
        pushedRequired: [],
      },
      {
        term: { startYear: 2026, season: "guz" },
        label: "2026 Güz",
        graduation: "2027 Güz",
        delayTerms: 1,
        electivesAbroad: 15,
        pushedRequired: ["A 1"],
      },
    ]);
  });

  it("AKTS hakkı options.erasmus'tan gelir (dönemi değil), aday sayısı sınırlanır", () => {
    const withErasmus = { ...opts, erasmus: { term: { startYear: 2026, season: "bahar" as const }, ects: 5 } };
    const s = suggestErasmusTerms(programs, {}, offering, withErasmus, 1);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ label: "2026 Güz", electivesAbroad: 5, pushedRequired: ["A 1"] });
    expect(suggestErasmusTerms(programs, {}, offering, opts, 0)).toEqual([]);
  });

  it("gerçek BSCS: varsayılan ilk altı dönem, eşitlikte erken tarih önce", () => {
    const bscs = programRequirements((programsData as ProgramsData).programs.find((p) => p.id === "BSCS")!, "anadal");
    const off = buildOfferingMap([guzData as TermData, baharData as TermData], [bscs]);
    const base = { start: { startYear: 2026, season: "guz" as const }, maxCredits: 30 };

    const six = suggestErasmusTerms([bscs], {}, off, base);
    expect(six).toHaveLength(6);
    // Müfredat her dönem tam 30 AKTS: 30 AKTS yurt dışına gitse de en az bir dönem gecikir.
    for (const x of six) {
      expect(x.delayTerms).toBeGreaterThanOrEqual(1);
      expect(x.electivesAbroad).toBeLessThanOrEqual(30);
    }
    expect(six.map((x) => [x.label, x.delayTerms])).toEqual([
      ["2027 Bahar", 1],
      ["2028 Bahar", 1],
      ["2029 Bahar", 1],
      ["2027 Güz", 2],
      ["2028 Güz", 2],
      ["2026 Güz", 2], // aynı gecikme, ama altı zorunlu ders kayar (ötekilerde beş)
    ]);

    // Bütün dönemler aday: son yıl daha az zorunlu dersi kaydırır.
    const all = suggestErasmusTerms([bscs], {}, off, base, 8);
    expect(all[0]).toMatchObject({ label: "2030 Bahar", delayTerms: 1, pushedRequired: ["CS 402"], graduation: "2030 Güz" });
    expect(all[1]).toMatchObject({ label: "2029 Güz", delayTerms: 1, pushedRequired: ["CS 400", "CS 401"] });
  });
});

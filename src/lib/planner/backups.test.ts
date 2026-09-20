import { describe, expect, it } from "vitest";
import { NO_WEIGHTS, crs, mt, sec } from "../engine/test-fixtures";
import type { Course } from "../types";
import { backupSections, describeChange, optionLabel, registrationOrder, registrationText } from "./backups";

const mapOf = (...cs: Course[]) => new Map(cs.map((c) => [c.code, c]));
const base = { freeDays: [], excluded: [], locked: {}, weights: NO_WEIGHTS };
const pick = (...pairs: [string, string][]) => ({ sections: pairs.map(([courseCode, sectionId]) => ({ courseCode, sectionId })) });

describe("backupSections", () => {
  it("splits same-time sections from other-time ones and drops conflicts", () => {
    const cs = crs(
      "CS 101",
      sec("A", mt(2, "10:40", "12:30")),
      sec("B", mt(2, "10:40", "12:30")),
      sec("C", mt(3, "13:40", "15:30")),
      sec("D", mt(1, "08:40", "10:30")), // MATH A ile çakışır
    );
    const math = crs("MATH 101", sec("A", mt(1, "09:40", "11:30")));
    const [r] = backupSections(base, pick(["CS 101", "A"], ["MATH 101", "A"]), mapOf(cs, math));
    expect(r.chosen).toBe("A");
    expect(r.sameTime.map((s) => s.id)).toEqual(["B"]);
    expect(r.other.map((o) => o.sections[0].sectionId)).toEqual(["C"]);
    expect(r.other[0].changes).toEqual(["Salı 10:40 yerine Çarşamba 13:40"]);
    expect(r.none).toBe(false);
  });

  it("respects free days and exclusions, ignores locks but reports them", () => {
    const cs = crs(
      "CS 101",
      sec("A", mt(2, "10:40", "12:30")),
      sec("B", mt(2, "10:40", "12:30")),
      sec("C", mt(5, "13:40", "15:30")),
    );
    const input = { ...base, freeDays: [5 as const], excluded: [{ courseCode: "CS 101", sectionId: "B" }], locked: { "CS 101": "A" } };
    const [r] = backupSections(input, pick(["CS 101", "A"]), mapOf(cs));
    expect(r.locked).toBe(true);
    expect(r.sameTime).toEqual([]);
    expect(r.other).toEqual([]);
    expect(r.none).toBe(true);
  });

  it("ranks other-time backups by score delta", () => {
    const cs = crs(
      "CS 101",
      sec("A", mt(1, "13:40", "15:30")),
      sec("B", mt(3, "08:40", "10:30")), // yeni gün + erken
      sec("C", mt(1, "10:40", "12:30")), // aynı gün
    );
    const math = crs("MATH 101", sec("A", mt(1, "08:40", "10:30")));
    const weights = { ...NO_WEIGHTS, fewDays: 2, noEarly: 1 };
    const [r] = backupSections({ ...base, weights }, pick(["CS 101", "A"], ["MATH 101", "A"]), mapOf(cs, math));
    expect(r.other.map((o) => o.sections[0].sectionId)).toEqual(["C", "B"]);
    expect(r.other[0].scoreDelta).toBeLessThanOrEqual(0);
    // Bir gün fazla: fewDays 2 x DAY_HOURS 3 = 6, üstüne erken ders 1 -> 7.
    expect(r.other[1].scoreDelta).toBe(7);
  });

  it("offers a paired lecture + lab change when the lecture alone does not fit", () => {
    const lec = { ...crs("CS 201", sec("A", mt(1, "10:40", "12:30")), sec("B", mt(3, "10:40", "12:30"))), corequisites: ["CS 201L"] };
    const lab = crs("CS 201L", sec("A1", mt(4, "10:40", "12:30")), sec("B1", mt(3, "11:40", "13:30")), sec("B2", mt(2, "13:40", "15:30")));
    // Seçili lab B1; CS 201 B yalnızca onunla çakışır, lab da değişirse sığar.
    const courses = mapOf(lec, lab);
    const [rLec, rLab] = backupSections(base, pick(["CS 201", "A"], ["CS 201L", "B1"]), courses);
    expect(rLec.partners).toEqual(["CS 201L"]);
    expect(rLab.partners).toEqual(["CS 201"]);
    const paired = rLec.other.map((o) => o.sections.map((s) => `${s.courseCode} ${s.sectionId}`).join(" + "));
    expect(paired).toEqual(["CS 201 B + CS 201L A1", "CS 201 B + CS 201L B2"]);
    expect(rLec.other[0].changes).toEqual([
      "CS 201: Pazartesi 10:40 yerine Çarşamba 10:40",
      "CS 201L: Çarşamba 11:40 yerine Perşembe 10:40",
    ]);
    expect(optionLabel(rLec.other[0], courses)).toBe("B + CS 201L A1 (Çar 10:40)");
    // Lab kendi başına A1 ve B2'ye geçebilir.
    expect(rLab.other.map((o) => o.sections.length)).toEqual([1, 1]);
  });

  it("puts single changes before paired ones", () => {
    const lec = { ...crs("CS 201", sec("A", mt(1, "10:40", "12:30")), sec("B", mt(3, "10:40", "12:30")), sec("C", mt(5, "10:40", "12:30"))), corequisites: ["CS 201L"] };
    const lab = crs("CS 201L", sec("L1", mt(3, "11:40", "13:30")), sec("L2", mt(4, "11:40", "13:30")));
    const [r] = backupSections(base, pick(["CS 201", "A"], ["CS 201L", "L1"]), mapOf(lec, lab));
    expect(r.other.map((o) => o.sections.length)).toEqual([1, 2]);
    expect(r.other[0].sections[0].sectionId).toBe("C");
  });
});

describe("describeChange", () => {
  it("notes removed and added meetings when counts differ", () => {
    expect(describeChange(sec("A", mt(1, "10:40", "12:30"), mt(3, "10:40", "12:30")), sec("B", mt(1, "10:40", "12:30")))).toEqual([
      "Çarşamba 10:40 dersi kalkar",
    ]);
    expect(describeChange(sec("A", mt(1, "10:40", "12:30")), sec("B", mt(2, "09:40", "10:30"), mt(4, "09:40", "10:30")))).toEqual([
      "Pazartesi 10:40 yerine Salı 09:40",
      "Perşembe 09:40 eklenir",
    ]);
  });
});

describe("registrationOrder and registrationText", () => {
  const cs = { ...crs("CS 201", sec("A", mt(1, "10:40", "12:30")), sec("B", mt(1, "10:40", "12:30")), sec("C", mt(3, "13:40", "15:30"))), corequisites: ["CS 201L"] };
  cs.sections[0].instructors = ["BURÇİN GÜNEŞ"];
  const lab = crs("CS 201L", sec("L1", mt(2, "10:40", "12:30")), sec("L2", mt(2, "10:40", "12:30")));
  const hist = crs("HIST 101", sec("A", mt(4, "10:40", "12:30")));
  const courses = mapOf(hist, cs, lab);
  const result = backupSections(base, pick(["CS 201", "A"], ["HIST 101", "A"], ["CS 201L", "L1"]), courses);

  it("puts courses without backups first and keeps corequisites together", () => {
    const order = registrationOrder(result);
    expect(order.map((s) => s.backups.courseCode)).toEqual(["HIST 101", "CS 201L", "CS 201"]);
    expect(order[0].reason).toBe("tek şubesi var, önce bunu al");
    expect(order[1].reason).toBe("tek yedeği var");
    expect(order[2].reason).toBe("aynı saatte yedeği var, CS 201L ile birlikte al");
  });

  it("writes a numbered plain-text list", () => {
    const text = registrationText(registrationOrder(result), courses, "2026 - 2027 Güz");
    expect(text.split("\n")).toEqual([
      "Kayıt günü planı, 2026 - 2027 Güz",
      "",
      "1. HIST 101 A, yedek yok (tek şubesi var, önce bunu al)",
      "2. CS 201L L1, yedek: L2 (tek yedeği var)",
      "3. CS 201 A (Burçin Güneş), yedek: B, C (Çar 13:40) (aynı saatte yedeği var, CS 201L ile birlikte al)",
    ]);
  });
});

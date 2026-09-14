import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluatePrerequisite, hasUnknown, parsePrerequisite, prerequisiteCodes } from "./prereq";
import type { PrereqExpr } from "./types";

const c = (code: string): PrereqExpr => ({ kind: "course", code });
const and = (...items: PrereqExpr[]): PrereqExpr => ({ kind: "and", items });
const or = (...items: PrereqExpr[]): PrereqExpr => ({ kind: "or", items });
const ects = (n: number): PrereqExpr => ({ kind: "minEcts", ects: n });

const CODE_RE = /^[A-ZÇĞİÖŞÜ]{2,5} \d{3}(?:[A-Z]|_[A-Z])?$/;

describe("parsePrerequisite", () => {
  const cases: [string, PrereqExpr][] = [
    ["", { kind: "none" }],
    ["   ", { kind: "none" }],
    ["MATH103", c("MATH 103")],
    ["CS 101L", c("CS 101L")],
    ["Math 211", c("MATH 211")],
    ["MİM 101 or ARCH 101", or(c("MİM 101"), c("ARCH 101"))],
    ["CS 101 veya CS 103", or(c("CS 101"), c("CS 103"))],
    ["BUS 102 / BUS 101", or(c("BUS 102"), c("BUS 101"))],
    ["SAS 103/105", or(c("SAS 103"), c("SAS 105"))],
    ["GARM 121 & GARM 222", and(c("GARM 121"), c("GARM 222"))],
    ["PLT 202, PLT 204 ve PLT 206", and(c("PLT 202"), c("PLT 204"), c("PLT 206"))],
    [
      "(BUS 101 or (BUS 100 and BUS 190)) and (MATH 101 or MATH 103)",
      and(or(c("BUS 101"), and(c("BUS 100"), c("BUS 190"))), or(c("MATH 101"), c("MATH 103"))),
    ],
    ["(BUS100 ve BUS190) veya BUS101", or(and(c("BUS 100"), c("BUS 190")), c("BUS 101"))],
    // and, or'dan sıkı bağlar
    ["BUS 101 or (BUS 100 and BUS 190) and MATH 101", or(c("BUS 101"), and(c("BUS 100"), c("BUS 190"), c("MATH 101")))],
    ["MATH 212 and CS 100 or CS 101", or(and(c("MATH 212"), c("CS 100")), c("CS 101"))],
    ["HUK 205 ve HUK 206 derslerini başarı ile tamamlamış olmak", and(c("HUK 205"), c("HUK 206"))],
    ["ENG 103 dersinden başarılı olmak", c("ENG 103")],
    ["En az 60 AKTS kredisi tamamlamış olmak", ects(60)],
    ["Min. 90 ECTS", ects(90)],
    ["120 AKTS (ECTS)", ects(120)],
    ["SEC 201 and Having completed at least 60 ECTS", and(c("SEC 201"), ects(60))],
    ["90 ECTS & MATH 102/MATH 103", and(ects(90), or(c("MATH 102"), c("MATH 103")))],
    ["MATH 212, CHEM 111 ve 135 ECTS'yi tamamlamış olmak", and(c("MATH 212"), c("CHEM 111"), ects(135))],
    ["(ACCT 201 and (ECON 101 or ECON 102 or ECON 210)", and(c("ACCT 201"), or(c("ECON 101"), c("ECON 102"), c("ECON 210")))],
    ["MATH 217 or CE 217) and ECON 210", and(or(c("MATH 217"), c("CE 217")), c("ECON 210"))],
    ["IR 501 nad IR 502", and(c("IR 501"), c("IR 502"))],
    ["((ECON101 and ECON102) and MATH 202)", and(c("ECON 101"), c("ECON 102"), c("MATH 202"))],
  ];
  it.each(cases)("%s", (text, expected) => {
    expect(parsePrerequisite(text)).toEqual(expected);
  });

  it("en az ikisi: yalnız o grup unknown", () => {
    const e = parsePrerequisite("CS201 ve CS202 ve CS240 ve ( CS321, CS333, CS320, CS350 en az ikisi)");
    expect(e).toEqual(
      and(c("CS 201"), c("CS 202"), c("CS 240"), { kind: "unknown", text: "( CS321, CS333, CS320, CS350 en az ikisi)" }),
    );
  });

  it("-(...) okunamaz, geri kalanı korunur", () => {
    const e = parsePrerequisite(
      "BUS 102 and SEC 201 and having completed at least 105 AKTS -(ACCT 201 or MGMT 202 or MKTG 201 or OPER 202) and having completed at least 90 AKTS",
    );
    expect(e.kind).toBe("and");
    expect(hasUnknown(e)).toBe(true);
    expect(prerequisiteCodes(e)).toEqual(["BUS 102", "SEC 201"]);
  });

  it.each([
    "Attending the required number of seminars",
    "Min 3.00 GNO",
    "The student should pass at least 6 of the following courses:CE 208, CE 301, CE 304",
    "Having completed at least 105 credits",
    "GARM 121-GARM 321",
  ])("tamamen unknown: %s", (text) => {
    expect(parsePrerequisite(text)).toEqual({ kind: "unknown", text });
  });

  it("çıplak sayı and ile ders sanılmaz", () => {
    const e = parsePrerequisite("ECON 210 and CE 310 and 165 credits completed");
    expect(prerequisiteCodes(e)).toEqual(["ECON 210", "CE 310"]);
    expect(hasUnknown(e)).toBe(true);
  });

  it("olumsuzluk unknown olur", () => {
    const e = parsePrerequisite("MATH 211 and (CS 102 or CS 105) and EE 433 almamış olmak");
    expect(hasUnknown(e)).toBe(true);
    expect(prerequisiteCodes(e)).not.toContain("EE 433");
  });
});

describe("evaluatePrerequisite", () => {
  const passed = new Set(["CS 101", "MATH 101"]);
  it("üç değerli mantık", () => {
    expect(evaluatePrerequisite({ kind: "none" }, passed, 0)).toBe(true);
    expect(evaluatePrerequisite(parsePrerequisite("CS 101 veya CS 103"), passed, 0)).toBe(true);
    expect(evaluatePrerequisite(parsePrerequisite("CS 102 ve CS 101"), passed, 0)).toBe(false);
    expect(evaluatePrerequisite(parsePrerequisite("En az 60 AKTS"), passed, 59)).toBe(false);
    expect(evaluatePrerequisite(parsePrerequisite("En az 60 AKTS"), passed, 60)).toBe(true);
    const unk: PrereqExpr = { kind: "unknown", text: "x" };
    expect(evaluatePrerequisite(unk, passed, 0)).toBeNull();
    expect(evaluatePrerequisite(and(c("CS 101"), unk), passed, 0)).toBeNull();
    expect(evaluatePrerequisite(and(c("CS 999"), unk), passed, 0)).toBe(false);
    expect(evaluatePrerequisite(or(c("CS 101"), unk), passed, 0)).toBe(true);
    expect(evaluatePrerequisite(or(c("CS 999"), unk), passed, 0)).toBeNull();
  });
});

describe("prerequisiteCodes", () => {
  it("tekrarsız", () => {
    expect(prerequisiteCodes(parsePrerequisite("(MATH 211 and CS 102) or MATH 211 and (CS 102 or CS 105)"))).toEqual([
      "MATH 211",
      "CS 102",
      "CS 105",
    ]);
  });
});

describe("gerçek veri", () => {
  const root = join(__dirname, "../../../data/ozyegin");
  const read = (f: string) => JSON.parse(readFileSync(join(root, f), "utf8"));
  const texts = new Set<string>();
  for (const p of read("programs.json").programs)
    for (const s of p.semesters)
      for (const i of s.items) if (i.kind === "course" && i.prerequisites) texts.add(i.prerequisites);
  for (const f of ["2026-2027-guz.json", "2026-2027-bahar.json"])
    for (const course of read(f).courses) if (course.prerequisites) texts.add(course.prerequisites);

  it("hepsi ayrıştırılır, kodlar geçerli, unknown oranı düşük", () => {
    expect(texts.size).toBeGreaterThan(200);
    const unknowns: string[] = [];
    for (const text of texts) {
      const e = parsePrerequisite(text);
      for (const code of prerequisiteCodes(e)) expect(code, text).toMatch(CODE_RE);
      if (hasUnknown(e)) unknowns.push(text);
    }
    console.info(`ön koşul: ${texts.size} metin, ${unknowns.length} tanesinde unknown\n` + unknowns.join("\n"));
    expect(unknowns.length / texts.size).toBeLessThan(0.1);
  });
});

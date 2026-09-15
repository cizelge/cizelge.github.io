import { describe, expect, it } from "vitest";
import partnersJson from "../../../data/ozyegin/partners.json";
import echeJson from "../../../public/data/eche-institutions.json";
import {
  type PartnersData,
  echeItems,
  findUniversity,
  foldForSearch,
  partnerItems,
  searchUniversities,
  universityDetail,
  type UniversityItem,
} from "./universities";

const u = (name: string, country: string | null, city: string | null, erasmusCode: string | null, isPartner: boolean): UniversityItem => ({
  name,
  country,
  city,
  erasmusCode,
  isPartner,
});

const partners: UniversityItem[] = [
  u("Politecnico di Milano", "İtalya", "Milano", "I MILANO02", true),
  u("Ruhr-Universität Bochum", "Almanya", "Bochum", "D BOCHUM01", true),
  u("Tilburg University", "Hollanda", "Tilburg", "NL TILBURG01", true),
  u("University of Gottingen", "Almanya", "Gottingen", "D GOTTING01", true),
  u("Yokohama National University", "Japonya", null, null, true),
];

const others: UniversityItem[] = [
  u("Hochschule für Musik und Tanz Köln", "Almanya", "Köln", "D KOLN03", false),
  u("Institut für Delft Studien", "Almanya", "Berlin", "D BERLIN99", false),
  u("Politecnico di Milano", "İtalya", "Milano", "I MILANO02", false),
  u("Technische Universiteit Delft", "Hollanda", "Delft", "NL DELFT01", false),
  u("Technische Universitaet Muenchen", "Almanya", "Muenchen", "D MUNCHEN02", false),
  u("Technische Universität München", "Almanya", "München", "D MUNCHEN99", false),
  u("Universitaet zu Koeln", "Almanya", "Koeln", "D KOLN01", false),
  u("Universidade do Porto", "Portekiz", "Porto", "P PORTO02", false),
];

const names = (list: UniversityItem[]) => list.map((x) => x.name);

describe("foldForSearch", () => {
  it("folds Turkish and European letters", () => {
    expect(foldForSearch("  İSTANBUL   Işık Üniversitesi ")).toBe("istanbul isik universitesi");
    expect(foldForSearch("ŞĞÇÖ şğçö")).toBe("sgco sgco");
    expect(foldForSearch("Université Paris-Saclay")).toBe("universite paris-saclay");
    expect(foldForSearch("Straße Ålborg Øresund Kraków Łódź")).toBe("strasse alborg oresund krakow lodz");
    expect(foldForSearch("Universität zu Köln")).toBe("universitat zu koln");
  });
});

describe("searchUniversities", () => {
  it('matches "munchen" to München and Muenchen spellings', () => {
    const r = searchUniversities("munchen", partners, others);
    expect(names(r.others)).toEqual(["Technische Universitaet Muenchen", "Technische Universität München"]);
    expect(r.partners).toEqual([]);
  });

  it('matches "koln" to Köln and Koeln, universities first', () => {
    const r = searchUniversities("koln", partners, others);
    expect(names(r.others)).toEqual(["Universitaet zu Koeln", "Hochschule für Musik und Tanz Köln"]);
  });

  it('matches "tu delft" by initials and ranks word starts above substrings', () => {
    const r = searchUniversities("tu delft", partners, others);
    expect(names(r.others)).toEqual(["Technische Universiteit Delft", "Institut für Delft Studien"]);
  });

  it("searches by Turkish country name", () => {
    const r = searchUniversities("almanya", partners, others);
    expect(names(r.partners)).toEqual(["Ruhr-Universität Bochum", "University of Gottingen"]);
    expect(r.others.every((x) => x.country === "Almanya")).toBe(true);
    expect(r.others).toHaveLength(5);
  });

  it("searches by Erasmus code", () => {
    expect(names(searchUniversities("D MUNCHEN02", partners, others).others)).toEqual(["Technische Universitaet Muenchen"]);
    expect(names(searchUniversities("d munchen02", partners, others).others)).toEqual(["Technische Universitaet Muenchen"]);
  });

  it("requires every token to match", () => {
    expect(searchUniversities("munchen delft", partners, others)).toEqual({ partners: [], others: [], morePartners: false, moreOthers: false });
    expect(names(searchUniversities("technische almanya", partners, others).others)).toEqual([
      "Technische Universitaet Muenchen",
      "Technische Universität München",
    ]);
  });

  it("ranks name start > word start > contains, stable within a rank", () => {
    const list = [
      u("Alpha Porto School", "X", null, null, false),
      u("Portorož Academy", "X", null, null, false),
      u("Sporto Institute", "X", null, null, false),
      u("Porto University", "X", null, null, false),
      u("Lisbon", "X", "Porto", null, false),
    ];
    expect(names(searchUniversities("porto", [], list).others)).toEqual([
      "Portorož Academy",
      "Porto University",
      "Alpha Porto School",
      "Sporto Institute",
      "Lisbon",
    ]);
  });

  it("puts partners first and removes them from others by name or code", () => {
    const r = searchUniversities("milano", partners, others);
    expect(names(r.partners)).toEqual(["Politecnico di Milano"]);
    expect(r.partners[0].isPartner).toBe(true);
    expect(r.others).toEqual([]);
    const renamed = [u("Politecnico Milano (legal name)", "İtalya", "Milano", "I MILANO02", false)];
    expect(searchUniversities("milano", partners, renamed).others).toEqual([]);
  });

  it("returns all partners for an empty query and no others", () => {
    const r = searchUniversities("   ", partners, others);
    expect(r.partners).toHaveLength(partners.length);
    expect(r.others).toEqual([]);
  });

  it("limits results and reports more", () => {
    const many = Array.from({ length: 120 }, (_, i) => u(`University ${i}`, "X", null, null, false));
    const r = searchUniversities("university", [], many);
    expect(r.others).toHaveLength(50);
    expect(r.moreOthers).toBe(true);
    expect(searchUniversities("university", [], many, 200).moreOthers).toBe(false);
  });
});

describe("data files", () => {
  const data = partnersJson as PartnersData;
  const eche = echeItems(echeJson);

  it("partners.json has the documented shape and no duplicates", () => {
    expect(data.schoolId).toBe("ozyegin");
    expect(data.partners.length).toBeGreaterThan(100);
    const seen = new Set<string>();
    for (const p of data.partners) {
      expect(p.name.trim()).toBe(p.name);
      expect(p.country.length).toBeGreaterThan(0);
      expect(p.programs.length).toBeGreaterThan(0);
      for (const g of p.programs) expect(["erasmus", "bilateral", "other"]).toContain(g);
      expect(seen.has(foldForSearch(p.name))).toBe(false);
      seen.add(foldForSearch(p.name));
    }
  });

  it("every partner Erasmus code exists in the ECHE list with the same country", () => {
    const byCode = new Map(eche.map((e) => [e.erasmusCode, e]));
    for (const p of data.partners.filter((x) => x.erasmusCode)) expect(byCode.get(p.erasmusCode)?.country).toBe(p.country);
  });

  it("real lists: TU München, Köln and TU Delft are found", () => {
    const items = partnerItems(data);
    expect(names(searchUniversities("munchen technische", items, eche).others)).toContain("Technische Universitaet Muenchen");
    expect(names(searchUniversities("tu delft", items, eche).others)[0]).toBe("Technische Universiteit Delft");
    expect(searchUniversities("köln", items, eche).others.length).toBeGreaterThan(3);
    expect(names(searchUniversities("D MUNCHEN02", items, eche).others)).toEqual(["Technische Universitaet Muenchen"]);
    // Anlaşmalı okul ECHE listesinde tekrar görünmez
    expect(searchUniversities("I MILANO02", items, eche)).toMatchObject({ others: [], partners: [{ name: "Politecnico di Milano" }] });
  });
});

describe("helpers", () => {
  it("findUniversity ignores case and accents", () => {
    expect(findUniversity("ruhr-universitat bochum", partners, others)?.erasmusCode).toBe("D BOCHUM01");
    expect(findUniversity("", partners)).toBeNull();
    expect(findUniversity("Nowhere", partners, others)).toBeNull();
  });

  it("universityDetail writes country and code", () => {
    expect(universityDetail(others[4])).toBe("Almanya, Erasmus kodu D MUNCHEN02");
    expect(universityDetail(partners[4])).toBe("Japonya");
    expect(universityDetail(u("X", null, null, null, false))).toBeNull();
  });

  it("echeItems skips broken rows", () => {
    expect(echeItems({})).toEqual([]);
    expect(echeItems([["A", "Almanya", null, "D A01"], [5], "x", ["", "B"], ["B", "", "", null]])).toEqual([
      u("A", "Almanya", null, "D A01", false),
      u("B", null, null, null, false),
    ]);
  });

  it("partnerItems slims the data file", () => {
    const items = partnerItems({
      schoolId: "ozyegin",
      fetchedAt: "",
      sources: [],
      partners: [{ name: "A", country: "B", city: null, erasmusCode: null, departments: ["Law"], programs: ["erasmus"] }],
    });
    expect(items).toEqual([u("A", "B", null, null, true)]);
    expect(partnerItems(null)).toEqual([]);
  });
});

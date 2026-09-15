import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeEntities, fetchTermOfferings, parseOfferingsPage, rowsToCourses, termFromOption } from "./public-offerings";

const html = fs.readFileSync(path.join(__dirname, "fixtures", "acilan-dersler-bscs.html"), "utf8");

describe("parseOfferingsPage", () => {
  const page = parseOfferingsPage(html);

  it("seçili dönemi ve dönem listesini okur", () => {
    expect(page.termCode).toBe("202610");
    expect(page.termLabel).toBe("2026 - 2027 Güz");
    expect(page.terms.map((t) => t.value)).toEqual(["202710", "202630", "202620", "202610", "202530"]);
    expect(termFromOption(page.terms[2])?.id).toBe("2026-2027-bahar");
  });

  it("fakültenin program listesini okur", () => {
    expect(page.programs.map((p) => p.value)).toEqual(["BSAI", "BSIE", "BSME", "BSCS", "BSEE", "BSCE"]);
  });

  it("bozuk HTML'e rağmen bütün satırları alanlarıyla okur", () => {
    expect(page.warnings).toEqual([]);
    expect(page.rows.map((r) => `${r.area}|${r.code}.${r.section}`)).toEqual([
      "BSCS Zorunlu|CS 102.A",
      "BSCS Zorunlu|CS 201.A",
      "BSCS Zorunlu|CS 201.B",
      "BSCS Zorunlu|CS 401.A",
      "BSCS Zorunlu|CS 447.A",
      "BSCS Staj|CS 300.A",
      "BSCS Staj|CS 400.A",
      "FE Serbest Seçmeli|CS 201.A",
      "FE Serbest Seçmeli|TRL 100.PA",
      "FE Serbest Seçmeli|TRL 100.R",
    ]);
  });

  it("ad, hoca ve saatleri ayırır", () => {
    const cs102 = page.rows[0];
    expect(cs102).toMatchObject({ title: "Nesneye Dayalı Programlama", instructor: "KÜBRA KALKAN ÇAKMAKCİ" });
    expect(cs102.meetings).toEqual([
      { day: 2, start: "12:40", end: "14:30" },
      { day: 1, start: "08:40", end: "10:30" },
    ]);
    expect(page.rows[1].meetings).toEqual([{ day: 3, start: "16:40", end: "18:30" }]);
    // Saatsiz şube, tablonun kapanmayan son satırı ve adı boş hoca bağlantısı.
    expect(page.rows[3].meetings).toEqual([]);
    expect(page.rows[4].meetings).toEqual([
      { day: 1, start: "20:40", end: "21:30" },
      { day: 2, start: "20:40", end: "22:30" },
    ]);
    expect(page.rows[6]).toMatchObject({ title: "Staj II", meetings: [] });
    expect(page.rows[8]).toMatchObject({ title: "Dönüştürücü Öğrenme", instructor: null, meetings: [] });
  });

  it("dersi olmayan sayfada boş döner", () => {
    const empty = parseOfferingsPage(html.replace(/<table[\s\S]*$/, ""));
    expect(empty.rows).toEqual([]);
    expect(empty.termCode).toBe("202610");
  });

  it("İngilizce gün adlarını ve HTML varlıklarını okur", () => {
    const en = parseOfferingsPage(
      `<table><th colspan="3">X</th><td width="130"><a>MGMT 201.A</a></td>` +
        `<td>R&amp;D Management , <a href="https://www.ozyegin.edu.tr/en/faculty/x">JANE DOE</a></td>` +
        `<td width="180"><span>Tuesday 9:40 - 11:30</span><br/></td></table>`,
    );
    expect(en.rows[0]).toMatchObject({
      code: "MGMT 201",
      section: "A",
      title: "R&D Management",
      instructor: "JANE DOE",
      meetings: [{ day: 2, start: "09:40", end: "11:30" }],
    });
    expect(decodeEntities("&#304;&#x15e;")).toBe("İŞ");
  });
});

describe("rowsToCourses", () => {
  it("alanlarda tekrar eden şubeleri birleştirir, sıralar", () => {
    const courses = rowsToCourses(parseOfferingsPage(html).rows);
    expect(courses.map((c) => c.code)).toEqual(["CS 102", "CS 201", "CS 300", "CS 400", "CS 401", "CS 447", "TRL 100"]);
    const cs201 = courses.find((c) => c.code === "CS 201")!;
    expect(cs201).toMatchObject({ slug: "cs-201", ects: null, prerequisites: "", corequisites: [] });
    expect(cs201.sections).toEqual([
      { id: "A", instructors: ["EMRE SEFER"], capacity: null, restrictions: null, meetings: [{ day: 3, start: "16:40", end: "18:30", room: null }] },
      { id: "B", instructors: ["HASAN SÖZER"], capacity: null, restrictions: null, meetings: [{ day: 3, start: "16:40", end: "18:30", room: null }] },
    ]);
    expect(courses.find((c) => c.code === "TRL 100")!.sections.map((s) => [s.id, s.instructors])).toEqual([
      ["PA", []],
      ["R", ["ZELİHA AYDIN ŞAHİN"]],
    ]);
  });
});

describe("fetchTermOfferings", () => {
  it("program listesini izleyerek her programı bir kez getirir", async () => {
    const urls: string[] = [];
    const result = await fetchTermOfferings("202610", {
      delayMs: 0,
      seeds: ["BSCS"],
      fetchText: async (url) => {
        urls.push(url);
        return html;
      },
    });
    expect(urls).toHaveLength(6); // BSCS + listedeki diğer 5 program
    expect(urls[0]).toBe("https://www.ozyegin.edu.tr/tr/acilan-dersler?term=202610&program=BSCS");
    expect(result!.term.id).toBe("2026-2027-guz");
    expect(result!.courses).toHaveLength(7);
  });

  it("dönem yayında değilse tek istekle null döner", async () => {
    let calls = 0;
    const empty = html.replace('value="202610" selected="selected"', 'value="202610"').replace('value="202620"', 'value="202620" selected="selected"').replace(/<table[\s\S]*$/, "");
    const result = await fetchTermOfferings("202620", { delayMs: 0, fetchText: async () => (calls++, empty) });
    expect(result).toBeNull();
    expect(calls).toBe(1);
  });

  it("sayfa başka dönem gösterirse hata verir", async () => {
    await expect(fetchTermOfferings("202620", { delayMs: 0, fetchText: async () => html })).rejects.toThrow(/202620/);
  });
});

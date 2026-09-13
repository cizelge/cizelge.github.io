// export-snippet.js'i tarayıcı olmadan, sanal kaydırmalı ızgarayı taklit eden küçük bir sahte DOM üzerinde çalıştırır.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { buildTermData, type RawExport } from "./import";
import { validateTermData } from "../validate";

const SNIPPET = fs.readFileSync(path.join(__dirname, "export-snippet.js"), "utf8");

class El {
  children: El[] = [];
  parentElement: El | null = null;
  value: string | undefined;
  scrollTop = 0;
  clientHeight = 0;
  private listeners: Record<string, (() => void)[]> = {};
  scrollHeightOf: () => number = () => 0;
  layoutReads = 0;

  constructor(
    public tagName: string,
    public ownText = "",
  ) {}

  append(...kids: El[]) {
    for (const k of kids) {
      k.parentElement = this;
      this.children.push(k);
    }
    return this;
  }
  replaceChildren(...kids: El[]) {
    for (const k of this.children) k.parentElement = null;
    this.children = [];
    return this.append(...kids);
  }
  get textContent(): string {
    return this.ownText + this.children.map((c) => c.textContent).join("");
  }
  get innerText() {
    return this.textContent;
  }
  get childElementCount() {
    return this.children.length;
  }
  get nextElementSibling(): El | null {
    const sibs = this.parentElement?.children ?? [];
    return sibs[sibs.indexOf(this) + 1] ?? null;
  }
  get cells() {
    return this.children.filter((c) => c.tagName === "TD");
  }
  get scrollHeight() {
    return this.scrollHeightOf();
  }
  get offsetHeight() {
    this.layoutReads++;
    return this.clientHeight;
  }
  private descendants(): El[] {
    return this.children.flatMap((c) => [c, ...c.descendants()]);
  }
  querySelectorAll(selector: string): El[] {
    const tags = selector.split(",").map((s) => s.trim().toUpperCase());
    return this.descendants().filter((e) => tags.includes(e.tagName));
  }
  querySelector(selector: string): El | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  closest(selector: string): El | null {
    for (let e: El | null = this; e; e = e.parentElement) if (e.tagName === selector.toUpperCase()) return e;
    return null;
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  dispatchEvent(event: { type: string }) {
    for (const fn of this.listeners[event.type] ?? []) fn();
    return true;
  }
}

const h = (tag: string, text = "", ...kids: El[]) => new El(tag.toUpperCase(), text).append(...kids);

interface FakeRow {
  code: string;
  title: string;
  credits: string;
  info: string[];
  meetings: [string, string][];
}

function gridRow(r: FakeRow): El {
  const head = h("table", "", h("tr", "", h("td", r.code), h("td", r.title), h("td", r.credits)));
  const info = h("table", "", h("tr", "", ...r.info.map((t) => h("td", t))));
  const times = h("table", "", ...r.meetings.map(([d, t]) => h("tr", "", h("td", d), h("td", t))));
  return h("tr", "", h("td", "", head, info), h("td", "", times), h("td", "Kontenjan"));
}

const ROW_PX = 100;
const VIEW_PX = 600;

/** Yalnızca kaydırma olayında, görünen pencerenin (±1 satır) satırlarını çizen ızgara. */
function fakePage(rows: FakeRow[], expectedText: string) {
  const tbody = h("table");
  const gridBody = h("div", "", tbody);
  gridBody.clientHeight = VIEW_PX;
  gridBody.scrollHeightOf = () => rows.length * ROW_PX;
  const render = () => {
    const first = Math.max(0, Math.floor(gridBody.scrollTop / ROW_PX) - 1);
    const last = Math.min(rows.length, Math.ceil((gridBody.scrollTop + VIEW_PX) / ROW_PX) + 1);
    tbody.replaceChildren(...rows.slice(first, last).map(gridRow));
  };
  render();
  gridBody.addEventListener("scroll", render);

  const term = h("input");
  term.value = "2026 - 2027 Güz";
  const body = h("body", "", term, h("div", expectedText), h("div", "", gridBody));
  return { document: { body, querySelectorAll: (s: string) => body.querySelectorAll(s) }, gridBody };
}

function run(page: ReturnType<typeof fakePage>) {
  const warn = vi.fn();
  const context = {
    window: { __OZU_EXPORT_DRY_RUN__: true },
    document: page.document,
    Event: class {
      constructor(public type: string) {}
    },
    console: { log: () => {}, warn },
    // setTimeout, fetch, XMLHttpRequest bilerek yok: betik bunlara dokunursa hata verir.
  };
  const data = JSON.parse(JSON.stringify(vm.runInNewContext(SNIPPET, context)));
  return { data, warn };
}

const ROWS: FakeRow[] = Array.from({ length: 22 }, (_, i) => ({
  code: `CS ${100 + i}.A`,
  title: `Ders ${i}`,
  credits: "6 credits",
  info: ["", `HOCA ${i}`],
  meetings: [["Pazartesi", "10:40 - 12:30"]],
}));
ROWS.splice(
  5,
  0,
  {
    code: "MİM 105.A",
    title: "Temel Tasarım",
    credits: "6 credits",
    info: ["Yan koşul: MİM 102", "SELİN  ÇAKIR"],
    meetings: [["Pazar", "09:00 - 12:50"]],
  },
  {
    code: "SAS 405_U.A",
    title: "Seminer",
    credits: "3 credits",
    info: ["", ""],
    meetings: [],
  },
  {
    code: "CS 201.B",
    title: "Bilgisayar Programlama II",
    credits: "6 credits",
    info: ["Yan koşul: CS 201L Ön koşul: (CS 102 or CS 105) and (CS112 or MATH 112)", "HASAN SÖZER"],
    meetings: [
      ["Salı", "12:40 - 14:30"],
      ["Perşembe", "12:40 - 14:30"],
    ],
  },
);

describe("export-snippet.js", () => {
  it("scrolls the virtualised grid and collects every row once, in format v2", () => {
    const page = fakePage(ROWS, "( 25 Kayıt Bulundu )");
    const { data, warn } = run(page);

    expect(data.formatVersion).toBe(2);
    expect(data.termLabel).toBe("2026 - 2027 Güz");
    expect(data.expected).toBe(25);
    expect(data.collected).toBe(25);
    expect(data.rows).toHaveLength(25);
    expect(warn).not.toHaveBeenCalled();
    expect(page.gridBody.layoutReads).toBeGreaterThan(0);

    const keys = data.rows.map((r: { subject: string; number: string; section: string }) => `${r.subject} ${r.number}.${r.section}`);
    expect(new Set(keys).size).toBe(25);
    expect(keys).toEqual(expect.arrayContaining(["MİM 105.A", "SAS 405_U.A", "CS 201.B", "CS 121.A"]));

    const cs201 = data.rows.find((r: { number: string }) => r.number === "201");
    expect(cs201).toEqual({
      subject: "CS",
      number: "201",
      section: "B",
      title: "Bilgisayar Programlama II",
      creditsText: "6 credits",
      infoCells: ["Yan koşul: CS 201L Ön koşul: (CS 102 or CS 105) and (CS112 or MATH 112)", "HASAN SÖZER"],
      meetings: [
        { dayText: "Salı", timeText: "12:40 - 14:30" },
        { dayText: "Perşembe", timeText: "12:40 - 14:30" },
      ],
    });
    const mim = data.rows.find((r: { subject: string }) => r.subject === "MİM");
    expect(mim.infoCells).toEqual(["Yan koşul: MİM 102", "SELİN ÇAKIR"]);
    expect(mim.meetings).toEqual([{ dayText: "Pazar", timeText: "09:00 - 12:50" }]);
    expect(data.rows.find((r: { subject: string }) => r.subject === "SAS").number).toBe("405_U");
  });

  it("warns when the collected count differs from the page's record count", () => {
    const { data, warn } = run(fakePage(ROWS, "( 30 Kayıt Bulundu )"));
    expect(data).toMatchObject({ expected: 30, collected: 25 });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("produces an export the importer accepts", () => {
    const { data } = run(fakePage(ROWS, "( 25 Kayıt Bulundu )"));
    const term = buildTermData([data as RawExport], { fetchedAt: data.exportedAt });
    expect(validateTermData(term)).toEqual([]);
    const mim = term.courses.find((c) => c.code === "MİM 105")!;
    expect(mim).toMatchObject({ slug: "mim-105", corequisites: ["MİM 102"] });
    expect(mim.sections[0].meetings[0].day).toBe(7);
    expect(term.courses.find((c) => c.code === "CS 201")!.prerequisites).toBe("(CS 102 or CS 105) and (CS112 or MATH 112)");
  });
});

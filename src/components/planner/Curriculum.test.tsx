// Tarayıcısız duman testi: bileşen örnek veriyle sunucuda çizilebiliyor ve doğru durumları gösteriyor.
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProgramsData, TermData } from "@/lib/types";
import { Curriculum } from "./Curriculum";

const read = <T,>(f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "data-sample/ozyegin", f), "utf8")) as T;
const programs = read<ProgramsData>("programs.json").programs;
const term = read<TermData>("ornek.json");
const noop = () => {};

const render = (props: Partial<Parameters<typeof Curriculum>[0]>) =>
  renderToStaticMarkup(
    <Curriculum
      programs={programs}
      termLabel={term.termLabel}
      courses={term.courses}
      cart={[]}
      program={null}
      year={null}
      onSelect={noop}
      onAdd={noop}
      onAddMany={noop}
      {...props}
    />,
  );

describe("Curriculum", () => {
  it("shows labelled selects grouped by faculty and no list before a choice", () => {
    const html = render({});
    expect(html).toContain("Bölümün");
    expect(html).toContain("Sınıfın");
    expect(html).toMatch(/<optgroup label="Mimarlık ve Tasarım Fakültesi">.*<optgroup label="Mühendislik Fakültesi">/);
    expect(html).not.toContain("Bu dönemin derslerini ekle");
  });

  it("lists the year's courses, the add button and grouped electives", () => {
    const html = render({ program: "BSCS", year: 2, cart: ["EE 201"] });
    expect(html).toContain("Bu dönemin derslerini ekle");
    expect(html).toContain("CS 201");
    expect(html).toContain("Bu dönem yok");
    expect(html).toContain("Sepette");
    expect(html).toContain('<summary>Program-İçi Seçmeli<span class="num"> (2)</span></summary>');
    expect(html).not.toContain("Hazırlık");
  });

  it("offers Hazırlık only for programs that have it, and hints in summer", () => {
    expect(render({ program: "BSARCH (TR)" })).toContain("Hazırlık");
    expect(render({ program: "BSCS", year: 1, termLabel: "2026 - 2027 Yaz" })).toContain("Yaz döneminde");
    expect(render({ program: "BSCS", year: 1, termLabel: "2026 - 2027 Yaz" })).not.toContain("Bu dönemin derslerini ekle");
  });
});

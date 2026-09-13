// Tarayıcısız duman testi: dönem seçicinin işaretlemesi.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildTermOptions, parseTermLabel } from "@/lib/terms";
import { TermSelect } from "./TermSelect";

const options = (...labels: string[]) => buildTermOptions(labels.map(parseTermLabel));

/** Görünen metni `text` olan ilk <a> ya da <button> öğesi. */
const tag = (html: string, text: string) => html.match(new RegExp(`<(a|button) [^>]*>${text}</(a|button)>`))?.[0] ?? "";

const render = (props: Partial<Parameters<typeof TermSelect>[0]>) =>
  renderToStaticMarkup(
    <TermSelect schoolId="ozyegin" currentId="2026-2027-guz" options={options("2026 - 2027 Güz")} query="" {...props} />,
  );

describe("TermSelect", () => {
  it("with only Güz available: Güz is current, Bahar and Yaz are disabled with a visible hint", () => {
    const html = render({});
    expect(html).toContain("2026 - 2027");
    expect(tag(html, "Güz")).toMatch(/^<a /);
    expect(tag(html, "Güz")).toContain('href="/ozyegin"');
    expect(tag(html, "Güz")).toContain('aria-current="page"');
    expect(tag(html, "Bahar")).toMatch(/^<button [^]*aria-disabled="true"/);
    expect(tag(html, "Yaz")).toMatch(/^<button [^]*aria-disabled="true"/);
    expect(tag(html, "Yaz")).toContain('title="Yaz henüz yayınlanmadı"');
    expect(html).toContain("Bahar ve Yaz henüz yayınlanmadı.");
    expect(html).not.toContain("Diğer dönemler");
  });

  it("links available terms to their routes carrying the share query", () => {
    const html = render({
      currentId: "2026-2027-bahar",
      options: options("2026 - 2027 Güz", "2026 -2027 Bahar"),
      query: "d=CS101,MATH103&bos=5&bolum=BSCS&sinif=1",
    });
    expect(tag(html, "Güz")).toContain('href="/ozyegin/donem/2026-2027-guz?d=CS101,MATH103&amp;bos=5&amp;bolum=BSCS&amp;sinif=1"');
    expect(tag(html, "Güz")).not.toContain("aria-current");
    expect(tag(html, "Bahar")).toContain('href="/ozyegin?d=CS101,MATH103&amp;bos=5&amp;bolum=BSCS&amp;sinif=1"');
    expect(tag(html, "Bahar")).toContain('aria-current="page"');
    expect(html).toContain("Yaz henüz yayınlanmadı.");
  });

  it("lists terms of other years after the three seasons", () => {
    const html = render({ options: options("2025 - 2026 Yaz", "2026 - 2027 Güz") });
    expect(html).toMatch(/Diğer dönemler:.*href="\/ozyegin\/donem\/2025-2026-yaz"[^>]*>2025 - 2026 Yaz<\/a>/);
  });

  it("renders nothing without options", () => {
    expect(render({ options: [] })).toBe("");
  });
});

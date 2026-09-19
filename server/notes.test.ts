import { describe, expect, it } from "vitest";
import { cleanTitle, cleanUrl, isAllowedHost, parseNote, sortNotes, type NoteRow } from "./notes.ts";

const valid = {
  school: "ozyegin",
  course: "CS 201",
  url: "https://drive.google.com/file/d/abc123/view",
  title: "Final özeti",
  kind: "ozet",
  term: "2025-2026-guz",
  instructor: "hasan-sozer",
  device: "a".repeat(20),
};

describe("isAllowedHost", () => {
  it("bilinen servisleri ve alt alan adlarını kabul eder", () => {
    expect(isAllowedHost("drive.google.com")).toBe(true);
    expect(isAllowedHost("www.dropbox.com")).toBe(true);
    expect(isAllowedHost("okul.sharepoint.com")).toBe(true);
  });

  it("başka siteyi kabul etmez", () => {
    expect(isAllowedHost("bilinmeyen-site.com")).toBe(false);
    expect(isAllowedHost("drive.google.com.kotu.site")).toBe(false);
  });
});

describe("cleanUrl", () => {
  it("geçerli bağlantıyı alır", () => {
    expect(cleanUrl("https://drive.google.com/file/d/x/view")).toMatchObject({ ok: true });
  });

  it("http ve boş bağlantıyı almaz", () => {
    expect(cleanUrl("http://drive.google.com/x")).toMatchObject({ ok: false });
    expect(cleanUrl("")).toMatchObject({ ok: false });
    expect(cleanUrl("drive.google.com/x")).toMatchObject({ ok: false });
  });

  it("izin verilmeyen siteyi anlaşılır hatayla reddeder", () => {
    const r = cleanUrl("https://kotu-site.example/dosya.exe");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("kabul edilmiyor");
  });
});

describe("cleanTitle", () => {
  it("fazla boşluğu atar", () => {
    expect(cleanTitle("  Final   özeti ")).toEqual({ ok: true, title: "Final özeti" });
  });

  it("çok kısa ve çok uzun başlığı almaz", () => {
    expect(cleanTitle("ab")).toMatchObject({ ok: false });
    expect(cleanTitle("x".repeat(81))).toMatchObject({ ok: false });
  });

  it("hakaret içereni almaz", () => {
    expect(cleanTitle("şerefsiz hocanın notları")).toMatchObject({ ok: false });
  });
});

describe("parseNote", () => {
  it("geçerli kaydı kabul eder", () => {
    const r = parseNote(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.note).toMatchObject({ course: "CS201", kind: "ozet", instructor: "hasan-sozer" });
  });

  it("dönem ve hoca boş bırakılabilir", () => {
    const r = parseNote({ ...valid, term: "", instructor: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.note).toMatchObject({ term: null, instructor: null });
  });

  it("bilinmeyen türü almaz", () => {
    expect(parseNote({ ...valid, kind: "kitap" })).toMatchObject({ ok: false });
  });

  it("ders kodu bozuksa almaz", () => {
    expect(parseNote({ ...valid, course: "ders" })).toMatchObject({ ok: false });
  });

  it("uydurma dönemi almaz", () => {
    expect(parseNote({ ...valid, term: "2025-guz" })).toMatchObject({ ok: false });
  });
});

describe("sortNotes", () => {
  it("yeniden eskiye sıralar", () => {
    const row = (id: string, at: string): NoteRow =>
      ({ id, at, url: "https://drive.google.com/x", title: id, kind: "ozet", term: null, instructor: null, mine: false });
    const sorted = sortNotes([row("eski", "2026-01-01T00:00:00Z"), row("yeni", "2026-05-01T00:00:00Z")]);
    expect(sorted.map((r) => r.id)).toEqual(["yeni", "eski"]);
  });
});

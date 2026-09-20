import { describe, expect, it } from "vitest";
import { parseFeedback } from "./feedback.ts";

const valid = {
  school: "ozyegin",
  kind: "hata",
  message: "CS 201 şubesinin saati yanlış görünüyor, SIS'te 16:40 yazıyor.",
  contact: "ornek@ozu.edu.tr",
  page: "/ozyegin/cs-201",
  device: "a".repeat(20),
};

describe("parseFeedback", () => {
  it("geçerli mesajı kabul eder", () => {
    const r = parseFeedback(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.feedback).toMatchObject({ kind: "hata", page: "/ozyegin/cs-201" });
  });

  it("iletişim ve sayfa boş bırakılabilir", () => {
    const r = parseFeedback({ ...valid, contact: "", page: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.feedback).toMatchObject({ contact: null, page: null });
  });

  it("fazla boşlukları temizler", () => {
    const r = parseFeedback({ ...valid, message: "  Çok   güzel   olmuş,   teşekkürler  " });
    expect(r.ok && r.feedback.message).toBe("Çok güzel olmuş, teşekkürler");
  });

  it("kısa ve çok uzun mesajı almaz", () => {
    expect(parseFeedback({ ...valid, message: "kısa" })).toMatchObject({ ok: false });
    expect(parseFeedback({ ...valid, message: "a".repeat(1001) })).toMatchObject({ ok: false });
  });

  it("bilinmeyen türü almaz", () => {
    expect(parseFeedback({ ...valid, kind: "sikayet" })).toMatchObject({ ok: false });
  });

  it("dışarıdan adres taşıyan sayfa bilgisini atar", () => {
    const r = parseFeedback({ ...valid, page: "https://baska-site.example/x" });
    expect(r.ok && r.feedback.page).toBeNull();
  });

  it("cihaz kimliği geçersizse almaz", () => {
    expect(parseFeedback({ ...valid, device: "kisa" })).toMatchObject({ ok: false });
  });
});

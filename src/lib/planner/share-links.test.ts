import { describe, expect, it } from "vitest";
import { SHARE_TEXT, whatsappLink } from "./share-links";

describe("whatsappLink", () => {
  it("metni ve adresi birlikte kodlar", () => {
    const link = whatsappLink("Merhaba dünya", "https://ozuhelper.github.io/ozyegin?d=CS201");
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(link.slice("https://wa.me/?text=".length));
    expect(text).toBe("Merhaba dünya https://ozuhelper.github.io/ozyegin?d=CS201");
  });

  it("adresteki & ve = işaretleri bozulmaz", () => {
    const url = "https://ozuhelper.github.io/ozyegin?d=CS201,MATH211&kilit=CS201:A";
    const decoded = decodeURIComponent(whatsappLink("x", url).split("text=")[1]);
    expect(decoded.endsWith(url)).toBe(true);
  });

  it("hazır metinler boş değil", () => {
    for (const text of Object.values(SHARE_TEXT)) expect(text.length).toBeGreaterThan(10);
  });
});

import { describe, expect, it } from "vitest";
import type { Meeting } from "../types";
import { attendance, attendanceText, weeklyHours } from "./attendance";

const m = (start: string, end: string): Meeting => ({ day: 1, start, end, room: null });

describe("weeklyHours", () => {
  it("oturum süresini ders saatine çevirir", () => {
    expect(weeklyHours([m("16:40", "18:30")])).toBe(2);
    expect(weeklyHours([m("09:40", "10:30")])).toBe(1);
    expect(weeklyHours([m("11:40", "14:30")])).toBe(3);
  });

  it("bütün oturumları toplar", () => {
    expect(weeklyHours([m("08:40", "10:30"), m("13:40", "14:30")])).toBe(3);
  });

  it("saati olmayan derste sıfır", () => {
    expect(weeklyHours([])).toBe(0);
  });
});

describe("attendance", () => {
  it("varsayılan sınırla hakkı hesaplar", () => {
    // Haftada 3 saat, 14 hafta = 42 saat; %30 = 12 saat hak.
    const a = attendance(3, 0);
    expect(a).toMatchObject({ total: 42, allowed: 12, left: 12, weeksLeft: 4, state: "ok" });
  });

  it("kaçırılanı düşer", () => {
    expect(attendance(3, 7)).toMatchObject({ left: 5, weeksLeft: 1, state: "ok" });
  });

  it("son haftaya inince uyarır", () => {
    expect(attendance(3, 10).state).toBe("warn");
  });

  it("hak bitince de uyarı durumunda kalır", () => {
    expect(attendance(3, 12)).toMatchObject({ left: 0, weeksLeft: 0, state: "warn" });
  });

  it("sınır aşılınca aşıldı der", () => {
    expect(attendance(3, 15)).toMatchObject({ left: -3, state: "over" });
  });

  it("sınır yüzdesi değişince hak değişir", () => {
    expect(attendance(3, 0, 20).allowed).toBe(8);
    expect(attendance(3, 0, 10).allowed).toBe(4);
  });

  it("saatsiz derste bölme hatası vermez", () => {
    expect(attendance(0, 0)).toMatchObject({ total: 0, allowed: 0, weeksLeft: 0 });
  });
});

describe("attendanceText", () => {
  it("kalan haftayı yazar", () => {
    expect(attendanceText(attendance(3, 0))).toBe("12 ders saati hakkın kaldı, yani 4 hafta daha kaçırabilirsin.");
  });

  it("tek haftada tekil yazar", () => {
    expect(attendanceText(attendance(3, 7))).toContain("1 hafta daha");
  });

  it("bir haftayı doldurmayan hakkı ayırır", () => {
    expect(attendanceText(attendance(3, 11))).toBe("1 ders saati hakkın kaldı, bir haftalık ders bile etmiyor.");
  });

  it("hak bitince son uyarıyı verir", () => {
    expect(attendanceText(attendance(3, 12))).toBe("Hakkın bitti. Bir ders daha kaçırırsan devamdan kalırsın.");
  });

  it("aşılınca kaç saat aşıldığını söyler", () => {
    expect(attendanceText(attendance(3, 15))).toContain("3 ders saati aştın");
  });

  it("saati olmayan dersi anlatır", () => {
    expect(attendanceText(attendance(0, 0))).toContain("saati belli değil");
  });
});

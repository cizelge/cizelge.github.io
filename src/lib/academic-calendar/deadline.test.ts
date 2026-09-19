import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "./types";
import { deadlineText, isDeadline, pickDeadline } from "./deadline";

const event = (id: string, title: string, start: string, end: string | null, category: CalendarEvent["category"]): CalendarEvent => ({
  id,
  title,
  start,
  end,
  category,
  term: "guz",
  source: 0,
});

const ekleme = event("e", "Güz ders ekleme-bırakma", "2026-09-23", "2026-09-29", "ders");
const cekilme = event("c", "Güz dersten çekilme", "2026-11-23", "2026-11-27", "ders");
const kayit = event("k", "Güz ders kayıtları", "2026-09-14", "2026-09-16", "kayit");
const uzun = event("u", "Yurt dışından kabul edilenlerin kayıtları", "2026-07-01", "2026-11-30", "kayit");
const sinav = event("s", "Güz dönemi sonu sınavları", "2026-12-28", "2027-01-08", "sinav");
const hepsi = [ekleme, cekilme, kayit, uzun, sinav];

describe("isDeadline", () => {
  it("kayıt, ekleme-bırakma ve çekilme sayılır; sınav sayılmaz", () => {
    expect(isDeadline(ekleme)).toBe(true);
    expect(isDeadline(cekilme)).toBe(true);
    expect(isDeadline(kayit)).toBe(true);
    expect(isDeadline(sinav)).toBe(false);
  });
});

describe("pickDeadline", () => {
  it("süren işi seçer, aylarca sürenleri atlar", () => {
    expect(pickDeadline(hepsi, "2026-09-25")?.id).toBe("e");
    expect(pickDeadline(hepsi, "2026-09-15")?.id).toBe("k");
  });

  it("yedi gün içinde başlayanı gösterir, uzağı göstermez", () => {
    expect(pickDeadline(hepsi, "2026-09-19")?.id).toBe("e");
    // 5 Eylül'de en yakın iş 14 Eylül'deki kayıt: dokuz gün uzak, bant çıkmaz.
    expect(pickDeadline(hepsi, "2026-09-05")).toBeNull();
    expect(pickDeadline(hepsi, "2026-10-15")).toBeNull();
  });

  it("biten iş gösterilmez", () => {
    expect(pickDeadline([ekleme], "2026-09-30")).toBeNull();
  });
});

describe("deadlineText", () => {
  it("süren iş: kalan gün ve son gün", () => {
    expect(deadlineText(ekleme, "2026-09-26")).toEqual({
      head: "Güz ders ekleme-bırakma sürüyor",
      detail: "29 Eylül'de bitiyor, 3 gün kaldı",
      urgent: false,
    });
    expect(deadlineText(ekleme, "2026-09-28")).toMatchObject({ detail: "yarın bitiyor (29 Eylül)", urgent: true });
    expect(deadlineText(ekleme, "2026-09-29")).toMatchObject({ detail: "bugün son gün (29 Eylül)", urgent: true });
  });

  it("yaklaşan iş: kaç gün kaldı", () => {
    expect(deadlineText(ekleme, "2026-09-19")).toMatchObject({ head: "Güz ders ekleme-bırakma", detail: "23 Eylül'de başlıyor, 4 gün kaldı" });
    expect(deadlineText(ekleme, "2026-09-22").detail).toContain("yarın başlıyor");
  });
});

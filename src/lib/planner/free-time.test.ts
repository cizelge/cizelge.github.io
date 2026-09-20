import { describe, expect, it } from "vitest";
import { busyMask, combine, decodeMask, encodeMask, freeBlocks, spanLabel } from "./free-time";

const m = (day: 1 | 2 | 3 | 4 | 5, start: string, end: string) => ({ day, start, end }) as const;

describe("busyMask / freeBlocks", () => {
  it("dersin saati doluya, kalanı boşa düşer", () => {
    const mask = busyMask([m(1, "08:40", "10:30")]);
    const free = freeBlocks(mask, { days: [1], min: 30 });
    expect(free).toEqual([{ day: 1, start: "10:30", end: "20:30", minutes: 600 }]);
  });

  it("iki ders arasındaki boşluğu bulur", () => {
    const mask = busyMask([m(2, "08:40", "10:30"), m(2, "13:40", "15:30")]);
    const free = freeBlocks(mask, { days: [2], min: 60 });
    expect(free).toEqual([
      { day: 2, start: "10:30", end: "13:40", minutes: 190 },
      { day: 2, start: "15:30", end: "20:30", minutes: 300 },
    ]);
  });

  it("kısa boşluğu atar", () => {
    const mask = busyMask([m(3, "08:40", "10:30"), m(3, "11:00", "20:30")]);
    expect(freeBlocks(mask, { days: [3], min: 60 })).toEqual([]);
    expect(freeBlocks(mask, { days: [3], min: 20 })).toEqual([{ day: 3, start: "10:30", end: "11:00", minutes: 30 }]);
  });

  it("boş günde bütün gün boştur", () => {
    const free = freeBlocks(busyMask([]), { days: [5], min: 60 });
    expect(free).toEqual([{ day: 5, start: "08:40", end: "20:30", minutes: 710 }]);
  });
});

describe("combine", () => {
  it("birinin dersi varsa ortak boş sayılmaz", () => {
    const a = busyMask([m(1, "08:40", "10:30")]);
    const b = busyMask([m(1, "10:30", "12:20")]);
    const free = freeBlocks(combine([a, b]), { days: [1], min: 30 });
    expect(free).toEqual([{ day: 1, start: "12:20", end: "20:30", minutes: 490 }]);
  });

  it("üç kişinin ortak boşluğu", () => {
    const masks = [
      busyMask([m(4, "08:40", "12:20")]),
      busyMask([m(4, "15:30", "18:30")]),
      busyMask([m(4, "18:30", "20:30")]),
    ];
    expect(freeBlocks(combine(masks), { days: [4], min: 60 })).toEqual([
      { day: 4, start: "12:20", end: "15:30", minutes: 190 },
    ]);
  });
});

describe("encodeMask / decodeMask", () => {
  it("kodlanıp çözülünce aynı kalır", () => {
    const mask = busyMask([m(1, "08:40", "10:30"), m(3, "16:40", "18:30"), m(5, "11:40", "14:30")]);
    const back = decodeMask(encodeMask(mask));
    expect(back).not.toBeNull();
    expect([...back!]).toEqual([...mask]);
  });

  it("kod adres çubuğuna sığar", () => {
    const mask = busyMask([m(1, "08:40", "18:30"), m(2, "08:40", "18:30"), m(3, "08:40", "18:30")]);
    expect(encodeMask(mask).length).toBeLessThanOrEqual(80);
  });

  it("boş programın kodu kısadır", () => {
    expect(encodeMask(busyMask([])).length).toBeLessThanOrEqual(4);
  });

  it("bozuk kodu almaz", () => {
    expect(decodeMask("!!!")).toBeNull();
    expect(decodeMask("")).toBeNull();
  });
});

describe("spanLabel", () => {
  it("süreyi okunur yazar", () => {
    expect(spanLabel(45)).toBe("45 dk");
    expect(spanLabel(120)).toBe("2 sa");
    expect(spanLabel(110)).toBe("1 sa 50 dk");
  });
});

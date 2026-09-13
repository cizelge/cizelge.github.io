import { describe, expect, it } from "vitest";
import { DAY_NAMES, DAY_SHORT, visibleDays } from "./days";

describe("day names", () => {
  it("covers Monday (1) to Sunday (7)", () => {
    expect(DAY_NAMES[1]).toBe("Pazartesi");
    expect(DAY_NAMES[6]).toBe("Cumartesi");
    expect(DAY_NAMES[7]).toBe("Pazar");
    expect(DAY_SHORT[7]).toBe("Paz");
  });
});

describe("visibleDays", () => {
  it("shows Monday–Friday when nothing meets on the weekend", () => {
    expect(visibleDays([])).toEqual([1, 2, 3, 4, 5]);
    expect(visibleDays([{ day: 2 }, { day: 5 }])).toEqual([1, 2, 3, 4, 5]);
  });

  it("adds Saturday and/or Sunday only when some meeting uses them", () => {
    expect(visibleDays([{ day: 6 }])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(visibleDays([{ day: 7 }])).toEqual([1, 2, 3, 4, 5, 7]);
    expect(visibleDays([{ day: 7 }, { day: 1 }, { day: 6 }])).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

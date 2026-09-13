import { describe, expect, it } from "vitest";
import { assignLanes, tightRange } from "./placed";

describe("assignLanes", () => {
  it("keeps non-overlapping meetings in a single lane", () => {
    expect(
      assignLanes([
        { day: 1, start: "08:40", end: "10:30" },
        { day: 1, start: "10:40", end: "12:30" },
        { day: 2, start: "08:40", end: "10:30" },
      ]),
    ).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ]);
  });

  it("puts same-time sections side by side", () => {
    expect(
      assignLanes([
        { day: 3, start: "16:40", end: "18:30" },
        { day: 3, start: "16:40", end: "18:30" },
      ]),
    ).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
    ]);
  });

  it("reuses a lane once it frees up inside a chain of overlaps", () => {
    const lanes = assignLanes([
      { day: 1, start: "09:00", end: "11:00" },
      { day: 1, start: "10:00", end: "12:00" },
      { day: 1, start: "11:00", end: "13:00" },
    ]);
    expect(lanes.map((l) => l.lane)).toEqual([0, 1, 0]);
    expect(lanes.every((l) => l.lanes === 2)).toBe(true);
  });
});

describe("tightRange", () => {
  it("rounds to whole hours around the meetings with a minimum span", () => {
    expect(tightRange([{ start: "16:40", end: "18:30" }])).toEqual({ start: 15 * 60, end: 19 * 60 });
    expect(tightRange([{ start: "08:40", end: "18:30" }])).toEqual({ start: 8 * 60, end: 19 * 60 });
  });
});

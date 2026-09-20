import { describe, expect, it } from "vitest";
import { computeMetrics, rankTop, rescore, scoreMetrics, summarize } from "./score";
import type { Candidate, ScheduleMetrics, Weights } from "./types";
import { parseTime } from "./timemask";
import type { Day } from "./timemask";

const iv = (day: Day, start: string, end: string) => ({
  day,
  start: parseTime(start),
  end: parseTime(end),
});
const TH = { early: parseTime("09:40"), late: parseTime("17:40") };
const ZERO: Weights = { fewDays: 0, fewGaps: 0, lunchBreak: 0, noEarly: 0, noLate: 0 };

describe("computeMetrics", () => {
  it("returns zeros and nulls for a schedule without meetings", () => {
    expect(computeMetrics([], TH)).toEqual({
      days: 0,
      gapMinutes: 0,
      noLunchDays: 0,
      earlyCount: 0,
      lateCount: 0,
      earliestStart: null,
      latestEnd: null,
    });
  });

  it("counts distinct days with meetings", () => {
    const m = computeMetrics(
      [iv(1, "10:40", "12:30"), iv(1, "15:40", "17:30"), iv(3, "10:40", "12:30")],
      TH,
    );
    expect(m.days).toBe(2);
  });

  it("counts Saturday and Sunday meetings like any other day", () => {
    const m = computeMetrics(
      [iv(6, "10:40", "12:30"), iv(7, "08:40", "10:30"), iv(7, "15:40", "17:30")],
      TH,
    );
    expect(m.days).toBe(2);
    expect(m.gapMinutes).toBe(310);
    expect(m.earlyCount).toBe(1);
  });

  it("sums gaps between consecutive meetings within each day, regardless of input order", () => {
    const m = computeMetrics(
      [
        iv(1, "15:40", "17:30"), // gap 12:30 -> 15:40 = 190
        iv(1, "08:40", "10:30"), // gap 10:30 -> 10:40 = 10
        iv(1, "10:40", "12:30"),
        iv(2, "10:40", "12:30"), // single meeting: no gap
      ],
      TH,
    );
    expect(m.gapMinutes).toBe(200);
  });

  it("does not count time before the first or after the last meeting as gap", () => {
    expect(computeMetrics([iv(4, "08:40", "09:30")], TH).gapMinutes).toBe(0);
  });

  it("counts days with meetings that lack a 60-minute free window in 12:00–14:00", () => {
    const m = computeMetrics(
      [
        iv(1, "12:40", "13:30"), // free 12:00-12:40 (40), 13:30-14:00 (30) -> no lunch
        iv(2, "10:40", "12:30"), // free 12:30-14:00 (90) -> ok
        iv(3, "12:00", "13:00"), // free 13:00-14:00 (60) -> ok (>= 60)
        iv(4, "11:40", "13:05"), // free 13:05-14:00 (55) -> no lunch
        iv(5, "12:30", "13:00"),
        iv(5, "13:00", "13:30"), // free 30 + 30 -> no lunch (windows are not added up)
      ],
      TH,
    );
    expect(m.noLunchDays).toBe(3);
  });

  it("does not penalise lunch on days without meetings", () => {
    expect(computeMetrics([iv(1, "08:40", "10:30")], TH).noLunchDays).toBe(0);
  });

  it("counts early starts and late ends with strict thresholds", () => {
    const m = computeMetrics(
      [
        iv(1, "08:40", "10:30"), // early
        iv(2, "09:40", "11:30"), // exactly at threshold: not early
        iv(3, "16:00", "17:40"), // exactly at threshold: not late
        iv(4, "17:40", "19:30"), // late
        iv(5, "07:00", "21:00"), // both
      ],
      TH,
    );
    expect(m.earlyCount).toBe(2);
    expect(m.lateCount).toBe(2);
    expect(m.earliestStart).toBe(parseTime("07:00"));
    expect(m.latestEnd).toBe(parseTime("21:00"));
  });
});

describe("scoreMetrics", () => {
  const metrics: ScheduleMetrics = {
    days: 3,
    gapMinutes: 90,
    noLunchDays: 2,
    earlyCount: 1,
    lateCount: 4,
    earliestStart: 520,
    latestEnd: 1170,
  };

  it("is 0 when all weights are 0", () => {
    expect(scoreMetrics(metrics, ZERO)).toBe(0);
  });

  it("is the weighted sum, with gaps in hours and a day worth DAY_HOURS", () => {
    const w: Weights = { fewDays: 1, fewGaps: 2, lunchBreak: 3, noEarly: 1, noLate: 2 };
    // 1*(3*3) + 2*1.5 + 3*2 + 1*1 + 2*4 = 9 + 3 + 6 + 1 + 8 = 27
    expect(scoreMetrics(metrics, w)).toBeCloseTo(27, 10);
  });

  it("bir gün, bir saatlik boşluktan pahalıdır", () => {
    const azGun: Weights = { fewDays: 3, fewGaps: 1, lunchBreak: 0, noEarly: 0, noLate: 0 };
    const dortGunAzBosluk: ScheduleMetrics = { ...metrics, days: 4, gapMinutes: 280 };
    const ucGunCokBosluk: ScheduleMetrics = { ...metrics, days: 3, gapMinutes: 470 };
    // "Az gün" seçiliyken üç günlük program, dört günlüğün önüne geçmeli.
    expect(scoreMetrics(ucGunCokBosluk, azGun)).toBeLessThan(scoreMetrics(dortGunAzBosluk, azGun));
  });
});

describe("summarize", () => {
  it("formats times for display", () => {
    expect(
      summarize({
        days: 3,
        gapMinutes: 60,
        noLunchDays: 0,
        earlyCount: 0,
        lateCount: 0,
        earliestStart: 640,
        latestEnd: 1050,
      }),
    ).toEqual({ days: 3, gapMinutes: 60, earliestStart: "10:40", latestEnd: "17:30" });
  });

  it("keeps nulls for empty schedules", () => {
    const s = summarize(computeMetrics([], TH));
    expect(s.earliestStart).toBeNull();
    expect(s.latestEnd).toBeNull();
  });
});

describe("rankTop / rescore", () => {
  const cand = (id: string, days: number, earlyCount: number): Candidate => ({
    sections: [{ courseCode: "X 1", sectionId: id }],
    metrics: {
      days,
      gapMinutes: 0,
      noLunchDays: 0,
      earlyCount,
      lateCount: 0,
      earliestStart: 600,
      latestEnd: 700,
    },
  });
  const pool = [cand("A", 4, 0), cand("B", 2, 3), cand("C", 3, 1), cand("D", 2, 2)];

  it("orders by score ascending, keeping discovery order on ties", () => {
    const ranked = rescore(pool, { ...ZERO, fewDays: 1 });
    expect(ranked.map((r) => r.sections[0].sectionId)).toEqual(["B", "D", "C", "A"]);
    // Gün sayısı DAY_HOURS ile çarpılır: 2, 2, 3, 4 gün -> 6, 6, 9, 12.
    expect(ranked.map((r) => r.score)).toEqual([6, 6, 9, 12]);
    expect(ranked[0].summary.days).toBe(2);
  });

  it("re-ranks the same candidates when weights change", () => {
    const ranked = rescore(pool, { ...ZERO, noEarly: 3 });
    expect(ranked.map((r) => r.sections[0].sectionId)).toEqual(["A", "C", "D", "B"]);
  });

  it("returns only the best N, equal to a full sort", () => {
    const many: Candidate[] = [];
    for (let i = 0; i < 500; i++) many.push(cand(String(i), (i * 7919) % 13, (i * 31) % 5));
    const w: Weights = { ...ZERO, fewDays: 2, noEarly: 1 };
    const top = rankTop(many, w, 50);
    const full = many
      .map((c, i) => ({ i, s: scoreMetrics(c.metrics, w) }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .slice(0, 50)
      .map((x) => String(x.i));
    expect(top).toHaveLength(50);
    expect(top.map((r) => r.sections[0].sectionId)).toEqual(full);
    expect(rescore(many, w)).toEqual(top);
  });

  it("handles fewer candidates than N and an empty pool", () => {
    expect(rankTop(pool, ZERO, 50)).toHaveLength(4);
    expect(rankTop([], ZERO, 50)).toEqual([]);
  });
});

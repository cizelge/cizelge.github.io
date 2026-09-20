import { DAYS, formatTime } from "./timemask";
import type { Day } from "./timemask";
import type { Candidate, RankedSchedule, ScheduleMetrics, ScheduleSummary, Weights } from "./types";

/**
 * Scoring. Lower is better.
 *
 *   score = fewDays    * days with meetings
 *         + fewGaps    * gap HOURS (gapMinutes / 60)
 *         + lunchBreak * days with meetings lacking a 60-min free window in 12:00–14:00
 *         + noEarly    * meetings starting before the early threshold
 *         + noLate     * meetings ending after the late threshold
 *
 * Gaps are converted to hours so that one unit of every penalty is of a similar
 * magnitude: "one more day on campus" ~ "one more hour of waiting" ~ "one more
 * 08:40 lecture". In minutes the gap term would drown every other preference.
 */

export const DEFAULT_EARLY_THRESHOLD = "09:40";
export const DEFAULT_LATE_THRESHOLD = "17:40";
export const DEFAULT_TOP_N = 50;

const LUNCH_START = 12 * 60;
const LUNCH_END = 14 * 60;
const LUNCH_MIN_FREE = 60;

/** A meeting in minutes since midnight. */
export interface TimeInterval {
  day: Day;
  start: number;
  end: number;
}

export interface Thresholds {
  /** minutes since midnight */
  early: number;
  late: number;
}

export function computeMetrics(
  intervals: readonly TimeInterval[],
  thresholds: Thresholds,
): ScheduleMetrics {
  const byDay: TimeInterval[][] = Array.from({ length: DAYS + 1 }, () => []);
  let earlyCount = 0;
  let lateCount = 0;
  let earliestStart: number | null = null;
  let latestEnd: number | null = null;

  for (const iv of intervals) {
    byDay[iv.day].push(iv);
    if (iv.start < thresholds.early) earlyCount++;
    if (iv.end > thresholds.late) lateCount++;
    if (earliestStart === null || iv.start < earliestStart) earliestStart = iv.start;
    if (latestEnd === null || iv.end > latestEnd) latestEnd = iv.end;
  }

  let days = 0;
  let gapMinutes = 0;
  let noLunchDays = 0;

  for (let d = 1; d <= DAYS; d++) {
    const list = byDay[d];
    if (list.length === 0) continue;
    days++;
    if (list.length > 1) list.sort((a, b) => a.start - b.start);

    // Gap: free time between consecutive meetings. Running max end keeps this
    // correct even if intervals were to overlap.
    let maxEnd = list[0].end;
    for (let i = 1; i < list.length; i++) {
      if (list[i].start > maxEnd) gapMinutes += list[i].start - maxEnd;
      if (list[i].end > maxEnd) maxEnd = list[i].end;
    }

    // Lunch: longest single free window inside [12:00, 14:00].
    let cursor = LUNCH_START;
    let longestFree = 0;
    for (const iv of list) {
      if (iv.end <= LUNCH_START || iv.start >= LUNCH_END) continue;
      const busyFrom = Math.max(iv.start, LUNCH_START);
      if (busyFrom - cursor > longestFree) longestFree = busyFrom - cursor;
      cursor = Math.max(cursor, Math.min(iv.end, LUNCH_END));
    }
    if (LUNCH_END - cursor > longestFree) longestFree = LUNCH_END - cursor;
    if (longestFree < LUNCH_MIN_FREE) noLunchDays++;
  }

  return { days, gapMinutes, noLunchDays, earlyCount, lateCount, earliestStart, latestEnd };
}

/**
 * Kampüse gelinen bir günün, saatle ölçülen karşılığı. Yol, ara ve ölü zamanla birlikte
 * bir gün en az üç saatlik boşluğa denktir; bu olmadan "az gün" tercihi, birkaç saatlik
 * boşluk farkına yeniliyordu.
 */
export const DAY_HOURS = 3;

export function scoreMetrics(m: ScheduleMetrics, w: Weights): number {
  return (
    w.fewDays * m.days * DAY_HOURS +
    w.fewGaps * (m.gapMinutes / 60) +
    w.lunchBreak * m.noLunchDays +
    w.noEarly * m.earlyCount +
    w.noLate * m.lateCount
  );
}

export function summarize(m: ScheduleMetrics): ScheduleSummary {
  return {
    days: m.days,
    gapMinutes: m.gapMinutes,
    earliestStart: m.earliestStart === null ? null : formatTime(m.earliestStart),
    latestEnd: m.latestEnd === null ? null : formatTime(m.latestEnd),
  };
}

/**
 * Best `n` candidates by (score, index in `candidates`), best first.
 * Uses a bounded max-heap of size n: O(total · log n), no full sort.
 * The index tie-break makes the order deterministic and identical between
 * the first ranking and any later `rescore` with the same weights.
 */
export function rankTop(
  candidates: readonly Candidate[],
  weights: Weights,
  n: number = DEFAULT_TOP_N,
): RankedSchedule[] {
  if (n <= 0) return [];
  const heapIdx: number[] = [];
  const heapScore: number[] = [];
  // "a is worse than b" in the max-heap sense
  const worse = (i: number, j: number) =>
    heapScore[i] > heapScore[j] || (heapScore[i] === heapScore[j] && heapIdx[i] > heapIdx[j]);
  const swap = (i: number, j: number) => {
    [heapIdx[i], heapIdx[j]] = [heapIdx[j], heapIdx[i]];
    [heapScore[i], heapScore[j]] = [heapScore[j], heapScore[i]];
  };
  const siftUp = (i: number) => {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!worse(i, parent)) break;
      swap(i, parent);
      i = parent;
    }
  };
  const siftDown = (i: number) => {
    const size = heapIdx.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let top = i;
      if (l < size && worse(l, top)) top = l;
      if (r < size && worse(r, top)) top = r;
      if (top === i) break;
      swap(i, top);
      i = top;
    }
  };

  for (let i = 0; i < candidates.length; i++) {
    const s = scoreMetrics(candidates[i].metrics, weights);
    if (heapIdx.length < n) {
      heapIdx.push(i);
      heapScore.push(s);
      siftUp(heapIdx.length - 1);
    } else if (s < heapScore[0]) {
      // equal score never replaces: the earlier index already wins the tie
      heapIdx[0] = i;
      heapScore[0] = s;
      siftDown(0);
    }
  }

  const order = heapIdx.map((idx, k) => ({ idx, score: heapScore[k] }));
  order.sort((a, b) => a.score - b.score || a.idx - b.idx);
  return order.map(({ idx, score }) => ({
    sections: candidates[idx].sections,
    score,
    summary: summarize(candidates[idx].metrics),
  }));
}

/** Re-ranks already-found candidates for new weights without searching again. */
export function rescore(
  candidates: readonly Candidate[],
  weights: Weights,
  n: number = DEFAULT_TOP_N,
): RankedSchedule[] {
  return rankTop(candidates, weights, n);
}

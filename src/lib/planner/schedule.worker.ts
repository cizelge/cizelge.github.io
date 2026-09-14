// Program aramasını ana iş parçacığının dışında çalıştırır.
// Bulunan bütün programlar işçide kalır; sayfaya yalnızca istenen düzenler ve seçili düzenin şube seçenekleri gider.
import { generateSchedules, type Candidate, type GenerateInput, type NoSolutionReason, type RankedSchedule, type Suggestion } from "../engine";
import { alternativesOf, buildLayouts, toRanked, type Layouts } from "./layouts";

/** Tarayıcıda tutulan en fazla program; bundan çoksa `truncated` olur. */
export const WORKER_CANDIDATE_CAP = 200_000;

export interface WorkerRequest {
  id: number;
  input: GenerateInput;
  /** İlk kaç düzen gönderilsin. */
  layoutLimit: number;
  /** Şube seçenekleri gönderilecek düzen. */
  layout: number;
}

export interface LayoutCard {
  /** Düzenin en iyi programı. */
  best: RankedSchedule;
  /** Bu düzendeki program sayısı (aynı saatlerde farklı şube ya da hoca). */
  size: number;
}

export interface WorkerResult {
  /** Bulunan bütün programlar (sınırda kesildiyse sınır kadar). */
  total: number;
  truncated: boolean;
  layoutCount: number;
  layouts: LayoutCard[];
  /** `alternatives` listesinin ait olduğu düzen. */
  layout: number;
  /** Bu düzende ders kodu -> aynı saatlerde seçilebilecek şubeler (ilki en iyi programdaki). */
  alternatives: Record<string, string[]>;
  reason: NoSolutionReason | null;
  suggestions: Suggestion[];
}

export interface WorkerResponse {
  id: number;
  result: WorkerResult;
  ms: number;
}

let searchKey = "";
let search: { candidates: Candidate[]; truncated: boolean; reason: NoSolutionReason | null; suggestions: Suggestion[] } | null = null;
let layoutsKey = "";
let layouts: Layouts | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, input, layoutLimit, layout } = event.data;
  const started = performance.now();
  const { weights, ...constraints } = input;

  const key = JSON.stringify(constraints);
  if (!search || key !== searchKey) {
    const full = generateSchedules({ ...input, candidateCap: WORKER_CANDIDATE_CAP, topN: 0 });
    search = { candidates: full.candidates, truncated: full.truncated, reason: full.reason, suggestions: full.suggestions };
    searchKey = key;
    layouts = null;
  }
  const wKey = JSON.stringify(weights);
  if (!layouts || wKey !== layoutsKey) {
    layouts = buildLayouts(search.candidates, input.courses, weights);
    layoutsKey = wKey;
  }

  const { candidates } = search;
  const l = layouts;
  const layoutIndex = Math.max(0, Math.min(layout, l.groups.length - 1));
  const group = l.groups[layoutIndex] ?? [];
  const result: WorkerResult = {
    total: candidates.length,
    truncated: search.truncated,
    layoutCount: l.groups.length,
    layouts: l.groups.slice(0, layoutLimit).map((g) => ({ best: toRanked(candidates, l, g[0]), size: g.length })),
    layout: layoutIndex,
    alternatives: alternativesOf(candidates, group),
    reason: search.reason,
    suggestions: search.suggestions,
  };

  const response: WorkerResponse = { id, result, ms: performance.now() - started };
  self.postMessage(response);
};

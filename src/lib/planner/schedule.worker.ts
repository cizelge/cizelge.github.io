// Program aramasını ana iş parçacığının dışında çalıştırır.
// Yalnızca ağırlıklar değiştiyse ve arama kesilmediyse aramayı tekrarlamaz, bulunan adayları yeniden sıralar.
import { generateSchedules, rescore, type Candidate, type GenerateInput, type GenerateResult } from "../engine";

export interface WorkerRequest {
  id: number;
  input: GenerateInput;
}

export interface WorkerResponse {
  id: number;
  result: Omit<GenerateResult, "candidates">;
  ms: number;
}

let lastKey = "";
let last: { candidates: Candidate[]; truncated: boolean; rest: Omit<GenerateResult, "candidates" | "schedules"> } | null =
  null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, input } = event.data;
  const started = performance.now();
  const { weights, ...constraints } = input;
  const key = JSON.stringify(constraints);

  let result: Omit<GenerateResult, "candidates">;
  if (last && key === lastKey && !last.truncated) {
    result = { ...last.rest, schedules: rescore(last.candidates, weights, input.topN) };
  } else {
    const full = generateSchedules(input);
    const { candidates, schedules, ...rest } = full;
    lastKey = key;
    last = { candidates, truncated: full.truncated, rest };
    result = { ...rest, schedules };
  }

  const response: WorkerResponse = { id, result, ms: performance.now() - started };
  self.postMessage(response);
};

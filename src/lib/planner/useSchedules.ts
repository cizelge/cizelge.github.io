"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerateInput } from "../engine";
import type { WorkerRequest, WorkerResponse, WorkerResult } from "./schedule.worker";

export interface SchedulesState {
  result: WorkerResult | null;
  pending: boolean;
}

export interface SchedulesView {
  /** İlk kaç haftalık düzen istensin. */
  layoutLimit: number;
  /** Şube seçenekleri istenen düzen. */
  layout: number;
}

/** Girdi her değiştiğinde (kısa bir beklemeyle) işçiye gönderir; yalnızca en son isteğin cevabını kullanır. */
export function useSchedules(input: GenerateInput | null, view: SchedulesView): SchedulesState {
  const workerRef = useRef<Worker | null>(null);
  const latestId = useRef(0);
  const [state, setState] = useState<SchedulesState>({ result: null, pending: false });

  useEffect(() => {
    const worker = new Worker(new URL("./schedule.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id === latestId.current) setState({ result: e.data.result, pending: false });
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const key = input ? JSON.stringify([input, view.layoutLimit, view.layout]) : "";
  useEffect(() => {
    if (!input) {
      latestId.current++;
      return;
    }
    const id = ++latestId.current;
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, pending: true }));
      const message: WorkerRequest = { id, input, ...view };
      workerRef.current?.postMessage(message);
    }, 60);
    return () => clearTimeout(timer);
    // key, girdinin ve görünümün içeriğini temsil ediyor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return input ? state : { result: null, pending: false };
}

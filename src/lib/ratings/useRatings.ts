"use client";
// Oy özetleri sayfa başına bir kez istenir; aynı anda birden çok bileşen isterse tek istek yapılır.

import { useEffect, useState } from "react";
import { cachedSummaries, fetchSummaries, RATINGS_API, type Summaries } from "./client";

const pending = new Map<string, Promise<Summaries | null>>();
const loaded = new Map<string, Summaries | null>();

export function useRatings(school: string): { summaries: Summaries | null; ready: boolean } {
  const [state, setState] = useState<{ summaries: Summaries | null; ready: boolean }>(() =>
    loaded.has(school) ? { summaries: loaded.get(school) ?? null, ready: true } : { summaries: null, ready: !RATINGS_API },
  );

  useEffect(() => {
    if (!RATINGS_API) return;
    let alive = true;
    if (loaded.has(school)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ summaries: loaded.get(school) ?? null, ready: true });
      return;
    }
    // Sekmedeki kopya hemen gösterilir; doğrusu sunucudan gelince yerine geçer.
    // Oy başka bir sekmede verilmiş olabilir, o yüzden kopyayla yetinilmez.
    const cached = cachedSummaries(school);
    if (cached) setState({ summaries: cached, ready: true });
    let promise = pending.get(school);
    if (!promise) {
      promise = fetchSummaries(school).then((data) => {
        loaded.set(school, data ?? cached);
        pending.delete(school);
        return data;
      });
      pending.set(school, promise);
    }
    promise.then((data) => {
      // Servise ulaşılamadıysa elimizdeki kopya kalsın.
      if (alive && (data || !cached)) setState({ summaries: data, ready: true });
    });
    return () => {
      alive = false;
    };
  }, [school]);

  return state;
}

/** Oy gönderildikten sonra özetler yeniden okunsun. */
export function clearRatingsCache(school: string) {
  loaded.delete(school);
  pending.delete(school);
}

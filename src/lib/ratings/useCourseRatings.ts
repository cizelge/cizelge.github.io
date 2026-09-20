"use client";
// Ders puanları sayfa başına bir kez istenir; aynı anda birden çok bileşen isterse tek istek yapılır.
// Sekmedeki kopya hemen gösterilir, doğrusu sunucudan gelince yerine geçer (bkz. useRatings).

import { useEffect, useState } from "react";
import { RATINGS_API } from "./client";
import { cachedCourseSummaries, fetchCourseSummaries, type CourseSummaries } from "./course-client";

const pending = new Map<string, Promise<CourseSummaries | null>>();
const loaded = new Map<string, CourseSummaries | null>();

export function useCourseRatings(school: string): { summaries: CourseSummaries | null; ready: boolean } {
  const [state, setState] = useState<{ summaries: CourseSummaries | null; ready: boolean }>(() =>
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
    const cached = cachedCourseSummaries(school);
    if (cached) setState({ summaries: cached, ready: true });
    let promise = pending.get(school);
    if (!promise) {
      promise = fetchCourseSummaries(school).then((data) => {
        loaded.set(school, data ?? cached);
        pending.delete(school);
        return data;
      });
      pending.set(school, promise);
    }
    promise.then((data) => {
      if (alive && (data || !cached)) setState({ summaries: data, ready: true });
    });
    return () => {
      alive = false;
    };
  }, [school]);

  return state;
}

/** Oy gönderildikten sonra özetler yeniden okunsun. */
export function clearCourseRatingsCache(school: string) {
  loaded.delete(school);
  pending.delete(school);
}

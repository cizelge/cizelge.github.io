// Seçilen servis hattı ve durak-kampüs süresi bu tarayıcıda saklanır; planlayıcıda kullanılır.

export const SHUTTLE_PREFS_KEY = "servis:ozyegin";

export interface ShuttlePrefs {
  routeId: string;
  travelMinutes: number | null;
}

export function loadShuttlePrefs(): ShuttlePrefs | null {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(SHUTTLE_PREFS_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.routeId !== "string") return null;
    const t = r.travelMinutes;
    return { routeId: r.routeId, travelMinutes: typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null };
  } catch {
    return null;
  }
}

export function saveShuttlePrefs(prefs: ShuttlePrefs) {
  try {
    window.localStorage.setItem(SHUTTLE_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* gizli pencere, dolu depo vb.: sessizce geç */
  }
}

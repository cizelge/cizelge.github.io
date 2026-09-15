"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { matchShuttle, NEEDS_TRAVEL_TIME, NO_INBOUND, NO_OUTBOUND, type DayMatch, type ShuttleMeeting } from "@/lib/shuttle/match";
import type { ShuttleData, ShuttleRoute } from "@/lib/shuttle/types";
import styles from "./ShuttlePanel.module.css";

interface Props {
  data: ShuttleData;
  meetings: ShuttleMeeting[];
}

const STORAGE_KEY = "servis:ozyegin";
const BUFFER = 15;
const AFTER_CLASS = 10;
const OFFICIAL_URL = "https://www.ozyegin.edu.tr/tr/iletisim/servis-saatleri";

interface Saved {
  routeId: string;
  travelMinutes: number | null;
}

function load(): Saved | null {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.routeId !== "string") return null;
    const t = r.travelMinutes;
    return { routeId: r.routeId, travelMinutes: typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null };
  } catch {
    return null;
  }
}

function save(state: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* gizli pencere, dolu depo vb.: sessizce geç */
  }
}

function needsTravelInput(route: ShuttleRoute): boolean {
  if (route.travelMinutes !== undefined) return false;
  return !route.services.some((s) => s.toCampus.some((t) => t.arrival !== undefined));
}

function parseMinutes(value: string): number | undefined {
  const n = Number(value);
  return value.trim() !== "" && Number.isInteger(n) && n > 0 && n <= 240 ? n : undefined;
}

function DayRow({ d }: { d: DayMatch }) {
  const extra = d.warnings.filter((w) => w !== NO_INBOUND && w !== NO_OUTBOUND && w !== NEEDS_TRAVEL_TIME);
  return (
    <li className={styles.day}>
      <span className={styles.dayName}>{d.dayName}</span>
      <div className={styles.lines}>
        {d.offCampusOnly ? (
          <p className={styles.line}>Dersler kampüs dışında, servis hesaplanmadı.</p>
        ) : (
          <>
            {d.inbound?.kind === "trip" && (
              <p className={styles.line}>
                <span className={styles.label}>Gidiş</span> {d.inbound.departure} servisi, kampüste{" "}
                {d.inbound.arrivalEstimated ? "yaklaşık " : ""}
                {d.inbound.arrival}. {d.inbound.firstClass} dersine {d.inbound.waitMinutes} dk kala.
              </p>
            )}
            {d.inbound?.kind === "needsTravelTime" && (
              <p className={styles.line}>
                <span className={styles.label}>Gidiş</span> {d.inbound.firstClass} dersi.{" "}
                <span className={styles.muted}>Varış saatini hesaplamak için süreyi gir.</span>
              </p>
            )}
            {d.inbound?.kind === "none" && (
              <p className={`${styles.line} ${styles.warn}`}>
                <span className={styles.label}>Gidiş</span>
                <span aria-hidden="true" className={styles.mark}>!</span> İlk derse yetişen servis yok ({d.inbound.firstClass}{" "}
                dersi).
              </p>
            )}
            {d.outbound?.kind === "trip" && (
              <p className={styles.line}>
                <span className={styles.label}>Dönüş</span> {d.outbound.departure} servisi, son dersten{" "}
                {d.outbound.waitMinutes} dk sonra.
              </p>
            )}
            {d.outbound?.kind === "none" && (
              <p className={`${styles.line} ${styles.warn}`}>
                <span className={styles.label}>Dönüş</span>
                <span aria-hidden="true" className={styles.mark}>!</span> Son dersten sonra servis yok (son ders bitişi{" "}
                {d.outbound.lastClassEnd}).
              </p>
            )}
          </>
        )}
        {extra.map((w) => (
          <p key={w} className={`${styles.line} ${styles.muted}`}>
            {w}.
          </p>
        ))}
      </div>
    </li>
  );
}

/** Ders programına göre kampüs servisleri: ilk derse yetişen gidiş ve son dersten sonraki dönüş. */
export function ShuttlePanel({ data, meetings }: Props) {
  const selectId = useId();
  const travelId = useId();
  const [routeId, setRouteId] = useState(data.routes[0]?.id ?? "");
  const [travel, setTravel] = useState("");

  // Kayıt yalnızca tarayıcıda bilinir: ilk çizim varsayılanla, sonra kayıtlı seçim.
  useEffect(() => {
    const saved = load();
    if (!saved || !data.routes.some((r) => r.id === saved.routeId)) return;
    setRouteId(saved.routeId);
    setTravel(saved.travelMinutes ? String(saved.travelMinutes) : "");
  }, [data.routes]);

  const route = data.routes.find((r) => r.id === routeId) ?? data.routes[0];
  const askTravel = route ? needsTravelInput(route) : false;
  const travelMinutes = parseMinutes(travel);

  const result = useMemo(
    () =>
      route
        ? matchShuttle(meetings, route, { bufferMinutes: BUFFER, afterClassMinutes: AFTER_CLASS, travelMinutes })
        : null,
    [meetings, route, travelMinutes],
  );

  if (!route || !result) return null;

  const campuses = data.campuses.filter((c) => data.routes.some((r) => r.campusId === c.id));
  const grouped = campuses.length > 1;
  const official = data.sources.find((s) => s.url.includes("servis-saatleri"))?.url ?? OFFICIAL_URL;

  function chooseRoute(id: string) {
    setRouteId(id);
    save({ routeId: id, travelMinutes: parseMinutes(travel) ?? null });
  }

  function changeTravel(value: string) {
    setTravel(value);
    save({ routeId: route.id, travelMinutes: parseMinutes(value) ?? null });
  }

  const option = (r: ShuttleRoute) => (
    <option key={r.id} value={r.id}>
      {r.name}
    </option>
  );

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>
        <span className={styles.title}>Servis saatleri</span>
        <span className={styles.hint}>Derslerine göre gidiş ve dönüş seferleri.</span>
      </summary>

      <div className={styles.body}>
        <div className={styles.controls}>
          <label className={styles.field} htmlFor={selectId}>
            <span className={styles.fieldLabel}>Hat</span>
            <select id={selectId} className={styles.input} value={route.id} onChange={(e) => chooseRoute(e.target.value)}>
              {grouped
                ? campuses.map((c) => (
                    <optgroup key={c.id} label={c.name}>
                      {data.routes.filter((r) => r.campusId === c.id).map(option)}
                    </optgroup>
                  ))
                : data.routes.map(option)}
            </select>
          </label>

          {askTravel && (
            <label className={styles.field} htmlFor={travelId}>
              <span className={styles.fieldLabel}>Durak–kampüs süresi (dk)</span>
              <input
                id={travelId}
                className={`${styles.input} ${styles.number}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                step={1}
                value={travel}
                placeholder="Örn. 20"
                onChange={(e) => changeTravel(e.target.value)}
              />
            </label>
          )}
        </div>

        <p className={styles.note}>
          İlk dersten en az {BUFFER} dk önce kampüste olacağın son sefer ve son ders bittikten en az {AFTER_CLASS} dk
          sonra kalkan ilk sefer.
          {askTravel && " Kaynak yalnızca ilk duraktan kalkış saatlerini veriyor."}
        </p>

        {result.days.length === 0 ? (
          <p className={styles.empty}>Programında ders yok. Ders ekleyince servisler burada görünür.</p>
        ) : (
          <ul className={styles.days}>
            {result.days.map((d) => (
              <DayRow key={d.day} d={d} />
            ))}
          </ul>
        )}

        <p className={styles.footer}>
          <a className={styles.link} href={official} target="_blank" rel="noopener noreferrer">
            Resmi servis saatleri
          </a>
          {data.validFrom && (
            <span className={styles.muted}>
              {" "}
              {new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(data.validFrom))}{" "}
              tarihinden itibaren geçerli.
            </span>
          )}
        </p>
      </div>
    </details>
  );
}

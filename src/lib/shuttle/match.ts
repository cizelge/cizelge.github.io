// Ders programını servis seferleriyle eşleştirir: her ders günü için ilk derse yetişen son sefer
// ve son dersten sonraki ilk dönüş seferi. Varış saati yalnızca kaynak veriyorsa ya da
// durak–kampüs süresi biliniyorsa hesaplanır; saat uydurulmaz.

import { formatTime, parseTime } from "@/lib/engine/timemask";
import type { ShuttleRoute, ShuttleTrip } from "./types";

export interface ShuttleMeeting {
  day: number;
  start: string;
  end: string;
  room?: string | null;
}

export interface MatchOptions {
  /** İlk dersten en az kaç dakika önce kampüste olunmalı. */
  bufferMinutes?: number;
  /** Son ders bittikten en az kaç dakika sonra kalkan sefer alınabilir. */
  afterClassMinutes?: number;
  /** Durak–kampüs süresi; hat kendi süresini yayımlıyorsa o kullanılır. */
  travelMinutes?: number;
}

export type InboundMatch =
  | {
      kind: "trip";
      departure: string;
      arrival: string;
      /** Varış kaynaktan değil, kalkış + süreden hesaplandı. */
      arrivalEstimated: boolean;
      stop: string;
      firstClass: string;
      /** Kampüse varış ile ilk ders arasında geçen dakika. */
      waitMinutes: number;
    }
  | { kind: "none"; firstClass: string }
  | { kind: "needsTravelTime"; firstClass: string };

export type OutboundMatch =
  | {
      kind: "trip";
      departure: string;
      stop: string;
      lastClassEnd: string;
      /** Son dersin bitişi ile seferin kalkışı arasında geçen dakika. */
      waitMinutes: number;
    }
  | { kind: "none"; lastClassEnd: string };

export interface DayMatch {
  day: number;
  dayName: string;
  /** Günün bütün dersleri kampüs dışındaysa servis hesaplanmaz. */
  offCampusOnly: boolean;
  inbound: InboundMatch | null;
  outbound: OutboundMatch | null;
  /** Hesaba katılmayan kampüs dışı derslikler. */
  offCampusRooms: string[];
  warnings: string[];
  sentence: string;
}

export interface MatchResult {
  days: DayMatch[];
  summary: string;
}

export const DAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

export const NO_INBOUND = "İlk derse yetişen servis yok";
export const NO_OUTBOUND = "Son dersten sonra servis yok";
export const NEEDS_TRAVEL_TIME = "Varış saatini hesaplamak için süreyi gir";

/** Çekmeköy kampüsü dışındaki yerleşkelerin derslik önekleri. */
export const OFF_CAMPUS_ROOM_PREFIXES = ["SWISS.", "ALT."];

export function isOffCampusRoom(room: string | null | undefined): boolean {
  if (!room) return false;
  // Derslik kodları ASCII; Türkçe büyük harf "i"yi "İ" yapıp eşleşmeyi bozar.
  const upper = room.trim().toUpperCase();
  return OFF_CAMPUS_ROOM_PREFIXES.some((p) => upper.startsWith(p));
}

function positive(n: number | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

function tripsFor(route: ShuttleRoute, day: number, direction: "toCampus" | "fromCampus"): ShuttleTrip[] {
  return route.services
    .filter((s) => (s.days as number[]).includes(day))
    .flatMap((s) => s[direction])
    .sort((a, b) => parseTime(a.departure) - parseTime(b.departure));
}

function matchInbound(route: ShuttleRoute, day: number, firstStart: number, buffer: number, travel?: number): InboundMatch {
  const firstClass = formatTime(firstStart);
  const deadline = firstStart - buffer;
  let best: InboundMatch | null = null;
  let bestArrival = -1;
  for (const trip of tripsFor(route, day, "toCampus")) {
    const dep = parseTime(trip.departure);
    // Varış kalkıştan sonra olduğu için sınırdan sonra kalkan sefer zaten yetişemez.
    if (dep > deadline) continue;
    let arrival: number;
    let estimated = false;
    if (trip.arrival !== undefined) {
      arrival = parseTime(trip.arrival);
    } else if (travel !== undefined) {
      arrival = dep + travel;
      estimated = true;
    } else {
      return { kind: "needsTravelTime", firstClass };
    }
    if (arrival > deadline || arrival < bestArrival) continue;
    bestArrival = arrival;
    best = {
      kind: "trip",
      departure: trip.departure,
      arrival: formatTime(arrival),
      arrivalEstimated: estimated,
      stop: trip.stop,
      firstClass,
      waitMinutes: firstStart - arrival,
    };
  }
  return best ?? { kind: "none", firstClass };
}

function matchOutbound(route: ShuttleRoute, day: number, lastEnd: number, after: number): OutboundMatch {
  const lastClassEnd = formatTime(lastEnd);
  const trip = tripsFor(route, day, "fromCampus").find((t) => parseTime(t.departure) >= lastEnd + after);
  if (!trip) return { kind: "none", lastClassEnd };
  return {
    kind: "trip",
    departure: trip.departure,
    stop: trip.stop,
    lastClassEnd,
    waitMinutes: parseTime(trip.departure) - lastEnd,
  };
}

function inboundText(route: ShuttleRoute, m: InboundMatch): string {
  switch (m.kind) {
    case "trip":
      return `${m.departure} ${route.name} servisi, ${m.firstClass} dersine ${m.arrivalEstimated ? "yaklaşık " : ""}${m.waitMinutes} dk kala kampüste`;
    case "none":
      return `${m.firstClass} dersine yetişen servis yok`;
    case "needsTravelTime":
      return `${m.firstClass} dersi için varış saati bilinmiyor`;
  }
}

function outboundText(m: OutboundMatch): string {
  return m.kind === "trip" ? `dönüş ${m.departure}` : "dönüş servisi yok";
}

/** Ders programının her günü için gidiş ve dönüş seferlerini bulur. */
export function matchShuttle(meetings: ShuttleMeeting[], route: ShuttleRoute, options: MatchOptions = {}): MatchResult {
  const buffer = options.bufferMinutes ?? 15;
  const after = options.afterClassMinutes ?? 10;
  const travel = positive(route.travelMinutes) ?? positive(options.travelMinutes);

  const byDay = new Map<number, ShuttleMeeting[]>();
  for (const m of meetings) {
    if (!Number.isInteger(m.day) || m.day < 1 || m.day > 7) continue;
    const list = byDay.get(m.day);
    if (list) list.push(m);
    else byDay.set(m.day, [m]);
  }

  const days: DayMatch[] = [...byDay.keys()]
    .sort((a, b) => a - b)
    .map((day) => {
      const all = byDay.get(day)!;
      const dayName = DAY_NAMES[day - 1];
      const offCampusRooms = [...new Set(all.filter((m) => isOffCampusRoom(m.room)).map((m) => m.room!.trim()))];
      const onCampus = all.filter((m) => !isOffCampusRoom(m.room));
      const offNote = offCampusRooms.length
        ? `Kampüs dışı derslik hesaba katılmadı: ${offCampusRooms.join(", ")}`
        : null;

      if (onCampus.length === 0) {
        return {
          day,
          dayName,
          offCampusOnly: true,
          inbound: null,
          outbound: null,
          offCampusRooms,
          warnings: offNote ? [offNote] : [],
          sentence: `${dayName}: dersler kampüs dışında (${offCampusRooms.join(", ")}), servis hesaplanmadı.`,
        };
      }

      const firstStart = Math.min(...onCampus.map((m) => parseTime(m.start)));
      const lastEnd = Math.max(...onCampus.map((m) => parseTime(m.end)));
      const inbound = matchInbound(route, day, firstStart, buffer, travel);
      const outbound = matchOutbound(route, day, lastEnd, after);

      const warnings: string[] = [];
      if (inbound.kind === "none") warnings.push(NO_INBOUND);
      if (inbound.kind === "needsTravelTime") warnings.push(NEEDS_TRAVEL_TIME);
      if (outbound.kind === "none") warnings.push(NO_OUTBOUND);
      if (offNote) warnings.push(offNote);

      return {
        day,
        dayName,
        offCampusOnly: false,
        inbound,
        outbound,
        offCampusRooms,
        warnings,
        sentence: `${dayName}: ${inboundText(route, inbound)}; ${outboundText(outbound)}.`,
      };
    });

  return { days, summary: days.map((d) => d.sentence).join("\n") };
}

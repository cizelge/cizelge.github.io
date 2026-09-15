import { describe, expect, it } from "vitest";
import { isOffCampusRoom, matchShuttle, NEEDS_TRAVEL_TIME, NO_INBOUND, NO_OUTBOUND } from "./match";
import type { ShuttleRoute, ShuttleTrip } from "./types";

const trips = (stop: string, ...times: string[]): ShuttleTrip[] => times.map((departure) => ({ departure, stop }));

function route(extra: Partial<ShuttleRoute> = {}): ShuttleRoute {
  return {
    id: "metro",
    name: "Çekmeköy Metro",
    campusId: "cekmekoy",
    sourceUrl: "https://example.org",
    sourceRouteIds: [1],
    toCampusStops: [],
    fromCampusStops: [],
    fares: [],
    notes: [],
    services: [
      {
        id: "hafta-ici",
        label: "Hafta içi",
        days: [1, 2, 3, 4, 5],
        toCampus: trips("Metro", "07:30", "08:00", "10:00"),
        fromCampus: trips("KAMPÜS", "13:00", "16:50", "18:45"),
      },
      {
        id: "hafta-sonu",
        label: "Hafta sonu",
        days: [6, 7],
        toCampus: trips("Metro", "09:00"),
        fromCampus: trips("KAMPÜS", "17:00"),
      },
    ],
    ...extra,
  };
}

describe("matchShuttle", () => {
  it("picks the latest inbound trip that keeps the buffer and the first outbound after class", () => {
    const res = matchShuttle(
      [
        { day: 1, start: "12:40", end: "14:30" },
        { day: 1, start: "08:40", end: "10:30", room: "AB1.101" },
        { day: 1, start: "16:40", end: "18:30" },
      ],
      route(),
      { travelMinutes: 45 },
    );
    expect(res.days).toHaveLength(1);
    const d = res.days[0];
    // 08:00 + 45 = 08:45 > 08:25, so 07:30 (08:15, 25 dk kala) wins.
    expect(d.inbound).toMatchObject({ kind: "trip", departure: "07:30", arrival: "08:15", waitMinutes: 25, arrivalEstimated: true });
    expect(d.outbound).toMatchObject({ kind: "trip", departure: "18:45", waitMinutes: 15 });
    expect(d.warnings).toEqual([]);
    expect(d.sentence).toBe("Pazartesi: 07:30 Çekmeköy Metro servisi, 08:40 dersine yaklaşık 25 dk kala kampüste; dönüş 18:45.");
    expect(res.summary).toBe(d.sentence);
  });

  it("treats the buffers as inclusive and respects custom values", () => {
    const meetings = [{ day: 2, start: "08:30", end: "16:40" }];
    const exact = matchShuttle(meetings, route(), { travelMinutes: 15, bufferMinutes: 15, afterClassMinutes: 10 }).days[0];
    expect(exact.inbound).toMatchObject({ kind: "trip", departure: "08:00", waitMinutes: 15 });
    expect(exact.outbound).toMatchObject({ kind: "trip", departure: "16:50", waitMinutes: 10 });

    const strict = matchShuttle(meetings, route(), { travelMinutes: 15, bufferMinutes: 16, afterClassMinutes: 11 }).days[0];
    expect(strict.inbound).toMatchObject({ kind: "trip", departure: "07:30" });
    expect(strict.outbound).toMatchObject({ kind: "trip", departure: "18:45" });
  });

  it("uses published arrival times and the route's own travel time before the option", () => {
    const r = route();
    r.services[0].toCampus = [{ departure: "07:30", stop: "Metro", arrival: "07:50" }, { departure: "08:00", stop: "Metro", arrival: "08:20" }];
    const d = matchShuttle([{ day: 3, start: "08:40", end: "10:00" }], r).days[0];
    expect(d.inbound).toMatchObject({ kind: "trip", departure: "08:00", arrival: "08:20", arrivalEstimated: false, waitMinutes: 20 });
    expect(d.sentence).toContain("08:40 dersine 20 dk kala kampüste");

    const own = matchShuttle([{ day: 3, start: "08:40", end: "10:00" }], route({ travelMinutes: 20 }), { travelMinutes: 60 }).days[0];
    expect(own.inbound).toMatchObject({ kind: "trip", departure: "08:00", arrival: "08:20" });
  });

  it("flags days without a usable trip", () => {
    const d = matchShuttle([{ day: 1, start: "07:45", end: "20:00" }], route(), { travelMinutes: 10 }).days[0];
    expect(d.inbound).toEqual({ kind: "none", firstClass: "07:45" });
    expect(d.outbound).toEqual({ kind: "none", lastClassEnd: "20:00" });
    expect(d.warnings).toEqual([NO_INBOUND, NO_OUTBOUND]);
    expect(d.sentence).toBe("Pazartesi: 07:45 dersine yetişen servis yok; dönüş servisi yok.");
  });

  it("flags a route that has no return trips at all", () => {
    const r = route();
    for (const s of r.services) s.fromCampus = [];
    const d = matchShuttle([{ day: 4, start: "10:40", end: "12:30" }], r, { travelMinutes: 20 }).days[0];
    expect(d.inbound?.kind).toBe("trip");
    expect(d.warnings).toEqual([NO_OUTBOUND]);
  });

  it("asks for the travel time when arrival cannot be computed", () => {
    const d = matchShuttle([{ day: 1, start: "10:40", end: "12:30" }], route()).days[0];
    expect(d.inbound).toEqual({ kind: "needsTravelTime", firstClass: "10:40" });
    expect(d.outbound).toMatchObject({ kind: "trip", departure: "13:00" });
    expect(d.warnings).toEqual([NEEDS_TRAVEL_TIME]);
    // Geçersiz süre de bilinmeyen sayılır.
    expect(matchShuttle([{ day: 1, start: "10:40", end: "12:30" }], route(), { travelMinutes: 0 }).days[0].inbound?.kind).toBe("needsTravelTime");
  });

  it("reports no trip rather than missing travel time when nothing departs early enough", () => {
    const d = matchShuttle([{ day: 1, start: "07:00", end: "09:00" }], route()).days[0];
    expect(d.inbound?.kind).toBe("none");
  });

  it("uses weekend services on weekend days only", () => {
    const res = matchShuttle(
      [
        { day: 6, start: "10:00", end: "15:00" },
        { day: 5, start: "10:00", end: "15:00" },
      ],
      route(),
      { travelMinutes: 30 },
    );
    expect(res.days.map((d) => d.dayName)).toEqual(["Cuma", "Cumartesi"]);
    const [fri, sat] = res.days;
    expect(fri.inbound).toMatchObject({ departure: "08:00" });
    expect(fri.outbound).toMatchObject({ departure: "16:50" });
    expect(sat.inbound).toMatchObject({ departure: "09:00", arrival: "09:30" });
    expect(sat.outbound).toMatchObject({ departure: "17:00" });
  });

  it("flags a day that has no service at all", () => {
    const r = route();
    r.services = r.services.slice(0, 1);
    const d = matchShuttle([{ day: 7, start: "12:00", end: "13:00" }], r, { travelMinutes: 30 }).days[0];
    expect(d.warnings).toEqual([NO_INBOUND, NO_OUTBOUND]);
  });

  it("skips off-campus rooms and notes them", () => {
    const res = matchShuttle(
      [
        { day: 2, start: "08:40", end: "10:30", room: "ALT.ALT.101" },
        { day: 2, start: "12:40", end: "14:30", room: "FEAS_AB2.101" },
        { day: 3, start: "09:00", end: "12:00", room: "swiss.SWISS.105" },
      ],
      route(),
      { travelMinutes: 30 },
    );
    const [tue, wed] = res.days;
    expect(tue.offCampusOnly).toBe(false);
    expect(tue.inbound).toMatchObject({ firstClass: "12:40", departure: "10:00" });
    expect(tue.offCampusRooms).toEqual(["ALT.ALT.101"]);
    expect(tue.warnings).toEqual(["Kampüs dışı derslik hesaba katılmadı: ALT.ALT.101"]);

    expect(wed.offCampusOnly).toBe(true);
    expect(wed.inbound).toBeNull();
    expect(wed.outbound).toBeNull();
    expect(wed.sentence).toBe("Çarşamba: dersler kampüs dışında (swiss.SWISS.105), servis hesaplanmadı.");
  });

  it("recognises off-campus room codes", () => {
    expect(isOffCampusRoom("SWISS.SWISS.105")).toBe(true);
    expect(isOffCampusRoom("ALT.ALT.101")).toBe(true);
    expect(isOffCampusRoom("AF_AB4.120")).toBe(false);
    expect(isOffCampusRoom("SCOLA.1")).toBe(false);
    expect(isOffCampusRoom(null)).toBe(false);
    expect(isOffCampusRoom(undefined)).toBe(false);
  });

  it("returns nothing for an empty schedule and ignores invalid days", () => {
    expect(matchShuttle([], route())).toEqual({ days: [], summary: "" });
    expect(matchShuttle([{ day: 0, start: "09:00", end: "10:00" }], route()).days).toEqual([]);
  });
});

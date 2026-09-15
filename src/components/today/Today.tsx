"use client";
// Bugün ekranı: kayıtlı programdan şu anki ve sıradaki ders, bugünün akışı, servis ve yaklaşan tarih.
// Program, planlayıcının bu tarayıcıya yazdığı kayıttan okunur; sunucu çiziminde saat bilinmediği için iskelet gösterilir.

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { isoWeekday, OZYEGIN_CALENDAR } from "@/lib/calendar";
import { formatLongDate, relativeLabel, upcoming } from "@/lib/academic-calendar/calendar";
import type { CalendarEvent } from "@/lib/academic-calendar/types";
import { parseTime } from "@/lib/engine/timemask";
import { matchShuttle } from "@/lib/shuttle/match";
import { loadShuttlePrefs } from "@/lib/shuttle/prefs";
import type { ShuttleData } from "@/lib/shuttle/types";
import {
  formatIn,
  istanbulNow,
  parseSaved,
  pickSchedule,
  scheduleKey,
  todayView,
  type SavedMeeting,
  type SavedSchedule,
} from "@/lib/today/today";
import { personName } from "@/lib/format";
import { InstallApp } from "./InstallApp";
import styles from "./Today.module.css";

interface Props {
  schoolId: string;
  events: CalendarEvent[];
  shuttle: ShuttleData | null;
}

const HIGHLIGHTERS = 6;

// Saat 20 saniyede bir yenilenir; sunucuda saat yok.
let clockValue = "";
function subscribeClock(onChange: () => void) {
  const tick = () => {
    const n = istanbulNow();
    const v = `${n.date}|${n.minutes}`;
    if (v !== clockValue) {
      clockValue = v;
      onChange();
    }
  };
  tick();
  const id = setInterval(tick, 20_000);
  const onVisible = () => document.visibilityState === "visible" && tick();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
function clockSnapshot() {
  if (!clockValue) {
    const n = istanbulNow();
    clockValue = `${n.date}|${n.minutes}`;
  }
  return clockValue;
}

function readSchedules(schoolId: string): SavedSchedule[] {
  const out: SavedSchedule[] = [];
  try {
    const prefix = scheduleKey(schoolId, "");
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const s = parseSaved(window.localStorage.getItem(key));
      if (s && s.meetings.length) out.push(s);
    }
  } catch {
    /* depo kapalı */
  }
  return out;
}

const weekdayName = (date: string) =>
  new Intl.DateTimeFormat("tr-TR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function roomText(m: SavedMeeting) {
  // "AF_AB4.123" -> "AB4 123"
  return m.room ? m.room.replace(/^[A-Z]+_/, "").replace(".", " ") : "derslik bilgisi yok";
}

export function Today({ schoolId, events, shuttle }: Props) {
  const clock = useSyncExternalStore(subscribeClock, clockSnapshot, () => "");
  const [schedules, setSchedules] = useState<SavedSchedule[] | null>(null);
  const [prefs, setPrefs] = useState<ReturnType<typeof loadShuttlePrefs>>(null);

  useEffect(() => {
    const read = () => {
      setSchedules(readSchedules(schoolId));
      setPrefs(loadShuttlePrefs());
    };
    read();
    // Başka sekmede program değişirse.
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, [schoolId]);

  const [date, minutesText] = clock.split("|");
  const minutes = Number(minutesText);
  const schedule = useMemo(
    () => (schedules && date ? pickSchedule(schedules, OZYEGIN_CALENDAR, date) : null),
    [schedules, date],
  );
  const cal = schedule ? OZYEGIN_CALENDAR[schedule.termId] : undefined;
  const view = schedule && date ? todayView(schedule, date, minutes, cal) : null;
  const colorOf = useMemo(() => {
    const codes = [...new Set(schedule?.meetings.map((m) => m.code) ?? [])];
    return (code: string) => Math.max(0, codes.indexOf(code)) % HIGHLIGHTERS;
  }, [schedule]);

  const nextEvent = date ? upcoming(events, date, 1)[0] : undefined;

  if (!clock || schedules === null) {
    return (
      <main id="icerik" className={`page ${styles.root}`} aria-busy="true">
        <h1 className="board-title">Bugün</h1>
        <div className={`${styles.now} ${styles.skeleton}`} />
      </main>
    );
  }

  const heading = (
    <header className={styles.head}>
      <h1 className="board-title">Bugün</h1>
      <p className={styles.date}>
        {weekdayName(date)}, {formatLongDate(date).replace(/ \d{4}$/, "")}
      </p>
    </header>
  );

  if (!schedule || !view) {
    return (
      <main id="icerik" className={`page ${styles.root}`}>
        {heading}
        <section className={styles.now}>
          <p className={styles.nowLabel}>Programın yok</p>
          <p className={styles.emptyTitle}>Önce derslerini seç, sonra her sabah buradan bak.</p>
          <p className={styles.muted}>
            Program sayfasında seçtiğin program bu telefona kaydedilir. Burada sıradaki dersini, dersliğini ve servisini
            görürsün.
          </p>
          <Link href="/ozyegin" className="btn btn-pen">
            Programını kur
          </Link>
        </section>
        <UpcomingEvent event={nextEvent} date={date} />
        <InstallApp />
      </main>
    );
  }

  const { day, classes, current, next, nextDay } = view;
  const done = day.kind === "class" && classes.length > 0 && !current && !next;

  // Servis: bugünün dersleri, haftanın gerçek günüyle (telafi Cumartesisi hafta sonu seferleri kullanır).
  const route = shuttle && prefs ? shuttle.routes.find((r) => r.id === prefs.routeId) : undefined;
  const realWeekday = isoWeekday(date);
  const shuttleDay =
    route && classes.length
      ? matchShuttle(
          classes.map((c) => ({ day: realWeekday, start: c.start, end: c.end, room: c.room })),
          route,
          { bufferMinutes: 15, afterClassMinutes: 10, travelMinutes: prefs?.travelMinutes ?? undefined },
        ).days[0]
      : undefined;

  return (
    <main id="icerik" className={`page ${styles.root}`}>
      {heading}
      {day.kind === "class" && day.makeupFor && (
        <p className={styles.makeup}>Telafi günü: {formatLongDate(day.makeupFor)} {weekdayName(day.makeupFor)} dersleri yapılıyor.</p>
      )}

      <section className={styles.now} aria-live="polite">
        {current ? (
          <MeetingFocus
            label="Şu an"
            meeting={current}
            color={colorOf(current.code)}
            when={`Bitiş ${current.end}, ${formatIn(parseTime(current.end) - minutes)} kaldı`}
          />
        ) : null}
        {current && next ? (
          <p className={styles.after}>
            Sonra <strong className="num">{next.meeting.start}</strong> {next.meeting.code}, {roomText(next.meeting)}
          </p>
        ) : current ? null : next ? (
          <MeetingFocus
            label={`Sıradaki, ${formatIn(next.inMinutes)} sonra`}
            meeting={next.meeting}
            color={colorOf(next.meeting.code)}
            when={`${next.meeting.start}–${next.meeting.end}`}
          />
        ) : (
          <>
            <p className={styles.nowLabel}>
              {day.kind === "holiday"
                ? "Tatil"
                : day.kind === "beforeTerm"
                  ? "Dönem başlamadı"
                  : day.kind === "afterTerm"
                    ? "Dönem bitti"
                    : done
                      ? "Bugünlük bitti"
                      : "Ders yok"}
            </p>
            <p className={styles.emptyTitle}>
              {day.kind === "holiday"
                ? "Bugün ders yapılmıyor."
                : day.kind === "beforeTerm"
                  ? `Dersler ${formatLongDate(day.start).replace(/ \d{4}$/, "")} ${weekdayName(day.start)} başlıyor.`
                  : day.kind === "afterTerm"
                    ? `${schedule.termLabel} dersleri bitti.`
                    : done
                      ? "Bugünkü derslerin bitti."
                      : "Bugün dersin yok."}
            </p>
            {nextDay && (
              <p className={styles.muted}>
                Sonraki ders günü {weekdayName(nextDay.date)}, {formatLongDate(nextDay.date).replace(/ \d{4}$/, "")}: ilk ders{" "}
                {nextDay.classes[0].start}, {nextDay.classes[0].code}.
              </p>
            )}
          </>
        )}
      </section>

      {classes.length > 0 && (
        <section aria-labelledby="bugun-akis">
          <h2 id="bugun-akis" className="group-title">
            Bugünün dersleri
          </h2>
          <ol className={styles.flow}>
            {classes.map((c) => {
              const state = parseTime(c.end) <= minutes ? "past" : parseTime(c.start) <= minutes ? "now" : "later";
              return (
                <li key={`${c.code}-${c.start}`} className={styles.flowItem} data-state={state}>
                  <span className={`${styles.flowTime} num`}>
                    {c.start}
                    <span className={styles.flowEnd}>{c.end}</span>
                  </span>
                  <span className={`${styles.flowBar} hl-${colorOf(c.code)}`} aria-hidden="true" />
                  <span className={styles.flowBody}>
                    <span className={styles.flowCode}>
                      {c.code} <span className={styles.flowSection}>{c.section}</span>
                    </span>
                    <span className={styles.flowTitle}>{c.title}</span>
                    <span className={styles.flowRoom}>{roomText(c)}</span>
                  </span>
                  {state === "now" && <span className={styles.badge}>şimdi</span>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {shuttle && classes.length > 0 && (
        <section className={styles.card} aria-labelledby="bugun-servis">
          <h2 id="bugun-servis" className="group-title">
            Servis
          </h2>
          {!route ? (
            <p className={styles.muted}>
              Hattını seçersen gidiş ve dönüş seferlerin burada görünür.{" "}
              <Link href="/ozyegin" className="link">
                Program sayfasındaki Servis saatleri
              </Link>
              ’nden seç.
            </p>
          ) : !shuttleDay || shuttleDay.offCampusOnly ? (
            <p className={styles.muted}>Bugünkü derslerin kampüs dışında.</p>
          ) : (
            <ul className={styles.shuttle}>
              <li data-past={shuttleDay.inbound?.kind === "trip" && parseTime(shuttleDay.inbound.departure) < minutes}>
                <span className={styles.shuttleLabel}>Gidiş</span>
                {shuttleDay.inbound?.kind === "trip" ? (
                  <span>
                    <strong className="num">{shuttleDay.inbound.departure}</strong> {route.name}, kampüste{" "}
                    {shuttleDay.inbound.arrivalEstimated ? "yaklaşık " : ""}
                    {shuttleDay.inbound.arrival}
                  </span>
                ) : shuttleDay.inbound?.kind === "needsTravelTime" ? (
                  <span className={styles.muted}>Durak–kampüs süreni Program sayfasında gir.</span>
                ) : (
                  <span className={styles.muted}>İlk derse yetişen servis yok.</span>
                )}
              </li>
              <li>
                <span className={styles.shuttleLabel}>Dönüş</span>
                {shuttleDay.outbound?.kind === "trip" ? (
                  <span>
                    <strong className="num">{shuttleDay.outbound.departure}</strong>, son dersten {shuttleDay.outbound.waitMinutes} dk sonra
                  </span>
                ) : (
                  <span className={styles.muted}>Son dersten sonra servis yok.</span>
                )}
              </li>
            </ul>
          )}
        </section>
      )}

      <UpcomingEvent event={nextEvent} date={date} />

      <InstallApp />

      <p className={styles.source}>
        {schedule.termLabel} programın, {new Set(schedule.meetings.map((m) => m.code)).size} ders.{" "}
        <Link href="/ozyegin" className="link">
          Programı değiştir
        </Link>
      </p>
    </main>
  );
}

function MeetingFocus({ label, meeting, color, when }: { label: string; meeting: SavedMeeting; color: number; when: string }) {
  return (
    <>
      <p className={styles.nowLabel}>{label}</p>
      {meeting.room ? (
        <>
          <p className={styles.room}>
            <span className={`${styles.roomMark} hl-${color}`}>{roomText(meeting)}</span>
          </p>
          <p className={styles.focusCourse}>
            <span className={styles.focusCode}>{meeting.code}</span> {meeting.title}
          </p>
        </>
      ) : (
        // Derslik bilinmiyorsa en büyük yazı dersin kodu olur.
        <>
          <p className={styles.room}>
            <span className={`${styles.roomMark} hl-${color}`}>{meeting.code}</span>
          </p>
          <p className={styles.focusCourse}>
            {meeting.title} <span className={styles.muted}>(derslik bilgisi yok)</span>
          </p>
        </>
      )}
      <p className={`${styles.muted} num`}>
        {when}
        {meeting.instructor ? `, ${personName(meeting.instructor)}` : ""}
      </p>
    </>
  );
}

function UpcomingEvent({ event, date }: { event: CalendarEvent | undefined; date: string }) {
  if (!event) return null;
  return (
    <Link href="/ozyegin/takvim" className={styles.event}>
      <span className={styles.eventWhen}>{relativeLabel(date, event)}</span>
      <span className={styles.eventTitle}>{event.title}</span>
    </Link>
  );
}

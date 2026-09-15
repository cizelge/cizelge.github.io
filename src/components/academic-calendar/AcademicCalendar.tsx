"use client";
// Akademik takvim listesi: yaklaşanlar, tür süzgeci, aylara bölünmüş satırlar ve .ics indirme.
// "Bugün" sunucuda bilinmez: ilk çizim tarihsiz yapılır, tarayıcıda İstanbul saatine göre tamamlanır.

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  eventsIcs,
  eventStatus,
  formatLongDate,
  formatRange,
  groupByMonth,
  relativeLabel,
  upcoming,
} from "@/lib/academic-calendar/calendar";
import { CATEGORY_LABEL, type AcademicCalendarData, type CalendarEvent, type EventCategory } from "@/lib/academic-calendar/types";
import styles from "./AcademicCalendar.module.css";

type Filter = "hepsi" | EventCategory;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "hepsi", label: "Hepsi" },
  { id: "basvuru", label: "Başvuru" },
  { id: "kayit", label: "Kayıt" },
  { id: "sinav", label: "Sınav" },
  { id: "tatil", label: "Tatil" },
  { id: "ders", label: "Ders" },
];

const noopSubscribe = () => () => {};
const istanbulToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const serverToday = () => null;

function downloadIcs(events: CalendarEvent[], calName: string, fileName: string) {
  const blob = new Blob([eventsIcs(events, { calName })], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CategoryTag({ category }: { category: EventCategory }) {
  return (
    <span className={styles.tag}>
      <span className={styles.swatch} data-category={category} aria-hidden="true" />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

export function AcademicCalendar({ data }: { data: AcademicCalendarData }) {
  const today = useSyncExternalStore(noopSubscribe, istanbulToday, serverToday);
  const [filter, setFilter] = useState<Filter>("hepsi");
  const [status, setStatus] = useState("");

  const visible = useMemo(
    () => (filter === "hepsi" ? data.events : data.events.filter((e) => e.category === filter)),
    [data.events, filter],
  );
  const months = useMemo(() => groupByMonth(visible), [visible]);
  // Aylarca süren dönemler (ör. yurt dışı kayıtları) "Yaklaşan"ı doldurmasın; listede kalırlar.
  const next = useMemo(
    () => (today ? upcoming(data.events.filter((e) => !e.end || daySpan(e.start, e.end) <= 21), today, 3) : []),
    [data.events, today],
  );

  const calName = `Özyeğin akademik takvim ${data.academicYear}`;
  const filterLabel = FILTERS.find((f) => f.id === filter)?.label ?? "";

  function addAll() {
    const suffix = filter === "hepsi" ? "" : `-${filter}`;
    downloadIcs(visible, calName, `ozyegin-akademik-takvim-${data.academicYear}${suffix}.ics`);
    setStatus(`${visible.length} tarih takvim dosyasına yazıldı. Dosyayı açınca takvim uygulaman ekler.`);
  }

  function addOne(event: CalendarEvent) {
    downloadIcs([event], calName, `${event.id}.ics`);
    setStatus(`“${event.title}” takvim dosyasına yazıldı.`);
  }

  return (
    <main id="icerik" className={`page ${styles.root}`}>
      <header className={styles.head}>
        <h1 className="board-title">Akademik takvim</h1>
        <p className={styles.lede}>
          Özyeğin {data.academicYear} lisans takviminden kayıt, sınav, tatil ve başvuru tarihleri.
        </p>
      </header>

      <section className={styles.upcoming} aria-labelledby="yaklasan-baslik">
        <h2 id="yaklasan-baslik" className="group-title">
          Yaklaşan
        </h2>
        {today === null ? (
          <p className="hint">Bugünün tarihi okunuyor.</p>
        ) : next.length === 0 ? (
          <p className="hint">Bu akademik yılda yaklaşan tarih kalmadı.</p>
        ) : (
          <ol className={styles.nextList}>
            {next.map((e) => (
              <li key={e.id} className={styles.nextItem}>
                <span className={styles.nextWhen}>{relativeLabel(today, e)}</span>
                <span className={styles.nextTitle}>{e.title}</span>
                <span className={styles.nextDate}>
                  {formatRange(e.start, e.end)}
                  {e.time ? `, ${e.time}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className={styles.toolbar}>
        <div className="chips" role="group" aria-label="Türe göre süz">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${styles.target}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className={`btn ${styles.target}`} onClick={addAll} disabled={visible.length === 0}>
          {filter === "hepsi" ? "Hepsini takvime ekle" : `${filterLabel} tarihlerini takvime ekle`}
        </button>
      </div>
      <p className={`hint ${styles.status}`} role="status" aria-live="polite">
        {status}
      </p>

      {months.map((m) => (
        <section key={m.key} className={styles.month} aria-labelledby={`ay-${m.key}`}>
          <h2 id={`ay-${m.key}`} className="group-title">
            {m.label}
            <span className="aside">{m.events.length} tarih</span>
          </h2>
          <ol className={styles.rows}>
            {m.events.map((e) => {
              const state = today ? eventStatus(today, e) : null;
              return (
                <li key={e.id} className={styles.row} data-past={state === "past" || undefined}>
                  <div className={styles.date}>
                    {formatRange(e.start, e.end)}
                    {e.time && <span className={styles.time}>Saat {e.time}</span>}
                  </div>
                  <div className={styles.body}>
                    <p className={styles.title}>
                      {e.title}
                      {state === "past" && <span className={styles.srOnly}> (geçti)</span>}
                    </p>
                    <p className={styles.meta}>
                      <CategoryTag category={e.category} />
                      {state && state !== "past" && state !== "future" && (
                        <span className={styles.now}>{relativeLabel(today!, e)}</span>
                      )}
                    </p>
                    {e.note && <p className={styles.note}>{e.note}</p>}
                  </div>
                  <button
                    type="button"
                    className={`btn btn-small ${styles.add}`}
                    onClick={() => addOne(e)}
                    aria-label={`${e.title}, takvime ekle`}
                  >
                    Takvime ekle
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <section className={styles.sources} aria-labelledby="kaynak-baslik">
        <h2 id="kaynak-baslik" className="group-title">
          Kaynaklar
        </h2>
        <ul className={styles.sourceList}>
          {data.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} className="link" target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="hint">
          Tarihler {formatLongDate(data.fetchedAt)} günü alındı. Takvimde ara sınav haftası yazmıyor. Üniversite
          takvimi değiştirebilir; kesin tarih için kaynağa bak.
        </p>
      </section>
    </main>
  );
}

function daySpan(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

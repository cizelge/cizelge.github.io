"use client";
// Ortak boş saat: kendi programın ile arkadaşlarının kodlarını birleştirip herkesin boş olduğu saatleri bulur.
// Kodda ders adı yok, yalnızca dolu saatler var; her şey tarayıcıda hesaplanır.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Day } from "@/lib/engine";
import { DAY_NAMES } from "@/lib/days";
import { combine, decodeMask, freeBlocks, spanLabel } from "@/lib/planner/free-time";
import { cleanCode, createCode, readCode } from "@/lib/planner/share-code";
import { WeekGrid } from "./WeekGrid";
import type { PlacedMeeting } from "./placed";
import styles from "./FreeTime.module.css";

interface Props {
  schoolId: string;
  termId: string;
  termLabel: string;
}

/** Kendi programının kodu planlayıcıda kaydedilir. */
export const freeKey = (schoolId: string, termId: string) => `bos-saat:${schoolId}:${termId}`;

const WEEKDAYS: Day[] = [1, 2, 3, 4, 5];
const MIN_CHOICES = [30, 60, 90, 120] as const;

export function FreeTime({ schoolId, termId, termLabel }: Props) {
  const [codes, setCodes] = useState<string[]>([]);
  const [mine, setMine] = useState<string | null>(null);
  const [useMine, setUseMine] = useState(true);
  const [min, setMin] = useState<number>(60);
  const [note, setNote] = useState("");
  const [ready, setReady] = useState(false);
  // Kısa kodlar: kendi kodun ve yazılan arkadaş kodu.
  const [myCode, setMyCode] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromLink = params.getAll("k").filter((k) => decodeMask(k) !== null);
    let own: string | null = null;
    try {
      own = window.localStorage.getItem(freeKey(schoolId, termId));
    } catch {
      own = null;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCodes([...new Set(fromLink)]);
    setMine(own && decodeMask(own) ? own : null);
    setReady(true);

    // Adresteki kısa kodlar sunucudan çözülür.
    const short = params.getAll("kod").map(cleanCode).filter((c): c is string => c !== null);
    if (short.length === 0) return;
    Promise.all(short.map(readCode)).then((found) => {
      const masks = found.filter((f) => f?.kind === "bos").map((f) => f!.data);
      if (masks.length > 0) setCodes((old) => [...new Set([...old, ...masks])]);
    });
  }, [schoolId, termId]);

  /** Yazılan kodu çözüp listeye ekler. */
  async function addTyped() {
    const clean = cleanCode(typed);
    if (!clean || busy) {
      setNote("Kod altı hane olmalı, örneğin K7M4PQ.");
      return;
    }
    setBusy(true);
    setNote("");
    const found = await readCode(clean);
    setBusy(false);
    if (!found || found.kind !== "bos" || !decodeMask(found.data)) {
      setNote("Kod bulunamadı ya da süresi dolmuş.");
      return;
    }
    setCodes((old) => (old.includes(found.data) ? old : [...old, found.data]));
    setTyped("");
    setNote("Arkadaşın eklendi.");
  }

  /** Kendi programın için kısa kod alır. */
  async function makeMyCode() {
    if (!mine || busy) return;
    setBusy(true);
    setNote("");
    const result = await createCode("bos", mine);
    setBusy(false);
    if (!result.ok) {
      setNote(result.error);
      return;
    }
    setMyCode(result.code);
    try {
      await navigator.clipboard.writeText(result.code);
      setNote(`Kodun ${result.code}, panoya kopyalandı. Arkadaşına söyle, bu sayfaya yazsın.`);
    } catch {
      setNote(`Kodun ${result.code}. Arkadaşına söyle, bu sayfaya yazsın.`);
    }
  }

  const people = useMemo(() => {
    const list: { label: string; code: string; own: boolean }[] = [];
    if (mine && useMine) list.push({ label: "Sen", code: mine, own: true });
    codes.forEach((code, i) => list.push({ label: `Arkadaş ${i + 1}`, code, own: false }));
    return list;
  }, [codes, mine, useMine]);

  const blocks = useMemo(() => {
    const masks = people.map((p) => decodeMask(p.code)).filter((m): m is Uint8Array => m !== null);
    if (masks.length === 0) return [];
    return freeBlocks(combine(masks), { min, days: WEEKDAYS });
  }, [people, min]);

  const meetings: PlacedMeeting[] = blocks.map((b) => ({
    courseCode: "Boş",
    sectionId: "",
    day: b.day,
    start: b.start,
    end: b.end,
    instructor: null,
    room: null,
    color: 1,
  }));

  function shareLink(): string {
    const url = new URL(window.location.href);
    url.search = "";
    for (const p of people) url.searchParams.append("k", p.code);
    return url.toString();
  }

  async function copy() {
    if (people.length === 0) return;
    try {
      await navigator.clipboard.writeText(shareLink());
      setNote("Link kopyalandı. Arkadaşına gönder, o da kendi programını ekleyince ortak saatler çıkar.");
    } catch {
      setNote("Kopyalanamadı, adres çubuğundaki linki elle al.");
    }
  }

  const byDay = WEEKDAYS.map((day) => ({ day, list: blocks.filter((b) => b.day === day) })).filter((d) => d.list.length > 0);
  const total = blocks.reduce((sum, b) => sum + b.minutes, 0);

  return (
    <main id="icerik" className={styles.root}>
      <h1 className={styles.title}>Ortak boş saat</h1>
      <p className={styles.lede}>
        Arkadaşınla aynı anda boş olduğun saatleri bulur. Herkes kendi programının linkini ekler, site kesişimi
        gösterir. Linkte ders adı yoktur, yalnızca &ldquo;şu saat dolu&rdquo; bilgisi taşınır.
      </p>

      {!ready ? (
        <p className="hint">Yükleniyor…</p>
      ) : people.length === 0 ? (
        <div className={styles.empty}>
          <p>Henüz kimse eklenmedi.</p>
          <p className="hint">
            Önce planlayıcıda programını kur, oradaki &ldquo;Ortak boş saat&rdquo; panelinden linkini al.
          </p>
          <Link href="/ozyegin" className="btn btn-pen">
            Planlayıcıya git
          </Link>
        </div>
      ) : (
        <>
          <section className={styles.people} aria-label="Katılanlar">
            {people.map((p, i) => (
              <span key={p.code + i} className={styles.person} data-own={p.own}>
                {p.label}
                {p.own ? (
                  <button type="button" className={styles.drop} onClick={() => setUseMine(false)} aria-label="Kendi programını çıkar">
                    ×
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.drop}
                    onClick={() => setCodes((c) => c.filter((x) => x !== p.code))}
                    aria-label={`${p.label} programını çıkar`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {mine && !useMine && (
              <button type="button" className="btn btn-small" onClick={() => setUseMine(true)}>
                Kendi programımı ekle
              </button>
            )}
            {!mine && (
              <Link href="/ozyegin" className="btn btn-small">
                Kendi programını ekle
              </Link>
            )}
          </section>

          <section className={styles.codeRow} aria-label="Kod">
            <label className={styles.field}>
              <span>Arkadaşının kodu</span>
              <input
                className={styles.code}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTyped()}
                placeholder="K7M4PQ"
                maxLength={8}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <button type="button" className="btn btn-small" onClick={addTyped} disabled={busy}>
              Ekle
            </button>
            {mine && (
              <button type="button" className="btn btn-small" onClick={makeMyCode} disabled={busy}>
                {myCode ? `Kodun: ${myCode}` : "Kendi kodumu al"}
              </button>
            )}
          </section>

          <section className={styles.controls} aria-label="Ayarlar">
            <label className={styles.field}>
              <span>En az</span>
              <select className="select" value={min} onChange={(e) => setMin(Number(e.target.value))}>
                {MIN_CHOICES.map((c) => (
                  <option key={c} value={c}>
                    {spanLabel(c)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-pen" onClick={copy}>
              Linki kopyala
            </button>
            {note && (
              <span className={styles.note} role="status">
                {note}
              </span>
            )}
          </section>

          {blocks.length === 0 ? (
            <p className={styles.none}>
              {people.length === 1
                ? "Tek kişilik listede ortak saat aranmaz; arkadaşının linkini ekle."
                : `Bu kadar uzun ortak boşluk yok. "En az" süresini düşürmeyi dene.`}
            </p>
          ) : (
            <>
              <p className={styles.summary}>
                <span className="num">{people.length}</span> kişi, haftada{" "}
                <strong>{spanLabel(total)}</strong> ortak boş.
              </p>

              <ul className={styles.list}>
                {byDay.map(({ day, list }) => (
                  <li key={day} className={styles.dayRow}>
                    <span className={styles.dayName}>{DAY_NAMES[day]}</span>
                    <span className={styles.slots}>
                      {list.map((b) => (
                        <span key={b.start} className={styles.slot}>
                          <span className="num">
                            {b.start}–{b.end}
                          </span>
                          <span className={styles.slotLen}>{spanLabel(b.minutes)}</span>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>

              <h2 className={styles.gridTitle}>{termLabel} haftası</h2>
              <WeekGrid
                meetings={meetings}
                freeDays={[]}
                range={{ start: 8 * 60, end: 21 * 60 }}
                days={WEEKDAYS}
                empty={null}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { WeekGrid } from "@/components/planner/WeekGrid";
import { placeMeetings, tightRange } from "@/components/planner/placed";
import { expandCorequisites, generateSchedules } from "@/lib/engine";
import { loadTerm } from "@/lib/data";
import { visibleDays } from "@/lib/days";
import { DEFAULT_WEIGHTS, encodeState, EMPTY_STATE } from "@/lib/planner/state";

// Ana sayfadaki çizelge gerçek veriden hesaplanır: bir bölümün bu dönemki derslerinin en uygun programı.
const SAMPLE = { program: "BSCS", year: 2, label: "Bilgisayar Mühendisliği 2. sınıf", codes: ["CS 112", "EE 203", "MATH 211", "MATH 217"] };

function sampleWeek() {
  const term = loadTerm("ozyegin");
  const picked = SAMPLE.codes.map((code) => term.courses.find((c) => c.code === code));
  if (picked.some((c) => !c)) return null;
  const courses = expandCorequisites(picked as NonNullable<(typeof picked)[number]>[], term.courses);
  const result = generateSchedules({ courses, freeDays: [], locked: {}, excluded: [], weights: DEFAULT_WEIGHTS, topN: 1 });
  const best = result.schedules[0];
  if (!best) return null;
  const byCode = new Map(courses.map((c) => [c.code, c]));
  const order = courses.map((c) => c.code);
  const meetings = placeMeetings(best.sections, byCode, (code) => order.indexOf(code) % 6);
  const query = encodeState({ ...EMPTY_STATE, cart: order, program: SAMPLE.program, year: SAMPLE.year });
  return { term, meetings, query, count: result.truncated ? "50.000'den fazla" : String(result.candidates.length) };
}

export default function Home() {
  const ozu = loadTerm("ozyegin");
  const sample = sampleWeek();
  return (
    <>
      <SiteHeader />
      <main id="icerik" className="page home">
        <div className="home-grid">
          <div>
            <h1 className="home-title">Dersleri seç, en iyi haftanı gör.</h1>
            <p className="home-lede">
              Çakışmayan bütün programları bulur ve senin önceliğine göre sıralar: kampüse az gün gelmek,
              sabah dersinden kaçmak ya da aradaki boşlukları kapatmak.
            </p>
            <ul className="school-list">
              <li>
                <Link href="/ozyegin" className="school-link">
                  Özyeğin Üniversitesi
                  <span>{ozu.termLabel}</span>
                </Link>
              </li>
            </ul>
            <p className="hint" style={{ marginTop: "1rem" }}>
              Okulun listede yok mu? <Link href="/hakkinda" className="link">Hangi okulların geleceğini oku</Link>.
            </p>
          </div>
          {sample && (
            <figure className="home-demo">
              <div style={{ "--hour-h": "30px" } as React.CSSProperties}>
                <WeekGrid meetings={sample.meetings} freeDays={[]} range={tightRange(sample.meetings, 6)} days={visibleDays(sample.meetings)} compact />
              </div>
              <figcaption className="home-demo-caption">
                <span>
                  {SAMPLE.label}, {sample.term.termLabel}: {sample.count} çakışmasız program içinden en uygunu.
                </span>
                <Link className="link" href={`/ozyegin?${sample.query}`}>
                  Planlayıcıda aç
                </Link>
              </figcaption>
            </figure>
          )}
        </div>
      </main>
    </>
  );
}

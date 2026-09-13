import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { WeekGrid } from "@/components/planner/WeekGrid";
import type { PlacedMeeting } from "@/components/planner/placed";
import { loadTerm } from "@/lib/data";
import { visibleDays } from "@/lib/days";

// Ana sayfadaki çizim yalnızca görünüşü anlatır; ders kodları bilerek genel tutuldu.
const DEMO: PlacedMeeting[] = [
  { courseCode: "Ders 1", sectionId: "", day: 1, start: "10:40", end: "12:30", instructor: null, color: 0 },
  { courseCode: "Ders 1", sectionId: "", day: 3, start: "10:40", end: "11:30", instructor: null, color: 0 },
  { courseCode: "Lab", sectionId: "", day: 2, start: "12:40", end: "14:30", instructor: null, color: 1 },
  { courseCode: "Ders 2", sectionId: "", day: 2, start: "14:40", end: "16:30", instructor: null, color: 2 },
  { courseCode: "Ders 2", sectionId: "", day: 4, start: "13:40", end: "15:30", instructor: null, color: 2 },
  { courseCode: "Ders 3", sectionId: "", day: 1, start: "13:40", end: "15:30", instructor: null, color: 3 },
  { courseCode: "Ders 3", sectionId: "", day: 3, start: "13:40", end: "14:30", instructor: null, color: 3 },
];

export default function Home() {
  const ozu = loadTerm("ozyegin");
  return (
    <>
      <SiteHeader />
      <main id="icerik" className="page">
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
          <div aria-hidden="true" style={{ "--hour-h": "34px" } as React.CSSProperties}>
            <WeekGrid meetings={DEMO} freeDays={[5]} range={{ start: 9 * 60, end: 17 * 60 }} days={visibleDays(DEMO)} />
          </div>
        </div>
      </main>
    </>
  );
}

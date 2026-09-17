"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  EMPTY_ERASMUS_PROFILE,
  EMPTY_PREFILL,
  erasmusPrefill,
  loadErasmusProfile,
  saveErasmusProfile,
  type ErasmusPrefill,
  type ErasmusProfile,
} from "@/lib/erasmus/prefill";
import type { ErasmusData } from "@/lib/erasmus/types";
import { loadState } from "@/lib/roadmap/storage";
import type { Program } from "@/lib/types";
import { Grant } from "./Grant";
import { InfoForm } from "./InfoForm";
import { Eligibility, ScoreEstimate } from "./Results";

interface Props {
  data: ErasmusData;
  /** Hafifletilmiş müfredatlar (src/lib/erasmus/prefill.ts slimPrograms). */
  programs: Program[];
}

type Prefillable = "gpa" | "ects";

export function Erasmus({ data, programs }: Props) {
  // Kullanıcının kendi girdiği bilgiler kaydedilir; yol haritasından gelenler ayrı tutulur, kaydedilmez.
  const [own, setOwn] = useState<ErasmusProfile>(EMPTY_ERASMUS_PROFILE);
  const [prefill, setPrefill] = useState<ErasmusPrefill>(EMPTY_PREFILL);
  // Ön doldurulan alanı kullanıcı boşaltırsa bu oturumda yeniden doldurulmaz.
  const [dismissed, setDismissed] = useState<ReadonlySet<Prefillable>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"dersler" | "program">("dersler");

  // Kayıtlar sunucuda yok: ilk çizim boş bilgiyle yapılır, sonra tarayıcıdaki kayıtlar okunur.
  useEffect(() => {
    const saved = loadErasmusProfile();
    const fromRoadmap = erasmusPrefill(loadState(), programs);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kayıt yalnızca tarayıcıda bilinir
    setOwn(saved);
    setPrefill(fromRoadmap);
    if (fromRoadmap.hasRoadmap || saved.ele !== null) setTab("program");
    setReady(true);
  }, [programs]);

  useEffect(() => {
    if (ready) saveErasmusProfile(own);
  }, [own, ready]);



  const pick = (key: Prefillable) => own[key] ?? (dismissed.has(key) ? null : prefill[key]);
  const gpa = pick("gpa");
  const ects = pick("ects");
  const prefilled = ready && ((own.gpa === null && gpa !== null) || (own.ects === null && ects !== null));

  function setPrefillable(key: Prefillable, value: number | null) {
    setOwn((o) => ({ ...o, [key]: value }));
    if (value === null && prefill[key] !== null) setDismissed((d) => new Set(d).add(key));
  }

  const input = { gpa, ects, ele: own.ele, criteria: own.criteria, target: own.target };

  return (
    <div className="planner transfer erasmus" data-tab={tab}>
      <div className="tabs" role="tablist" aria-label="Görünüm">
        <button type="button" role="tab" className="tab" aria-selected={tab === "dersler"} onClick={() => setTab("dersler")}>
          Bilgilerin
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "program"} onClick={() => setTab("program")}>
          Sonuçlar
        </button>
      </div>

      <aside className="rail" aria-label="Bilgilerin">
        <InfoForm
          data={data}
          gpa={gpa}
          ects={ects}
          profile={own}
          prefilled={prefilled}
          onGpa={(v) => setPrefillable("gpa", v)}
          onEcts={(v) => setPrefillable("ects", v)}
          onProfile={(patch) => setOwn((o) => ({ ...o, ...patch }))}
        />
        <button type="button" className="btn btn-pen tab-jump" onClick={() => setTab("program")}>
          Sonuçları gör
        </button>
      </aside>

      <main className="board er-board" id="icerik">
        <header className="gc-head er-screen">
          <h1 className="board-title">Erasmus başvurusu</h1>
          <p className="gc-lede">Başvuru şartlarını, tahmini Erasmus puanını ve alacağın hibeyi gör.</p>
          <p className="hint">Şartlar, puanlama ve hibe tutarları {data.callYear} çağrısına ait.</p>
        </header>

        <div className="er-screen er-stack">
          <Eligibility data={data} input={input} ready={ready} />
          <ScoreEstimate data={data} input={input} />
          <Grant data={data} grant={own.grant} onGrant={(patch) => setOwn((o) => ({ ...o, grant: { ...o.grant, ...patch } }))} />
        </div>


        <section className="gc-sources er-screen" aria-label="Kaynaklar">
          <h2 className="group-title er-h2">Kaynaklar</h2>
          <ul>
            {data.sources.map((s) => (
              <li key={s.url}>
                <a className="link" href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="hint gc-small">
            Bilgiler {new Date(data.fetchedAt).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde alındı.
          </p>
          <p>
            <Link className="link" href="/ozyegin/yol-haritasi">
              Erasmus dönemini yol haritasında planla
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { loadState } from "@/lib/roadmap/storage";
import {
  EMPTY_PROFILE,
  loadProfile,
  mergeProfile,
  prefillFromRoadmap,
  saveProfile,
  type PrefillIndex,
} from "@/lib/transfer/profile-storage";
import type { HistoryIndex } from "@/lib/transfer/history";
import type { StudentProfile, TransferData } from "@/lib/transfer/types";
import { ProfileForm, type ProgramOption } from "./ProfileForm";
import { Results } from "./Results";

interface Props {
  data: TransferData;
  /** Öğrencinin şu anki bölümü için seçenekler (programs.json, yalnızca ad ve fakülte). */
  programs: ProgramOption[];
  /** Yol haritası kaydından ortalama ve AKTS hesaplamak için sıkıştırılmış müfredatlar. */
  prefillIndex: PrefillIndex;
  /** Geçmiş dönemlerin başvuru sonuç özetleri (bölüm -> yol). */
  history: HistoryIndex;
}

type Field = keyof StudentProfile;

export function Transfer({ data, programs, prefillIndex, history }: Props) {
  // Kullanıcının kendi girdiği bilgiler (kaydedilir); ön doldurma ayrı tutulur, kaydedilmez.
  const [own, setOwn] = useState<StudentProfile>(EMPTY_PROFILE);
  const [prefill, setPrefill] = useState<Partial<StudentProfile>>({});
  // Ön doldurulan alanı kullanıcı boşaltırsa bu oturumda yeniden doldurulmaz.
  const [dismissed, setDismissed] = useState<ReadonlySet<Field>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"dersler" | "program">("dersler");

  // Kayıtlar sunucuda yok: ilk çizim boş bilgiyle yapılır, sonra tarayıcıdaki kayıtlar okunur.
  useEffect(() => {
    const saved = loadProfile();
    const fromRoadmap = prefillFromRoadmap(loadState(), prefillIndex);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kayıt yalnızca tarayıcıda bilinir
    setOwn(saved);
    setPrefill(fromRoadmap);
    if (saved.programId || fromRoadmap.programId) setTab("program");
    setReady(true);
  }, [prefillIndex]);

  useEffect(() => {
    if (ready) saveProfile(own);
  }, [own, ready]);

  const { profile, prefilled } = useMemo(() => mergeProfile(own, prefill, dismissed), [own, prefill, dismissed]);

  function setField<K extends Field>(key: K, value: StudentProfile[K]) {
    setOwn((o) => ({ ...o, [key]: value }));
    if (value === null && prefill[key] != null) setDismissed((d) => new Set(d).add(key));
  }

  return (
    <div className="planner transfer" data-tab={tab}>
      <div className="tabs" role="tablist" aria-label="Görünüm">
        <button type="button" role="tab" className="tab" aria-selected={tab === "dersler"} onClick={() => setTab("dersler")}>
          Bilgilerin
        </button>
        <button type="button" role="tab" className="tab" aria-selected={tab === "program"} onClick={() => setTab("program")}>
          Bölümler
        </button>
      </div>

      <aside className="rail" aria-label="Bilgilerin">
        <ProfileForm
          programs={programs}
          profile={profile}
          prefilled={ready && prefilled.length > 0}
          entryYears={entryYears(data)}
          onField={setField}
        />
        <button type="button" className="btn btn-pen tab-jump" onClick={() => setTab("program")}>
          Bölümleri gör
        </button>
      </aside>

      <main className="board" id="icerik">
        <Results data={data} profile={profile} ready={ready} history={history} />
      </main>
    </div>
  );
}

/** Kayıt yılı seçenekleri: verinin yılından geriye dokuz yıl. */
function entryYears(data: TransferData): number[] {
  // Saat dilimine göre değişmesin diye tarih metninden okunur ("2026-09-14T...").
  const last = Number(data.fetchedAt.slice(0, 4));
  const base = Number.isInteger(last) && last > 2000 ? last : 2026;
  return Array.from({ length: 9 }, (_, i) => base - i);
}

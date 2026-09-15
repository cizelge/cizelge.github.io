"use client";

// Karşı üniversite seçimi: yazdıkça süzülen liste (ARIA 1.2 combobox, açılır listbox).
// Özyeğin'in anlaşmalı okulları sayfayla gelir; Avrupa Komisyonu ECHE listesi ilk odakta tarayıcıda yüklenir.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { echeItems, findUniversity, searchUniversities, type UniversityItem } from "@/lib/erasmus/universities";

const ECHE_URL = "/data/eche-institutions.json";
const GROUP_LIMIT = 50;

type EcheStatus = "idle" | "loading" | "ready" | "error";

/** ECHE listesi: `load` ilk çağrıda indirir; hata olursa yalnızca anlaşmalı okullar kalır. */
export function useEcheInstitutions() {
  const [items, setItems] = useState<UniversityItem[]>([]);
  const [status, setStatus] = useState<EcheStatus>("idle");
  const started = useRef(false);

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setStatus("loading");
    fetch(ECHE_URL)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<unknown>;
      })
      .then((raw) => {
        const list = echeItems(raw);
        setItems(list);
        setStatus(list.length > 0 ? "ready" : "error");
      })
      .catch(() => setStatus("error"));
  }, []);

  return { items, status, load };
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  partners: readonly UniversityItem[];
  others: readonly UniversityItem[];
  othersStatus: EcheStatus;
  /** İlk odakta (ECHE listesini yüklemek için). */
  onFirstFocus?: () => void;
  placeholder?: string;
  /** Alanın altında gösterilecek seçili kurum bilgisi. */
  detail?: string | null;
}

type Option = { kind: "item"; item: UniversityItem } | { kind: "free"; text: string };

function metaText(u: UniversityItem): string {
  return [u.city, u.country].filter(Boolean).join(", ");
}

export function UniversityCombobox({ label, value, onChange, partners, others, othersStatus, onFirstFocus, placeholder, detail }: Props) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;
  const hintId = `${baseId}-hint`;
  const detailId = `${baseId}-detail`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const wrapRef = useRef<HTMLDivElement>(null);
  const focused = useRef(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // Yazmadan açıldıysa (odak, ok tuşu) seçili ada göre süzme; bütün anlaşmalı okullar görünsün.
  const [typed, setTyped] = useState(false);

  const query = typed ? value : "";
  const result = useMemo(() => searchUniversities(query, partners, others, GROUP_LIMIT), [query, partners, others]);

  const trimmed = value.trim();
  const exact = useMemo(() => (trimmed ? findUniversity(trimmed, partners, others) : null), [trimmed, partners, others]);
  const showFree = typed && trimmed.length > 0 && !exact;

  const options: Option[] = useMemo(() => {
    const list: Option[] = [...result.partners, ...result.others].map((item) => ({ kind: "item", item }));
    if (showFree) list.push({ kind: "free", text: trimmed });
    return list;
  }, [result, showFree, trimmed]);

  const activeIndex = active < options.length ? active : -1;

  function openList() {
    if (!open) {
      setOpen(true);
      setActive(-1);
    }
  }

  function close() {
    setOpen(false);
    setActive(-1);
    setTyped(false);
  }

  function choose(option: Option) {
    onChange(option.kind === "item" ? option.item.name : option.text);
    close();
  }

  // Dışarı tıklanınca kapanır.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
        setTyped(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Klavyeyle seçilen seçenek görünür kalsın.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(`${baseId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, baseId]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(e.altKey || last < 0 ? -1 : 0);
        } else if (last >= 0) setActive(activeIndex >= last ? 0 : activeIndex + 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(last);
        } else if (last >= 0) setActive(activeIndex <= 0 ? last : activeIndex - 1);
        break;
      case "Home":
      case "End":
        if (open && last >= 0) {
          e.preventDefault();
          setActive(e.key === "Home" ? 0 : last);
        }
        break;
      case "Enter":
        if (open) {
          e.preventDefault();
          if (activeIndex >= 0) choose(options[activeIndex]);
          else close();
        }
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          close();
        }
        break;
      case "Tab":
        if (open) close();
        break;
    }
  }

  const partnerCount = result.partners.length;
  const freeIndex = partnerCount + result.others.length;

  const renderItem = (item: UniversityItem, i: number) => {
    const meta = metaText(item);
    return (
      <div
        key={`${i}-${item.name}`}
        id={optionId(i)}
        role="option"
        aria-selected={i === activeIndex}
        className="uc-option"
        onPointerDown={(e) => e.preventDefault()}
        onPointerMove={() => i !== activeIndex && setActive(i)}
        onClick={() => choose({ kind: "item", item })}
      >
        <span className="uc-name">{item.name}</span>
        {(meta || item.erasmusCode) && (
          <span className="uc-meta">
            {meta && <span>{meta}</span>}
            {item.erasmusCode && <span className="uc-code">{item.erasmusCode}</span>}
          </span>
        )}
      </div>
    );
  };

  const loadingOthers = showFree && othersStatus === "loading";
  const noList = partners.length === 0 && options.length === 0;
  const expanded = open && (options.length > 0 || loadingOthers || noList);

  const describedBy = [detail ? detailId : null, hintId].filter(Boolean).join(" ");

  return (
    <div className="field er-host uc" ref={wrapRef}>
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="uc-anchor">
        <input
          id={inputId}
          className="select gc-input uc-input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={listId}
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onFocus={() => {
            if (!focused.current) {
              focused.current = true;
              onFirstFocus?.();
            }
          }}
          onClick={openList}
          onChange={(e) => {
            onChange(e.target.value);
            setTyped(true);
            setActive(-1);
            setOpen(true);
            onFirstFocus?.();
          }}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            // Seçeneğe tıklarken odak kaybolmaz (pointerdown engelli); başka yere geçildiyse kapanır.
            if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) {
              setOpen(false);
              setActive(-1);
              setTyped(false);
            }
          }}
        />
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="uc-list"
          hidden={!expanded}
          onPointerDown={(e) => e.preventDefault()}
        >
          {expanded && (
            <>
              {partnerCount > 0 && (
                <div role="group" aria-labelledby={`${baseId}-g1`} className="uc-group">
                  <div role="presentation" id={`${baseId}-g1`} className="uc-group-label">
                    Özyeğin&apos;in anlaşmalı olduğu okullar
                  </div>
                  {result.partners.map((item, i) => renderItem(item, i))}
                  {result.morePartners && (
                    <div role="presentation" className="uc-more">
                      Daha fazla sonuç için yazmaya devam et
                    </div>
                  )}
                </div>
              )}
              {result.others.length > 0 && (
                <div role="group" aria-labelledby={`${baseId}-g2`} className="uc-group">
                  <div role="presentation" id={`${baseId}-g2`} className="uc-group-label">
                    Diğer Avrupa üniversiteleri
                  </div>
                  {result.others.map((item, i) => renderItem(item, partnerCount + i))}
                  {result.moreOthers && (
                    <div role="presentation" className="uc-more">
                      Daha fazla sonuç için yazmaya devam et
                    </div>
                  )}
                </div>
              )}
              {loadingOthers && (
                <div role="presentation" className="uc-more">
                  Avrupa üniversiteleri yükleniyor…
                </div>
              )}
              {showFree && (
                <div
                  id={optionId(freeIndex)}
                  role="option"
                  aria-selected={freeIndex === activeIndex}
                  className="uc-option uc-free"
                  onPointerDown={(e) => e.preventDefault()}
                  onPointerMove={() => freeIndex !== activeIndex && setActive(freeIndex)}
                  onClick={() => choose({ kind: "free", text: trimmed })}
                >
                  <span className="uc-name">&ldquo;{trimmed}&rdquo; olarak kullan</span>
                </div>
              )}
              {noList && (
                <div role="presentation" className="uc-more">
                  Anlaşmalı okul listesi yok. Üniversitenin adını yazabilirsin.
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {detail && (
        <p id={detailId} className="hint uc-detail">
          {detail}
        </p>
      )}
      <p id={hintId} className="hint gc-small">
        Listede yoksa adını yazıp kullanabilirsin. Güncel anlaşma listesi için MyOzU&apos;daki çağrıya bak.
      </p>
    </div>
  );
}

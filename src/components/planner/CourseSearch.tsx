"use client";

import { useId, useState } from "react";
import type { Course } from "@/lib/types";
import { searchCourses } from "@/lib/planner/search";

interface Props {
  courses: readonly Course[];
  cart: readonly string[];
  onAdd: (code: string) => void;
}

export function CourseSearch({ courses, cart, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const results = searchCourses(courses, query);

  return (
    <section aria-labelledby={`${inputId}-t`}>
      <h2 className="group-title" id={`${inputId}-t`}>
        <label htmlFor={inputId}>Ders ekle</label>
      </h2>
      <input
        id={inputId}
        className="search-field"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Kod, ders adı ya da hoca"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0] && !cart.includes(results[0].code)) {
            onAdd(results[0].code);
            setQuery("");
          }
        }}
      />
      {query.trim() === "" ? (
        <p className="hint" style={{ marginTop: "0.5rem" }}>
          Örneğin <span className="num">CS 101</span> yaz, Enter ile ekle.
        </p>
      ) : results.length === 0 ? (
        <p className="hint" style={{ marginTop: "0.5rem" }} role="status">
          “{query.trim()}” ile eşleşen ders yok. Kodu boşluklu ya da boşluksuz yazabilirsin.
        </p>
      ) : (
        <ul className="results" aria-label="Arama sonuçları">
          {results.map((c) => {
            const inCart = cart.includes(c.code);
            return (
              <li key={c.code} className="result">
                <span className="result-code num">
                  {c.code}
                  {c.ects !== null && (
                    <span className="hint" style={{ fontWeight: 500 }}>
                      {" "}
                      {c.ects} AKTS
                    </span>
                  )}
                </span>
                <span className="result-title">
                  {c.title}, {c.sections.length} şube
                </span>
                <button
                  type="button"
                  className={`btn btn-small${inCart ? " btn-quiet" : ""}`}
                  disabled={inCart}
                  onClick={() => onAdd(c.code)}
                  aria-label={inCart ? `${c.code} sepette` : `${c.code} ekle`}
                >
                  {inCart ? "Sepette" : "Ekle"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

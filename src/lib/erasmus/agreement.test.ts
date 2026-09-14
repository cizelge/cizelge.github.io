import { afterEach, describe, expect, it, vi } from "vitest";
import { DRAFT_KEY, draftTotals, emptyDraft, loadDraft, saveDraft, validateDraft } from "./agreement";
import type { AgreementDraft } from "./types";

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    store,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("validateDraft", () => {
  it("returns empty draft for garbage", () => {
    for (const raw of [null, 5, "x", [], {}, { version: 2 }]) expect(validateDraft(raw)).toEqual(emptyDraft());
  });

  it("keeps valid fields and repairs bad ones", () => {
    const d = validateDraft({
      version: 1,
      hostUniversity: "TU Delft",
      term: { startYear: 2027, season: "bahar" },
      rows: [
        { id: "a", hostCode: "CS101", hostTitle: "Intro", hostEcts: 5, match: { kind: "requirement", requirementId: "BSCS:CS 101" } },
        { id: "a", hostCode: 7, hostTitle: "Dup id", hostEcts: -1, match: { kind: "code", code: "  " } },
        "junk",
        { hostCode: "X", hostEcts: "5", match: { kind: "code", code: "MATH 211" } },
      ],
    });
    expect(d.hostUniversity).toBe("TU Delft");
    expect(d.term).toEqual({ startYear: 2027, season: "bahar" });
    expect(d.rows).toHaveLength(3);
    expect(d.rows[0].match).toEqual({ kind: "requirement", requirementId: "BSCS:CS 101" });
    expect(d.rows[1]).toEqual({ id: "a-2", hostCode: "", hostTitle: "Dup id", hostEcts: null, match: null });
    expect(d.rows[2]).toMatchObject({ id: "row-4", hostCode: "X", hostTitle: "", hostEcts: null, match: { kind: "code", code: "MATH 211" } });
    expect(new Set(d.rows.map((r) => r.id)).size).toBe(3);
  });

  it("drops invalid term", () => {
    expect(validateDraft({ version: 1, term: { startYear: 2027, season: "yaz" } }).term).toBeNull();
    expect(validateDraft({ version: 1, term: { startYear: "2027", season: "guz" } }).term).toBeNull();
  });
});

describe("load/save", () => {
  it("round-trips through localStorage", () => {
    const ls = fakeStorage();
    vi.stubGlobal("window", { localStorage: ls });
    const d: AgreementDraft = {
      version: 1,
      hostUniversity: "KU Leuven",
      term: { startYear: 2026, season: "guz" },
      rows: [{ id: "r1", hostCode: "H1", hostTitle: "T", hostEcts: 6, match: null }],
    };
    saveDraft(d);
    expect(ls.store.has(DRAFT_KEY)).toBe(true);
    expect(loadDraft()).toEqual(d);
  });

  it("survives broken JSON, missing window and throwing storage", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage({ [DRAFT_KEY]: "{bad" }) });
    expect(loadDraft()).toEqual(emptyDraft());
    vi.stubGlobal("window", undefined);
    expect(loadDraft()).toEqual(emptyDraft());
    expect(() => saveDraft(emptyDraft())).not.toThrow();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("denied");
        },
        setItem: () => {
          throw new Error("quota");
        },
      },
    });
    expect(loadDraft()).toEqual(emptyDraft());
    expect(() => saveDraft(emptyDraft())).not.toThrow();
  });
});

describe("draftTotals", () => {
  const draft: AgreementDraft = {
    version: 1,
    hostUniversity: "",
    term: null,
    rows: [
      { id: "1", hostCode: "A", hostTitle: "", hostEcts: 5, match: { kind: "requirement", requirementId: "r1" } },
      { id: "2", hostCode: "B", hostTitle: "", hostEcts: 2.5, match: { kind: "requirement", requirementId: "r1" } },
      { id: "3", hostCode: "C", hostTitle: "", hostEcts: 6, match: { kind: "code", code: "cs 201" } },
      { id: "4", hostCode: "D", hostTitle: "", hostEcts: null, match: { kind: "code", code: "UNKNOWN 1" } },
      { id: "5", hostCode: "E", hostTitle: "", hostEcts: 4, match: null },
    ],
  };

  it("sums host ECTS, counts each OzU match once, ignores unknown credits", () => {
    const lookup = (m: { kind: string; requirementId?: string; code?: string }) =>
      m.kind === "requirement" ? 7.5 : m.code === "cs 201" ? 6 : null;
    expect(draftTotals(draft, lookup)).toEqual({ hostEcts: 17.5, matchedOzuEcts: 13.5, unmatchedRows: 1 });
  });

  it("tolerates a throwing lookup", () => {
    expect(
      draftTotals(draft, () => {
        throw new Error("x");
      }),
    ).toEqual({ hostEcts: 17.5, matchedOzuEcts: 0, unmatchedRows: 1 });
  });
});

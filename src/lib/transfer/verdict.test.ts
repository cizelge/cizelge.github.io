import { describe, expect, it } from "vitest";
import type { Check, PathResult } from "./types";
import { verdictFor, type HistoryStats } from "./verdict";

const path = (checks: Check[], p: PathResult["path"] = "cap"): PathResult => ({
  path: p,
  status: checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "unknown") ? "unknown" : "ok",
  checks,
  quota: null,
  scoreMargin: null,
});
const ok = (id: string): Check => ({ id, status: "ok", text: id });
const stats = (applications: number, accepted: number, conditional = 0, terms = 3): HistoryStats => ({
  terms,
  applications,
  accepted,
  conditional,
  rejected: applications - accepted - conditional,
  rate: applications ? (accepted + conditional) / applications : null,
});

describe("verdictFor", () => {
  it("says no with the first failing rule", () => {
    const v = verdictFor(path([ok("gpa"), { id: "credits", status: "fail", text: "84 AKTS gerekiyor" }]), stats(20, 19));
    expect(v).toMatchObject({ level: "no", title: "Olmaz", detail: "84 AKTS gerekiyor" });
  });

  it("uses the past acceptance rate when all rules pass", () => {
    expect(verdictFor(path([ok("gpa")]), stats(20, 16)).level).toBe("likely");
    expect(verdictFor(path([ok("gpa")]), stats(20, 8, 2)).level).toBe("maybe");
    expect(verdictFor(path([ok("gpa")]), stats(20, 5)).level).toBe("hard");
    expect(verdictFor(path([ok("gpa")]), stats(20, 16)).detail).toContain("20 başvurunun 16 tanesi kabul edildi (%80)");
  });

  it("does not give a rate with too little history", () => {
    expect(verdictFor(path([ok("gpa")]), stats(3, 3)).level).toBe("eligible");
    expect(verdictFor(path([ok("gpa")]), null).level).toBe("eligible");
  });

  it("asks for missing inputs, but ignores checks no input can resolve", () => {
    const missing = verdictFor(path([ok("gpa"), { id: "rank", status: "unknown", text: "Sıranı gir." }]), stats(20, 18));
    expect(missing).toMatchObject({ level: "unknown", missing: ["Sıranı gir."] });
    const internal = verdictFor(
      path([ok("semesters"), { id: "score", status: "unknown", text: "veride yok" }, { id: "notes", status: "unknown", text: "notlar" }], "internal"),
      stats(10, 9),
    );
    expect(internal.level).toBe("likely");
  });

  it("treats missing source data as a note, not as missing user input", () => {
    const v = verdictFor(path([ok("scoreType"), { id: "score", status: "unknown", text: "2024 taban puanı veride yok." }], "central"), stats(20, 18));
    expect(v.level).toBe("maybe");
    expect(v.detail).toContain("Kontrol edilemeyen: 2024 taban puanı veride yok.");
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_CUTOFFS, gradeState, neededScore, projected } from "./final";

const items = [
  { name: "Vize", weight: 30, score: 60 },
  { name: "Ödev", weight: 20, score: 90 },
  { name: "Final", weight: 50, score: null },
];

describe("gradeState", () => {
  it("girilen notların katkısını ve kalan ağırlığı hesaplar", () => {
    expect(gradeState(items)).toEqual({ earned: 36, remainingWeight: 50, totalWeight: 100 });
  });

  it("ağırlığı olmayan satırları yok sayar, puanı 0-100 arasına sıkıştırır", () => {
    expect(gradeState([{ name: "", weight: 0, score: 50 }, { name: "Quiz", weight: 10, score: 120 }])).toEqual({
      earned: 10,
      remainingWeight: 0,
      totalWeight: 10,
    });
  });
});

describe("neededScore", () => {
  const state = gradeState(items);

  it("hedef için finalden gereken puan, yukarı yuvarlanır", () => {
    expect(neededScore(state, 75)).toEqual({ kind: "score", score: 78 });
    expect(neededScore(state, 60)).toEqual({ kind: "score", score: 48 });
    expect(neededScore({ earned: 36, remainingWeight: 30, totalWeight: 66 }, 45)).toEqual({ kind: "score", score: 30 });
    expect(neededScore({ earned: 36.5, remainingWeight: 30, totalWeight: 66 }, 45)).toEqual({ kind: "score", score: 28.4 });
  });

  it("garanti ve imkânsız durumlar", () => {
    expect(neededScore(state, 30)).toEqual({ kind: "secured" });
    expect(neededScore(state, 90)).toEqual({ kind: "impossible", best: 86 });
    expect(neededScore({ earned: 70, remainingWeight: 0, totalWeight: 100 }, 75)).toEqual({ kind: "impossible", best: 70 });
  });
});

describe("projected", () => {
  it("kalanlardan alınacak puanla harf notu", () => {
    const state = gradeState(items);
    expect(projected(state, 78, DEFAULT_CUTOFFS)).toEqual({ total: 75, letter: "B" });
    expect(projected(state, 10, DEFAULT_CUTOFFS)).toEqual({ total: 41, letter: "F" });
  });
});

// Tarayıcısız duman testi: çözüm yok kutusundaki öneriler.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RelaxedConstraint, Suggestion } from "@/lib/engine";
import { NoSolution, suggestionLabel } from "./NoSolution";

const friday: RelaxedConstraint = { kind: "freeDay", day: 5 };
const lock: RelaxedConstraint = { kind: "lock", courseCode: "CS 101", sectionId: "A" };
const suggestion = (constraints: RelaxedConstraint[], scheduleCount: number): Suggestion => ({
  constraint: constraints[0],
  constraints,
  scheduleCount,
  truncated: false,
});

const render = (suggestions: Suggestion[]) =>
  renderToStaticMarkup(<NoSolution reason={null} suggestions={suggestions} onApply={() => {}} />);

describe("NoSolution", () => {
  it("joins a pair of relaxations into one sentence", () => {
    expect(suggestionLabel(suggestion([friday, lock], 2))).toBe("Cuma boş gün olmasın ve CS 101 şube kilidini kaldır");
    expect(suggestionLabel(suggestion([friday], 2))).toBe("Cuma boş gün olmasın");
  });

  it("renders pair suggestions as buttons with a note that one change is not enough", () => {
    const html = render([suggestion([friday, lock], 3)]);
    expect(html).toContain("Cuma boş gün olmasın ve CS 101 şube kilidini kaldır");
    expect(html).toContain("Tek bir ayarı değiştirmek yetmiyor");
    expect(html).not.toContain("Sepetten bir ders çıkarmayı dene.");
  });

  it("falls back to removing a course when nothing helps", () => {
    const html = render([]);
    expect(html).toContain("Sepetten bir ders çıkarmayı dene.");
    expect(html).not.toContain("<button");
  });
});

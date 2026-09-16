import { describe, expect, it } from "vitest";
import { instructorSlug } from "./instructors";

describe("instructorSlug", () => {
  it("Türkçe harfleri ve boşlukları çevirir", () => {
    expect(instructorSlug("EMRE SEFER")).toBe("emre-sefer");
    expect(instructorSlug("Gözde Ünal")).toBe("gozde-unal");
    expect(instructorSlug("  İlker  Hamzaoğlu ")).toBe("ilker-hamzaoglu");
    expect(instructorSlug("Ayşe-Nur Çelik")).toBe("ayse-nur-celik");
  });
});

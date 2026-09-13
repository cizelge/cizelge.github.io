import { describe, expect, it } from "vitest";
import { formatDuration, personName } from "./format";

describe("personName", () => {
  it("title-cases Turkish upper-case names correctly", () => {
    expect(personName("BURÇİN GÜNEŞ")).toBe("Burçin Güneş");
    expect(personName("İLKER HAMZAOĞLU")).toBe("İlker Hamzaoğlu");
    expect(personName("EVŞEN YANMAZ ADAM")).toBe("Evşen Yanmaz Adam");
    expect(personName("  AYŞE-NUR IŞIK ")).toBe("Ayşe-Nur Işık");
  });
});

describe("formatDuration", () => {
  it("formats minutes as hours and minutes", () => {
    expect(formatDuration(0)).toBe("yok");
    expect(formatDuration(45)).toBe("45 dk");
    expect(formatDuration(120)).toBe("2 sa");
    expect(formatDuration(150)).toBe("2 sa 30 dk");
  });
});

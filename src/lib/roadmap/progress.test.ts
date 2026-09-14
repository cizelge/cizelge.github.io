import { describe, expect, it } from "vitest";
import { canonicalCode, isDone, markUntil, passedCodes, passedEcts, programProgress } from "./progress";
import type { Requirement, RoadmapProgram } from "./types";

const course = (id: string, code: string, credits: number | null, slot: Requirement["slot"] = null): Requirement => ({
  id,
  programId: id.split(":")[0],
  kind: "course",
  code,
  title: code,
  credits,
  prerequisites: "",
  corequisites: [],
  pool: null,
  slot,
});

const elective = (id: string, credits: number, pool: Requirement["pool"], slot: Requirement["slot"] = null): Requirement => ({
  id,
  programId: id.split(":")[0],
  kind: "elective",
  code: null,
  title: "Seçmeli",
  credits,
  prerequisites: "",
  corequisites: [],
  pool,
  slot,
});

const prog = (id: string, kind: RoadmapProgram["kind"], requirements: Requirement[]): RoadmapProgram => ({
  id,
  kind,
  name: id,
  requirements,
  totalCredits: requirements.reduce((s, r) => s + (r.credits ?? 0), 0),
});

const anadal = prog("A", "anadal", [
  course("A:y1-guz:0", "CS 101", 6, { year: 1, season: "guz" }),
  course("A:y1-bahar:0", "MATH 104", 8, { year: 1, season: "bahar" }),
  elective("A:y2-guz:0", 4, [{ code: "EE 201", title: "EE", credits: 5 }], { year: 2, season: "guz" }),
  elective("A:y2-guz:1", 3, null, { year: 2, season: "guz" }),
]);
const cap = prog("C", "cap", [course("C:y1-guz:0", "CS101", 6, { year: 1, season: "guz" }), course("C:y2-guz:0", "EE 201", 6)]);

describe("canonicalCode", () => {
  it("yazımları birleştirir", () => {
    expect(canonicalCode("math103")).toBe("MATH 103");
    expect(canonicalCode(" CS  101L ")).toBe("CS 101L");
  });
});

describe("ilerleme", () => {
  it("ortak ders anadal ve çap arasında bir kez sayılır", () => {
    const completion = { "A:y1-guz:0": true as const };
    const passed = passedCodes([anadal, cap], completion);
    expect([...passed]).toEqual(["CS 101"]);
    expect(isDone(cap.requirements[0], completion, passed)).toBe(true);
    expect(passedEcts([anadal, cap], completion)).toBe(6);
    expect(programProgress(cap, completion, passed)).toEqual({
      programId: "C",
      passedCredits: 6,
      totalCredits: 12,
      remainingCourses: 1,
      remainingElectives: 0,
    });
  });

  it("havuzdan seçilen kod geçilen ders sayılır", () => {
    const completion = { "A:y2-guz:0": "EE 201", "A:y2-guz:1": true as const };
    const passed = passedCodes([anadal, cap], completion);
    expect(passed.has("EE 201")).toBe(true);
    expect(isDone(cap.requirements[1], completion, passed)).toBe(true);
    // EE 201 bir kez (havuzdaki 5 AKTS), serbest seçmeli ayrıca 3.
    expect(passedEcts([anadal, cap], completion)).toBe(8);
    const pr = programProgress(anadal, completion, passed);
    expect(pr).toMatchObject({ passedCredits: 7, remainingCourses: 2, remainingElectives: 0 });
  });

  it("markUntil verilen dönemden öncekileri işaretler", () => {
    expect(markUntil(anadal, { year: 1, season: "bahar" })).toEqual({ "A:y1-guz:0": true });
    expect(markUntil(anadal, { year: 3, season: "guz" })).toEqual({
      "A:y1-guz:0": true,
      "A:y1-bahar:0": true,
      "A:y2-guz:0": true,
      "A:y2-guz:1": true,
    });
    // Slotu olmayan (yandal/çap satırı) işaretlenmez.
    expect(markUntil(cap, { year: 9, season: "guz" })).toEqual({ "C:y1-guz:0": true });
  });
});

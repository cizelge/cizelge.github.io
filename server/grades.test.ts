import { describe, expect, it } from "vitest";
import { cleanTerm, courseKey, parseGrade, summarizeCourse, type GradeRow } from "./grades.ts";

const now = new Date("2026-09-19T00:00:00Z");
const valid = { school: "ozyegin", course: "CS 201", letter: "B+", instructor: "hasan-sozer", term: "2025-2026-guz", device: "a".repeat(20) };

describe("courseKey", () => {
  it("boşlukları atar, büyütür", () => {
    expect(courseKey("cs 201")).toBe("CS201");
    expect(courseKey("MATH211R")).toBe("MATH211R");
  });

  it("kod olmayanı almaz", () => {
    expect(courseKey("ders")).toBeNull();
    expect(courseKey(42)).toBeNull();
  });
});

describe("cleanTerm", () => {
  it("geçerli dönemi alır", () => {
    expect(cleanTerm("2025-2026-guz", now)).toBe("2025-2026-guz");
  });

  it("yılları tutmayan ya da uydurma dönemi almaz", () => {
    expect(cleanTerm("2025-2027-guz", now)).toBeNull();
    expect(cleanTerm("2025-2026-kis", now)).toBeNull();
    expect(cleanTerm("2030-2031-guz", now)).toBeNull();
  });
});

describe("parseGrade", () => {
  it("geçerli bildirimi kabul eder", () => {
    const r = parseGrade(valid, now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grade).toMatchObject({ course: "CS201", letter: "B+", instructor: "hasan-sozer" });
  });

  it("hoca boşsa null kabul eder", () => {
    const r = parseGrade({ ...valid, instructor: "" }, now);
    expect(r.ok && r.grade.instructor).toBeNull();
  });

  it("olmayan harfi almaz", () => {
    expect(parseGrade({ ...valid, letter: "AA" }, now)).toMatchObject({ ok: false });
  });

  it("cihaz kimliği kısaysa almaz", () => {
    expect(parseGrade({ ...valid, device: "kisa" }, now)).toMatchObject({ ok: false });
  });
});

const row = (letter: string, instructor: string | null, term = "2025-2026-guz"): GradeRow =>
  ({ letter, instructor, term }) as GradeRow;

describe("summarizeCourse", () => {
  it("eşiğin altında dağılımı gizler ama sayıyı verir", () => {
    const out = summarizeCourse("CS201", [row("A", "a-hoca"), row("B", "a-hoca")]);
    expect(out).toMatchObject({ n: 2, hidden: true, letters: {}, gpa: null });
  });

  it("eşiği geçince dağılımı, ortalamayı ve geçme oranını verir", () => {
    const rows = [row("A", null), row("A", null), row("B", null), row("F", null), row("D", null)];
    const out = summarizeCourse("CS201", rows);
    expect(out.hidden).toBe(false);
    expect(out.n).toBe(5);
    expect(out.letters).toEqual({ A: 2, B: 1, F: 1, D: 1 });
    // (4 + 4 + 3 + 0 + 1) / 5
    expect(out.gpa).toBe(2.4);
    expect(out.pass).toBe(80);
  });

  it("W ortalamaya ve geçme oranına girmez", () => {
    const rows = [row("A", null), row("A", null), row("A", null), row("A", null), row("W", null)];
    const out = summarizeCourse("CS201", rows);
    expect(out.gpa).toBe(4);
    expect(out.pass).toBe(100);
    expect(out.letters.W).toBe(1);
  });

  it("hoca kırılımı yalnızca kendi eşiğini geçenler için", () => {
    const cok = Array.from({ length: 5 }, () => row("A", "cok-oy"));
    const az = Array.from({ length: 2 }, () => row("F", "az-oy"));
    const out = summarizeCourse("CS201", [...cok, ...az]);
    expect(out.instructors.map((i) => i.slug)).toEqual(["cok-oy"]);
    expect(out.instructors[0]).toMatchObject({ n: 5, gpa: 4, pass: 100 });
  });

  it("dönemleri yeniden eskiye sıralar", () => {
    const rows = [row("A", null, "2024-2025-bahar"), row("A", null, "2025-2026-guz"), row("A", null, "2024-2025-bahar")];
    expect(summarizeCourse("CS201", rows).terms).toEqual(["2025-2026-guz", "2024-2025-bahar"]);
  });
});

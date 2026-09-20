import { describe, expect, it } from "vitest";
import { courseKey, courseScore, parseCourseVote, summarizeCourses, type CourseRow } from "./courses.ts";

const valid = {
  school: "ozyegin",
  course: "CS 201",
  title: "Veri Yapıları ve Algoritmalar",
  again: true,
  criteria: { useful: 5, interesting: 4, difficulty: 5, workload: 4 },
  device: "a".repeat(20),
};

describe("courseKey", () => {
  it("boşluğu atar, büyütür", () => {
    expect(courseKey("cs 201")).toBe("CS201");
    expect(courseKey("MATH211R")).toBe("MATH211R");
  });

  it("kod olmayanı almaz", () => {
    expect(courseKey("ders adı")).toBeNull();
  });
});

describe("parseCourseVote", () => {
  it("geçerli oyu kabul eder", () => {
    const r = parseCourseVote(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.vote).toMatchObject({ course: "CS201", again: true, criteria: { useful: 5, workload: 4 } });
  });

  it("kriterler isteğe bağlı", () => {
    const r = parseCourseVote({ ...valid, criteria: {} });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.vote.criteria).toEqual({});
  });

  it("aralık dışını almaz", () => {
    expect(parseCourseVote({ ...valid, criteria: { useful: 6 } })).toMatchObject({ ok: false });
  });

  it("yine alır mıydın eksikse almaz", () => {
    const { again: _, ...rest } = valid;
    void _;
    expect(parseCourseVote(rest)).toMatchObject({ ok: false });
  });

  it("kısa yorumu almaz, uzun yorumu alır", () => {
    expect(parseCourseVote({ ...valid, comment: "kısa" })).toMatchObject({ ok: false });
    const r = parseCourseVote({ ...valid, comment: "Dersin içeriği doyurucu, ödevler zaman alıyor." });
    expect(r.ok).toBe(true);
  });
});

describe("courseScore", () => {
  it("yalnızca faydalı ve ilgi çekiciyi sayar", () => {
    expect(courseScore({ useful: 5, interesting: 4, difficulty: 1, workload: 1 })).toBe(4.5);
  });

  it("zorluk tek başınaysa puan yok", () => {
    expect(courseScore({ difficulty: 5, workload: 5 })).toBeNull();
  });
});

describe("summarizeCourses", () => {
  const rows: CourseRow[] = [
    {
      course: "CS201",
      title: "Veri Yapıları",
      n: 4,
      again: 0.75,
      criteria: { useful: { avg: 4.5, n: 4 }, interesting: { avg: 4, n: 3 }, difficulty: { avg: 4.75, n: 4 } },
      comments: [
        { id: "a", text: "eski", at: "2026-01-01T00:00:00Z", again: true, score: 4 },
        { id: "b", text: "yeni", at: "2026-05-01T00:00:00Z", again: false, score: 3 },
      ],
    },
    { course: "MATH211", title: "Doğrusal Cebir", n: 9, again: 0.5, criteria: { useful: { avg: 3, n: 9 } } },
  ];

  it("oy sayısına göre sıralar", () => {
    expect(summarizeCourses(rows).map((c) => c.course)).toEqual(["MATH211", "CS201"]);
  });

  it("yüzdeye çevirir ve puanı hesaplar", () => {
    const [, cs] = summarizeCourses(rows);
    expect(cs).toMatchObject({ again: 75, score: 4.3, criteria: { useful: 4.5, difficulty: 4.8 } });
  });

  it("yorumları yeniden eskiye sıralar", () => {
    const [, cs] = summarizeCourses(rows);
    expect(cs.comments.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

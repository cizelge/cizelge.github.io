import { describe as test, expect, it } from "vitest";
import { cleanInstructor, describe, parseVote, summarize, summarizeInstructors, type Row } from "./logic.ts";

const valid = { school: "ozyegin", code: "CS 201", instructor: "Ahmet Yılmaz", difficulty: 4, workload: 3, again: true, device: "a".repeat(20) };

test("parseVote", () => {
  it("geçerli oyu kabul eder ve kodu düzeltir", () => {
    const r = parseVote({ ...valid, code: " cs  201 " });
    expect(r.ok && r.vote.code).toBe("CS 201");
  });

  it("geçersiz alanları reddeder", () => {
    expect(parseVote({ ...valid, code: "CS201" }).ok).toBe(false);
    expect(parseVote({ ...valid, difficulty: 6 }).ok).toBe(false);
    expect(parseVote({ ...valid, difficulty: 2.5 }).ok).toBe(false);
    expect(parseVote({ ...valid, workload: 0 }).ok).toBe(false);
    expect(parseVote({ ...valid, again: "evet" }).ok).toBe(false);
    expect(parseVote({ ...valid, device: "kısa" }).ok).toBe(false);
    expect(parseVote({ ...valid, school: "Özyeğin" }).ok).toBe(false);
    expect(parseVote(null).ok).toBe(false);
  });

  it("Türkçe kod ve laboratuvar eki", () => {
    expect(parseVote({ ...valid, code: "MİM 105" }).ok).toBe(true);
    expect(parseVote({ ...valid, code: "CS 201L" }).ok).toBe(true);
  });

  it("hoca kriterleri: yalnızca hoca seçiliyse saklanır, 1-5 dışı reddedilir", () => {
    const withTeacher = parseVote({ ...valid, criteria: { clarity: 5, fairness: 2, helpful: 4, attendance: 1 } });
    expect(withTeacher.ok && withTeacher.vote.criteria).toEqual({ clarity: 5, fairness: 2, helpful: 4, attendance: 1 });
    const without = parseVote({ ...valid, instructor: null, criteria: { clarity: 5 } });
    expect(without.ok && without.vote.criteria).toEqual({});
    expect(parseVote({ ...valid, criteria: { clarity: 7 } }).ok).toBe(false);
    // Tanınmayan alan yok sayılır.
    const extra = parseVote({ ...valid, criteria: { clarity: 3, sallama: 9 } });
    expect(extra.ok && extra.vote.criteria).toEqual({ clarity: 3 });
  });

  it("hoca adı kısaysa ya da yoksa null", () => {
    expect(cleanInstructor("  Ali   Veli ")).toBe("Ali Veli");
    expect(cleanInstructor("ab")).toBeNull();
    expect(cleanInstructor(42)).toBeNull();
    expect(cleanInstructor("x".repeat(200))?.length).toBe(80);
  });
});

test("summarize", () => {
  const rows: Row[] = [
    { code: "CS 201", n: 42, difficulty: 3.84, workload: 2.6, again: 0.715 },
    { code: "CS 202", n: 2, difficulty: 5, workload: 5, again: 0 },
  ];
  const instructors: Row[] = [
    {
      code: "CS 201",
      instructor: "Ahmet Yılmaz",
      n: 12,
      difficulty: 3.2,
      workload: 2.4,
      again: 0.83,
      criteria: { clarity: { avg: 4.2, n: 8 }, fairness: { avg: 3.5, n: 3 } },
    },
    { code: "CS 201", instructor: "Ayşe Kaya", n: 4, difficulty: 4.5, workload: 3, again: 0.5 },
    { code: "CS 202", instructor: "Ahmet Yılmaz", n: 9, difficulty: 3, workload: 3, again: 1, criteria: { clarity: { avg: 3.4, n: 5 } } },
  ];

  it("eşiğin altındaki dersi, hocayı ve kriteri gizler", () => {
    const s = summarize(rows, instructors);
    expect(Object.keys(s)).toEqual(["CS 201"]);
    // Anlatımı 8 kişi cevaplamış: görünür. Notlandırmayı 3 kişi cevaplamış: gizli.
    expect(s["CS 201"].instructors).toEqual([{ name: "Ahmet Yılmaz", n: 12, difficulty: 3.2, again: 83, criteria: { clarity: 4.2 } }]);
  });

  it("hocayı bütün derslerinde toplar", () => {
    const [ahmet, ...rest] = summarizeInstructors(instructors);
    // Ayşe Kaya 4 oyla eşiğin altında.
    expect(rest).toEqual([]);
    expect(ahmet).toMatchObject({ name: "Ahmet Yılmaz", n: 21, difficulty: 3.1, again: 90 });
    expect(ahmet.criteria).toEqual({ clarity: 3.9 });
    expect(ahmet.courses.map((c) => c.code)).toEqual(["CS 201", "CS 202"]);
  });

  it("cümleye çevirir", () => {
    expect(describe(summarize(rows)["CS 201"])).toBe("Zorluk 3,8/5, haftada 5–8 saat, %72 tekrar alır (42 oy)");
  });
});

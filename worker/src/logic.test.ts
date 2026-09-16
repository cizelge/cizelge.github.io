import { describe as test, expect, it } from "vitest";
import { cleanInstructor, describe, parseVote, summarize, summarizeInstructors } from "./logic";

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

  it("hoca seçilmediyse anlatım ve notlandırma saklanmaz", () => {
    const withTeacher = parseVote({ ...valid, clarity: 5, fairness: 2 });
    expect(withTeacher.ok && withTeacher.vote).toMatchObject({ clarity: 5, fairness: 2 });
    const without = parseVote({ ...valid, instructor: null, clarity: 5, fairness: 2 });
    expect(without.ok && without.vote).toMatchObject({ clarity: null, fairness: null });
    expect(parseVote({ ...valid, clarity: 7 }).ok).toBe(false);
  });

  it("hoca adı kısaysa ya da yoksa null", () => {
    expect(cleanInstructor("  Ali   Veli ")).toBe("Ali Veli");
    expect(cleanInstructor("ab")).toBeNull();
    expect(cleanInstructor(42)).toBeNull();
    expect(cleanInstructor("x".repeat(200))?.length).toBe(80);
  });
});

test("summarize", () => {
  const rows = [
    { code: "CS 201", n: 42, difficulty: 3.84, workload: 2.6, again: 0.715 },
    { code: "CS 202", n: 2, difficulty: 5, workload: 5, again: 0 },
  ];
  const instructors = [
    { code: "CS 201", instructor: "Ahmet Yılmaz", n: 12, difficulty: 3.2, workload: 2.4, again: 0.83, clarity: 4.2, clarityN: 8, fairness: 3.5, fairnessN: 3 },
    { code: "CS 201", instructor: "Ayşe Kaya", n: 4, difficulty: 4.5, workload: 3, again: 0.5 },
    { code: "CS 202", instructor: "Ahmet Yılmaz", n: 9, difficulty: 3, workload: 3, again: 1, clarity: 3.4, clarityN: 5 },
  ];

  it("eşiğin altındaki dersi ve hocayı gizler", () => {
    const s = summarize(rows, instructors);
    expect(Object.keys(s)).toEqual(["CS 201"]);
    expect(s["CS 201"]).toMatchObject({ n: 42, difficulty: 3.8, workload: 2.6, again: 72 });
    // Anlatımı 8 kişi cevaplamış: gösterilir. Notlandırmayı 3 kişi cevaplamış: gösterilmez.
    expect(s["CS 201"].instructors).toEqual([
      { name: "Ahmet Yılmaz", n: 12, difficulty: 3.2, again: 83, clarity: 4.2, fairness: null },
    ]);
  });

  it("hocayı bütün derslerinde toplar", () => {
    const [ahmet, ...rest] = summarizeInstructors(instructors);
    // Ayşe Kaya 4 oyla eşiğin altında.
    expect(rest).toEqual([]);
    expect(ahmet).toMatchObject({ name: "Ahmet Yılmaz", n: 21, difficulty: 3.1, again: 90 });
    expect(ahmet.clarity).toBe(3.9);
    expect(ahmet.fairness).toBeNull();
    expect(ahmet.courses.map((c) => c.code)).toEqual(["CS 201", "CS 202"]);
  });

  it("cümleye çevirir", () => {
    expect(describe(summarize(rows)["CS 201"])).toBe("Zorluk 3,8/5, haftada 5–8 saat, %72 tekrar alır (42 oy)");
  });
});

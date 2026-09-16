import { describe as test, expect, it } from "vitest";
import { cleanComment, cleanInstructor, overallScore, parseVote, summarize, type Row } from "./logic.ts";

const valid = {
  school: "ozyegin",
  instructor: "Emre Sefer",
  slug: "emre-sefer",
  again: true,
  criteria: { clarity: 5, fairness: 4, helpful: 4, attendance: 2 },
  device: "a".repeat(20),
};

test("parseVote", () => {
  it("geçerli oyu kabul eder", () => {
    const r = parseVote(valid);
    expect(r.ok && r.vote).toMatchObject({ slug: "emre-sefer", again: true, criteria: { clarity: 5, attendance: 2 } });
  });

  it("geçersiz alanları reddeder", () => {
    expect(parseVote({ ...valid, school: "Özyeğin" }).ok).toBe(false);
    expect(parseVote({ ...valid, slug: "Emre Sefer" }).ok).toBe(false);
    expect(parseVote({ ...valid, instructor: "ab" }).ok).toBe(false);
    expect(parseVote({ ...valid, again: "evet" }).ok).toBe(false);
    expect(parseVote({ ...valid, device: "kısa" }).ok).toBe(false);
    expect(parseVote({ ...valid, criteria: { clarity: 7 } }).ok).toBe(false);
    expect(parseVote(null).ok).toBe(false);
  });

  it("kriterler isteğe bağlı, tanınmayan alan yok sayılır", () => {
    const bos = parseVote({ ...valid, criteria: undefined });
    expect(bos.ok && bos.vote.criteria).toEqual({});
    const extra = parseVote({ ...valid, criteria: { clarity: 3, sallama: 9 } });
    expect(extra.ok && extra.vote.criteria).toEqual({ clarity: 3 });
  });

  it("yorum: boşluk temizlenir, kısa ve küfürlü olan reddedilir", () => {
    expect(cleanComment("  Gayet   iyi  anlatıyor. ")).toEqual({ ok: true, comment: "Gayet iyi anlatıyor." });
    expect(cleanComment("")).toEqual({ ok: true, comment: null });
    expect(cleanComment(undefined)).toEqual({ ok: true, comment: null });
    expect(cleanComment("kısa").ok).toBe(false);
    expect(cleanComment("x".repeat(501)).ok).toBe(false);
    expect(cleanComment("bu adam tam bir şerefsiz").ok).toBe(false);
    const withComment = parseVote({ ...valid, comment: "Ödevleri çok ama anlatımı iyi." });
    expect(withComment.ok && withComment.vote.comment).toBe("Ödevleri çok ama anlatımı iyi.");
    expect(parseVote({ ...valid, comment: "salak herif" }).ok).toBe(false);
  });

  it("hoca adını temizler", () => {
    expect(cleanInstructor("  Ali   Veli ")).toBe("Ali Veli");
    expect(cleanInstructor("ab")).toBeNull();
    expect(cleanInstructor(42)).toBeNull();
    expect(cleanInstructor("x".repeat(200))?.length).toBe(80);
  });
});

test("summarize", () => {
  const rows: Row[] = [
    {
      slug: "emre-sefer",
      name: "EMRE SEFER",
      n: 12,
      again: 0.83,
      criteria: { clarity: { avg: 4.24, n: 12 }, fairness: { avg: 3.5, n: 6 }, attendance: { avg: 1.8, n: 9 } },
    },
    {
      slug: "ayse-kaya",
      name: "AYŞE KAYA",
      n: 1,
      again: 0,
      criteria: {},
      comments: [
        { id: "a1", text: "Eski yorum", at: "2026-01-01T10:00:00Z", again: false, score: 2 },
        { id: "b2", text: "Yeni yorum", at: "2026-05-01T10:00:00Z", again: true, score: 4 },
      ],
    },
  ];

  it("ilk oydan itibaren gösterir ve çoktan aza sıralar", () => {
    const [ilk, ikinci] = summarize(rows);
    expect(ilk).toEqual({
      slug: "emre-sefer",
      name: "EMRE SEFER",
      n: 12,
      again: 83,
      criteria: { clarity: 4.2, fairness: 3.5, attendance: 1.8 },
      score: 3.9,
      comments: [],
    });
    expect(ikinci).toMatchObject({ slug: "ayse-kaya", n: 1, criteria: {}, score: null });
    // Yorumlar yeniden eskiye.
    expect(ikinci.comments.map((c) => c.text)).toEqual(["Yeni yorum", "Eski yorum"]);
  });

  it("genel puana yoklama girmez", () => {
    expect(overallScore({ clarity: 4, fairness: 4, helpful: 4, attendance: 1 })).toBe(4);
    expect(overallScore({ attendance: 5 })).toBeNull();
  });
});

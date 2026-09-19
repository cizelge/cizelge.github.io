import { describe, expect, it } from "vitest";
import type { PlacedMeeting } from "@/components/planner/placed";
import type { ScheduleSummary } from "../engine";
import { DARK_PALETTE, IMAGE_LAYOUT as L, LIGHT_PALETTE, buildScheduleSvg, imageFileName, mixOklab } from "./image";

const meeting = (over: Partial<PlacedMeeting>): PlacedMeeting => ({
  courseCode: "CS 101",
  sectionId: "A",
  day: 1,
  start: "10:40",
  end: "12:30",
  instructor: null,
  color: 0,
  ...over,
});

const summary: ScheduleSummary = { days: 2, gapMinutes: 150, earliestStart: "08:40", latestEnd: "16:30" };

const build = (meetings: PlacedMeeting[], over: Partial<Parameters<typeof buildScheduleSvg>[0]> = {}) =>
  buildScheduleSvg({
    meetings,
    days: [1, 2, 3, 4, 5],
    termLabel: "2026 - 2027 Güz",
    title: "1. program",
    summary,
    ...over,
  });

/** The background rect of the block for `key` = "CODE SECTION DAY START". */
function blockRect(svg: string, key: string) {
  const tag = svg.match(new RegExp(`<rect class="block" data-key="${key}"[^>]*>`))?.[0];
  if (!tag) throw new Error(`no block ${key}`);
  const num = (name: string) => Number(tag.match(new RegExp(` ${name}="([^"]+)"`))![1]);
  return { x: num("x"), y: num("y"), width: num("width"), height: num("height"), fill: tag.match(/fill="([^"]+)"/)![1] };
}

const round = (n: number) => Math.round(n * 100) / 100;

describe("buildScheduleSvg", () => {
  const meetings = [
    meeting({ courseCode: "CS 101", sectionId: "A", day: 1, start: "10:40", end: "12:30", instructor: "BURÇİN GÜNEŞ" }),
    meeting({ courseCode: "MATH 211", sectionId: "B", day: 3, start: "08:40", end: "09:30", color: 1 }),
    meeting({ courseCode: "PHYS 101", sectionId: "C", day: 5, start: "15:40", end: "16:30", color: 2 }),
  ];

  it("writes every course code, day name, hour label, header and footer", () => {
    const { svg } = build(meetings);
    expect(svg.startsWith("<svg")).toBe(true);
    for (const code of ["CS 101", "MATH 211", "PHYS 101"]) expect(svg).toContain(code);
    for (const day of ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]) expect(svg).toContain(`>${day}<`);
    expect(svg).not.toContain("Cumartesi");
    for (const h of ["08:00", "12:00", "17:00"]) expect(svg).toContain(`>${h}<`);
    expect(svg).not.toContain(">18:00<");
    expect(svg).toContain(">OzuHelper<");
    expect(svg).toContain(">2026 - 2027 Güz<");
    expect(svg).toContain(">1. program<");
    expect(svg).toContain(">2 gün<");
    expect(svg).toContain(">2 sa 30 dk boşluk<");
    expect(svg).toContain(">08:40<");
    expect(svg).toContain(">16:30<");
    expect(svg).toContain("Özyeğin Üniversitesi için hazırlandı, resmi değildir");
    expect(svg).toContain("Burçin Güneş");
    expect(svg).toContain('font-family="Onest, system-ui, sans-serif"');
  });

  it("places blocks by day column and minutes since the first hour", () => {
    const { svg, width, height } = build(meetings);
    const colW = (L.width - 2 * L.pad - L.hourCol) / 5;
    const bodyTop = L.gridTop + L.dayRow;
    expect(width).toBe(1200);
    // 08:00–18:00 = 10 hours
    expect(height).toBe(bodyTop + 10 * L.hourHeight + L.footer);

    const cs = blockRect(svg, "CS 101 A 1 10:40");
    expect(cs.x).toBe(L.pad + L.hourCol + L.blockGap);
    expect(cs.width).toBe(round(colW - 2 * L.blockGap));
    expect(cs.y).toBe(round(bodyTop + (160 * L.hourHeight) / 60));
    expect(cs.height).toBe(round((110 * L.hourHeight) / 60));

    const math = blockRect(svg, "MATH 211 B 3 08:40");
    expect(math.x).toBe(round(L.pad + L.hourCol + 2 * colW + L.blockGap));
    expect(math.y).toBe(round(bodyTop + (40 * L.hourHeight) / 60));
    expect(math.height).toBe(round((50 * L.hourHeight) / 60));

    const phys = blockRect(svg, "PHYS 101 C 5 15:40");
    expect(phys.x).toBe(round(L.pad + L.hourCol + 4 * colW + L.blockGap));
  });

  it("pins the concrete geometry of one block", () => {
    const cs = blockRect(build(meetings).svg, "CS 101 A 1 10:40");
    expect(cs).toMatchObject({ x: 115, y: 429.33, width: 202, height: 124.67 });
  });

  it("widens the hour range to fit early and late meetings", () => {
    const early = meeting({ start: "07:30", end: "09:00" });
    const late = meeting({ courseCode: "LATE 1", day: 2, start: "18:00", end: "19:10" });
    const { svg, height } = build([early, late]);
    const bodyTop = L.gridTop + L.dayRow;
    expect(height).toBe(bodyTop + 13 * L.hourHeight + L.footer); // 07:00–20:00
    expect(blockRect(svg, "CS 101 A 1 07:30").y).toBe(round(bodyTop + (30 * L.hourHeight) / 60));
    expect(svg).toContain(">07:00<");
    expect(svg).toContain(">19:00<");
  });

  it("adds weekend columns only when given", () => {
    const sat = meeting({ day: 6, start: "09:00", end: "12:50" });
    const { svg } = build([sat], { days: [1, 2, 3, 4, 5, 6] });
    const colW = (L.width - 2 * L.pad - L.hourCol) / 6;
    expect(svg).toContain(">Cumartesi<");
    expect(blockRect(svg, "CS 101 A 6 09:00").x).toBe(round(L.pad + L.hourCol + 5 * colW + L.blockGap));
  });

  it("splits overlapping meetings into lanes", () => {
    const a = meeting({ courseCode: "A 1", start: "10:00", end: "12:00" });
    const b = meeting({ courseCode: "B 1", start: "11:00", end: "12:00" });
    const { svg } = build([a, b]);
    const inner = (L.width - 2 * L.pad - L.hourCol) / 5 - 2 * L.blockGap;
    const ra = blockRect(svg, "A 1 A 1 10:00");
    const rb = blockRect(svg, "B 1 A 1 11:00");
    expect(ra.width).toBe(round(inner / 2 - 1));
    expect(rb.x).toBe(round(ra.x + inner / 2));
  });

  it("fills blocks with the highlighter mixed over paper and draws the full colour bar", () => {
    const { svg } = build(meetings);
    const fill = mixOklab(LIGHT_PALETTE.highlighters[1], LIGHT_PALETTE.paper, LIGHT_PALETTE.mix);
    expect(blockRect(svg, "MATH 211 B 3 08:40").fill).toBe(fill);
    expect(svg).toContain(`width="4" height="${round((50 * L.hourHeight) / 60)}" fill="#8ee59b"`);
    expect(svg).toContain('fill="#fbfbf8"');
  });

  it("escapes XML special characters in every text", () => {
    const odd = meeting({ courseCode: 'R&D <1>', sectionId: '"X"', instructor: "A & B" });
    const { svg } = build([odd], { termLabel: "Güz & <Bahar>", title: 'Say "hi"' });
    expect(svg).toContain("R&amp;D &lt;1&gt;");
    expect(svg).toContain("&quot;X&quot;");
    expect(svg).toContain("Güz &amp; &lt;Bahar&gt;");
    expect(svg).toContain("Say &quot;hi&quot;");
    expect(svg).not.toContain("<1>");
    expect(svg).not.toContain("<Bahar>");
    // Attribute values stay well-formed too.
    expect(svg).toContain('data-key="R&amp;D &lt;1&gt; &quot;X&quot; 1 10:40"');
  });

  it("shortens text that would not fit in the block", () => {
    const long = meeting({ instructor: "MUSTAFA KEMAL ABDURRAHMAN ÇOKUZUNSOYADLIOĞLU" });
    const { svg } = build([long], { days: [1, 2, 3, 4, 5, 6, 7] });
    expect(svg).toMatch(/Mustafa Kemal[^<]*…</);
    expect(svg).not.toContain("Çokuzunsoyadlıoğlu");
  });

  it("strikes through free days", () => {
    const { svg } = build(meetings, { freeDays: [2] });
    expect(svg).toMatch(/text-decoration="line-through"[^>]*>Salı</);
  });
});

describe("mixOklab", () => {
  it("returns an endpoint at 0 and 1 and stays put when both colours match", () => {
    expect(mixOklab("#ffe14d", "#fbfbf8", 1)).toBe("#ffe14d");
    expect(mixOklab("#ffe14d", "#fbfbf8", 0)).toBe("#fbfbf8");
    expect(mixOklab("#8ed4ff", "#8ed4ff", 0.62)).toBe("#8ed4ff");
  });

  it("lands between the two colours", () => {
    const mid = mixOklab("#000000", "#ffffff", 0.5);
    const v = parseInt(mid.slice(1, 3), 16);
    expect(v).toBeGreaterThan(0x40);
    expect(v).toBeLessThan(0xc0);
  });
});

describe("imageFileName", () => {
  it("names the file after the term", () => {
    expect(imageFileName("2026-2027-guz")).toBe("program-2026-2027-guz.png");
  });
});

describe("koyu tema", () => {
  it("verilen palet zemini ve yazıyı belirler", () => {
    const { svg } = build([meeting({})], { palette: DARK_PALETTE });
    expect(svg).toContain(`fill="${DARK_PALETTE.paper}"`);
    expect(svg).toContain(`fill="${DARK_PALETTE.ink}"`);
    expect(svg).not.toContain(LIGHT_PALETTE.paper);
  });

  it("palet verilmezse açık tema kullanılır", () => {
    const { svg } = build([meeting({})]);
    expect(svg).toContain(`fill="${LIGHT_PALETTE.paper}"`);
  });
});

// Seçili haftalık programı paylaşılabilir bir görsele (SVG metni) çevirir. Saf fonksiyon: DOM yok.
// Görünüm sitedeki "defter çizelgesinde fosforlu kalem" düzenidir; sayfa hangi temadaysa görsel de o temada
// çıkar (bkz. DARK_PALETTE). PNG'ye çevirme tarayıcıda yapılır (bkz. download-image.ts).
import { assignLanes, timeRange, type PlacedMeeting } from "@/components/planner/placed";
import { DAY_NAMES } from "../days";
import { parseTime, type Day, type ScheduleSummary } from "../engine";
import { formatGap, personName } from "../format";

export interface ImagePalette {
  paper: string;
  /** Boş gün sütununun zemini. */
  paperMuted: string;
  ink: string;
  inkMuted: string;
  rule: string;
  ruleStrong: string;
  highlighters: readonly string[];
  /** Blok zemininde kalem renginin kağıda oranı (0–1), CSS'teki `--hl-mix`. */
  mix: number;
}

export const LIGHT_PALETTE: ImagePalette = {
  paper: "#fbfbf8",
  paperMuted: "#f1f3f0",
  ink: "#1d2433",
  inkMuted: "#566074",
  rule: "#dce3ec",
  ruleStrong: "#b9c4d3",
  highlighters: ["#ffe14d", "#8ee59b", "#ff9fcb", "#8ed4ff", "#ffb86b", "#c9b3ff"],
  mix: 0.62,
};

/** Koyu tema: renkler globals.css'teki `[data-theme="dark"]` değerleriyle aynı. */
export const DARK_PALETTE: ImagePalette = {
  paper: "#0c0c0d",
  paperMuted: "#161617",
  ink: "#ededed",
  inkMuted: "#a3a3a8",
  rule: "#262628",
  ruleStrong: "#3b3b3f",
  highlighters: LIGHT_PALETTE.highlighters,
  mix: 0.34,
};

/** CSS pikseli; PNG bunun iki katı çözünürlükte çizilir. */
export const IMAGE_LAYOUT = {
  width: 1200,
  pad: 48,
  /** Saat etiketlerinin sütunu. */
  hourCol: 64,
  /** Gün adları satırının üst kenarı. */
  gridTop: 208,
  dayRow: 40,
  hourHeight: 68,
  /** Tablonun altından görselin altına kadar. */
  footer: 72,
  blockGap: 3,
  barWidth: 4,
} as const;

export const IMAGE_FONT = "Onest, system-ui, sans-serif";

export interface ScheduleImageInput {
  meetings: readonly PlacedMeeting[];
  /** Sütunlar (bkz. `visibleDays`). */
  days: readonly Day[];
  /** Üstü çizili gösterilen günler. */
  freeDays?: readonly Day[];
  termLabel: string;
  /** "3. program" */
  title: string;
  summary: ScheduleSummary;
  palette?: ImagePalette;
}

export interface ScheduleImage {
  svg: string;
  width: number;
  height: number;
}

export function imageFileName(termId: string): string {
  return `program-${termId}.png`;
}

const FOOTER_TEXT = "Özyeğin Üniversitesi için hazırlandı, resmi değildir";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Sayıları kısa ve kararlı yazar (en çok iki ondalık). */
const n = (v: number) => String(Math.round(v * 100) / 100);

type Attrs = Record<string, string | number | undefined>;

function attrs(a: Attrs): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? n(v) : escapeXml(v!)}"`)
    .join("");
}

const rect = (a: Attrs) => `<rect${attrs(a)}/>`;
const line = (a: Attrs) => `<line${attrs(a)}/>`;
const text = (content: string, a: Attrs) => `<text${attrs(a)}>${escapeXml(content)}</text>`;

/**
 * Yazı tipi ölçülemediği için genişlik tahminidir (ortalama harf ≈ 0,56 em, kalın ≈ 0,6 em).
 * Sığmayan metin "…" ile kısaltılır; blok ayrıca kırpıldığı için tahmin kaçsa da taşmaz.
 */
function estimateWidth(content: string, fontSize: number, bold = false): number {
  return content.length * fontSize * (bold ? 0.6 : 0.56);
}

function fit(content: string, maxWidth: number, fontSize: number, bold = false): string {
  if (estimateWidth(content, fontSize, bold) <= maxWidth) return content;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * (bold ? 0.6 : 0.56))) - 1);
  return content.slice(0, chars).trimEnd() + "…";
}

// ---------- renk: CSS color-mix(in oklab, a t, b) ----------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => toGamma(Math.min(1, Math.max(0, c)))) as [number, number, number];
}

/** `a` rengini `t` (0–1) oranında `b` ile oklab uzayında karıştırır; "#rrggbb" döner. */
export function mixOklab(a: string, b: string, t: number): string {
  const x = rgbToOklab(hexToRgb(a));
  const y = rgbToOklab(hexToRgb(b));
  const rgb = oklabToRgb([0, 1, 2].map((i) => x[i] * t + y[i] * (1 - t)) as [number, number, number]);
  return "#" + rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, "0")).join("");
}

// ---------- çizim ----------

export function buildScheduleSvg(input: ScheduleImageInput): ScheduleImage {
  const p = input.palette ?? LIGHT_PALETTE;
  const L = IMAGE_LAYOUT;
  const freeDays = new Set(input.freeDays ?? []);
  const range = timeRange(input.meetings);
  const startHour = Math.floor(range.start / 60);
  const endHour = Math.ceil(range.end / 60);
  const hours = endHour - startHour;

  const gridLeft = L.pad + L.hourCol;
  const gridRight = L.width - L.pad;
  const colW = (gridRight - gridLeft) / Math.max(1, input.days.length);
  const bodyTop = L.gridTop + L.dayRow;
  const bodyBottom = bodyTop + hours * L.hourHeight;
  const height = bodyBottom + L.footer;
  const yAt = (minute: number) => bodyTop + ((minute - startHour * 60) * L.hourHeight) / 60;

  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width: L.width, height, viewBox: `0 0 ${L.width} ${height}` })} font-family="${IMAGE_FONT}">`,
  );
  out.push(rect({ x: 0, y: 0, width: L.width, height, fill: p.paper }));

  // Başlık: kelime işareti, dönem, program adı ve özet.
  const markSize = 30;
  const markBase = 68;
  const markW = estimateWidth("OzuHelper", markSize, true) + 8;
  out.push(
    rect({ x: L.pad - 4, y: markBase - markSize * 0.36, width: markW, height: markSize * 0.44, fill: p.highlighters[0] }),
  );
  out.push(text("OzuHelper", { x: L.pad, y: markBase, "font-size": markSize, "font-weight": 800, "letter-spacing": -0.6, fill: p.ink }));
  out.push(text(input.termLabel, { x: gridRight, y: markBase, "font-size": 18, "text-anchor": "end", fill: p.inkMuted }));
  out.push(text(input.title, { x: L.pad, y: 130, "font-size": 36, "font-weight": 800, "letter-spacing": -0.7, fill: p.ink }));

  const facts: [string, string][] = [
    ["Kampüste", `${input.summary.days} gün`],
    ["Dersler arası", formatGap(input.summary.gapMinutes)],
  ];
  if (input.summary.earliestStart) facts.push(["İlk ders", input.summary.earliestStart]);
  if (input.summary.latestEnd) facts.push(["Son ders biter", input.summary.latestEnd]);
  let factX = L.pad;
  for (const [label, value] of facts) {
    out.push(text(label, { x: factX, y: 164, "font-size": 13, fill: p.inkMuted }));
    out.push(text(value, { x: factX, y: 190, "font-size": 21, "font-weight": 700, fill: p.ink }));
    factX += Math.max(estimateWidth(label, 13), estimateWidth(value, 21, true)) + 40;
  }

  // Tablo: boş gün zeminleri, saat çizgileri, sütun çizgileri, gün adları.
  input.days.forEach((d, i) => {
    if (freeDays.has(d)) {
      out.push(rect({ x: gridLeft + i * colW, y: bodyTop, width: colW, height: bodyBottom - bodyTop, fill: p.paperMuted }));
    }
  });
  for (let h = 0; h <= hours; h++) {
    const y = bodyTop + h * L.hourHeight;
    out.push(line({ x1: gridLeft, y1: y, x2: gridRight, y2: y, stroke: h === 0 ? p.ruleStrong : p.rule, "stroke-width": 1 }));
    if (h < hours) {
      const label = `${String(startHour + h).padStart(2, "0")}:00`;
      out.push(
        text(label, {
          x: gridLeft - 8,
          y: h === 0 ? y + 15 : y + 4.5,
          "font-size": 12.5,
          "text-anchor": "end",
          fill: p.inkMuted,
        }),
      );
    }
  }
  for (let i = 0; i <= input.days.length; i++) {
    const x = gridLeft + i * colW;
    out.push(line({ x1: x, y1: L.gridTop, x2: x, y2: bodyBottom, stroke: p.rule, "stroke-width": 1 }));
  }
  input.days.forEach((d, i) => {
    const free = freeDays.has(d);
    out.push(
      text(DAY_NAMES[d], {
        x: gridLeft + i * colW + colW / 2,
        y: L.gridTop + 26,
        "font-size": 15,
        "font-weight": 700,
        "text-anchor": "middle",
        fill: free ? p.inkMuted : p.ink,
        "text-decoration": free ? "line-through" : undefined,
      }),
    );
  });

  // Ders blokları.
  const lanes = assignLanes(input.meetings);
  input.meetings.forEach((m, i) => {
    const col = input.days.indexOf(m.day);
    if (col === -1) return;
    const { lane, lanes: count } = lanes[i];
    const inner = colW - 2 * L.blockGap;
    const x = gridLeft + col * colW + L.blockGap + (inner * lane) / count;
    const w = inner / count - ((count - 1) * 2) / count;
    const s = parseTime(m.start);
    const y = yAt(s);
    const h = ((parseTime(m.end) - s) * L.hourHeight) / 60;
    const color = p.highlighters[m.color % p.highlighters.length];
    const id = `b${i}`;
    const textX = x + L.barWidth + 8;
    const textW = w - L.barWidth - 16;

    out.push(`<clipPath id="${id}">${rect({ x, y, width: w, height: h, rx: 6 })}</clipPath>`);
    out.push(`<g clip-path="url(#${id})">`);
    out.push(
      rect({
        class: "block",
        "data-key": `${m.courseCode} ${m.sectionId} ${m.day} ${m.start}`,
        x,
        y,
        width: w,
        height: h,
        fill: mixOklab(color, p.paper, p.mix),
      }),
    );
    out.push(rect({ x, y, width: L.barWidth, height: h, fill: color }));

    const codeLine = fit(`${m.courseCode} ${m.sectionId}`.trim(), textW, 14, true);
    const code = codeLine.startsWith(m.courseCode) ? m.courseCode : codeLine;
    const section = codeLine.slice(code.length);
    out.push(
      `<text${attrs({ x: textX, y: y + 19, "font-size": 14, "font-weight": 700, fill: p.ink })}>${escapeXml(code)}` +
        (section ? `<tspan font-weight="500" fill-opacity="0.75">${escapeXml(section)}</tspan>` : "") +
        `</text>`,
    );
    if (h >= 40) {
      out.push(text(fit(`${m.start}–${m.end}${m.room ? `  ${m.room}` : ""}`, textW, 12), { x: textX, y: y + 35, "font-size": 12, fill: p.ink, "fill-opacity": 0.85 }));
    }
    if (m.instructor && h >= 55) {
      out.push(
        text(fit(personName(m.instructor), textW, 12), { x: textX, y: y + 51, "font-size": 12, fill: p.ink, "fill-opacity": 0.85 }),
      );
    }
    out.push(`</g>`);
  });

  out.push(text(FOOTER_TEXT, { x: L.pad, y: bodyBottom + 44, "font-size": 13, fill: p.inkMuted }));
  out.push(`</svg>`);
  return { svg: out.join(""), width: L.width, height };
}

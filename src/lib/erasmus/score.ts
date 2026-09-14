// Erasmus başvuru koşulları, Erasmus skoru ve hibe tahmini. Kurallar data/ozyegin/erasmus.json'dan
// (Özyeğin "Giden Öğrenci" sayfası): skor = GNO %50 + ELE %50 + Ulusal Ajans ek puanları.
// GNO'nun 100'lüğe çevrilmesi ilanda yok: data.score.gpaTo100 varsayımı kullanılır.
import type { ErasmusData } from "./types";

export type EligibilityId = "gpa" | "ele" | "ectsApplication" | "ectsNomination";
export type EligibilityStatus = "ok" | "fail" | "unknown";

export interface EligibilityItem {
  id: EligibilityId;
  status: EligibilityStatus;
  text: string;
}

export interface ErasmusScore {
  gpaPart: number;
  elePart: number;
  bonus: number;
  total: number;
}

export type EleNeeded = { kind: "needed"; ele: number } | { kind: "impossible" } | { kind: "guaranteed" };

export interface GrantEstimate {
  monthly: number;
  fundedMonths: number;
  travel: number | null;
  total: number;
}

const fmtGpa = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Kriter adedi: perCount ise negatif olmayan tam sayı, değilse 0/1. */
function criterionCount(value: unknown, perCount: boolean): number {
  if (!isNum(value) || value <= 0) return 0;
  return perCount ? Math.floor(value) : 1;
}

/** Seçilen ek/eksi puanların toplamı. Bilinmeyen id sayılmaz. */
export function criteriaBonus(data: ErasmusData, criteria: Record<string, number>): number {
  let sum = 0;
  for (const c of data.criteria) sum += c.points * criterionCount(criteria[c.id], c.perCount);
  return sum;
}

/** Başvuru koşulları tek tek: girilmeyen değer "unknown". */
export function erasmusEligibility(
  data: ErasmusData,
  input: { gpa: number | null; ele: number | null; ects: number | null },
): EligibilityItem[] {
  const { minGpa, minEle, minEctsAtApplication, minEctsAtNomination } = data.eligibility;
  const gpa = isNum(input.gpa) ? input.gpa : null;
  const ele = isNum(input.ele) ? input.ele : null;
  const ects = isNum(input.ects) ? input.ects : null;
  const out: EligibilityItem[] = [];

  if (gpa === null) {
    out.push({ id: "gpa", status: "unknown", text: `Genel not ortalaması girilmedi; lisans için en az ${fmtGpa(minGpa)} gerekiyor.` });
  } else if (gpa >= minGpa) {
    out.push({ id: "gpa", status: "ok", text: `Ortalaman ${fmtGpa(gpa)}; en az ${fmtGpa(minGpa)} şartı sağlanıyor.` });
  } else {
    out.push({ id: "gpa", status: "fail", text: `Ortalaman ${fmtGpa(gpa)}; en az ${fmtGpa(minGpa)} gerekiyor.` });
  }

  if (ele === null) {
    out.push({ id: "ele", status: "unknown", text: `ELE puanı girilmedi; en az ${fmtNum(minEle)}/100 gerekiyor.` });
  } else if (ele >= minEle) {
    out.push({ id: "ele", status: "ok", text: `ELE puanın ${fmtNum(ele)}; en az ${fmtNum(minEle)} şartı sağlanıyor.` });
  } else {
    out.push({ id: "ele", status: "fail", text: `ELE puanın ${fmtNum(ele)}; en az ${fmtNum(minEle)} gerekiyor.` });
  }

  if (ects === null) {
    out.push({ id: "ectsApplication", status: "unknown", text: `Tamamlanan AKTS girilmedi; başvuruda en az ${minEctsAtApplication} AKTS gerekiyor.` });
    out.push({ id: "ectsNomination", status: "unknown", text: `Aday gösterilirken en az ${minEctsAtNomination} AKTS tamamlanmış olmalı.` });
  } else {
    out.push(
      ects >= minEctsAtApplication
        ? { id: "ectsApplication", status: "ok", text: `${fmtNum(ects)} AKTS tamamlanmış; başvuru için en az ${minEctsAtApplication} AKTS yetiyor.` }
        : { id: "ectsApplication", status: "fail", text: `${fmtNum(ects)} AKTS tamamlanmış; başvuru için en az ${minEctsAtApplication} AKTS gerekiyor (${fmtNum(minEctsAtApplication - ects)} AKTS eksik).` },
    );
    // Aday gösterme başvurudan sonra: eksik varsa o güne kadar tamamlanması gerekir.
    out.push(
      ects >= minEctsAtNomination
        ? { id: "ectsNomination", status: "ok", text: `${fmtNum(ects)} AKTS tamamlanmış; aday gösterilirken istenen ${minEctsAtNomination} AKTS sağlanıyor.` }
        : { id: "ectsNomination", status: "fail", text: `Aday gösterilene kadar en az ${minEctsAtNomination} AKTS tamamlanmalı; şu an ${fmtNum(ects)} AKTS (${fmtNum(minEctsAtNomination - ects)} AKTS eksik).` },
    );
  }
  return out;
}

/** Erasmus skoru. Parçalar ve toplam 2 ondalığa yuvarlanır. */
export function erasmusScore(
  data: ErasmusData,
  input: { gpa: number; ele: number; criteria: Record<string, number> },
): ErasmusScore {
  const { gpaWeight, eleWeight, gpaTo100 } = data.score;
  const gpaPart = input.gpa * gpaTo100.factor * gpaWeight;
  const elePart = input.ele * eleWeight;
  const bonus = criteriaBonus(data, input.criteria);
  return { gpaPart: round2(gpaPart), elePart: round2(elePart), bonus: round2(bonus), total: round2(gpaPart + elePart + bonus) };
}

/** Hedef skora ulaşmak için gereken en düşük ELE puanı (tam sayıya yukarı yuvarlanır, 0..100). */
export function eleNeededFor(
  data: ErasmusData,
  input: { gpa: number; target: number; criteria: Record<string, number> },
): EleNeeded {
  const { gpaWeight, eleWeight, gpaTo100 } = data.score;
  const rest = input.target - input.gpa * gpaTo100.factor * gpaWeight - criteriaBonus(data, input.criteria);
  // 60,0000001 gibi kayan nokta artıkları bir üst tam sayıya taşmasın.
  const ele = Math.ceil(Math.round((rest / eleWeight) * 1e6) / 1e6);
  if (ele > 100) return { kind: "impossible" };
  if (ele <= 0) return { kind: "guaranteed" };
  return { kind: "needed", ele };
}

/** Km'nin düştüğü seyahat bandı; 10 km altı ya da bilinmiyorsa null. Ondalıklı km bir sonraki bandın altına kadar sayılır. */
export function travelBand(data: ErasmusData, km: number | null) {
  if (!isNum(km)) return null;
  return data.grant.travel.find((b) => km >= b.minKm && (b.maxKm === null || km < b.maxKm + 1)) ?? null;
}

/** Hibe tahmini: aylık (dezavantajlı ek dahil) × hibeli ay + seyahat. Grup bulunmazsa aylık 0. */
export function grantEstimate(
  data: ErasmusData,
  input: { group: string; months: number; km: number | null; green: boolean; disadvantaged: boolean },
): GrantEstimate {
  const base = data.grant.monthly.find((m) => m.group === input.group)?.euro ?? 0;
  const monthly = base + (input.disadvantaged ? data.grant.disadvantagedMonthly : 0);
  const months = isNum(input.months) && input.months > 0 ? input.months : 0;
  const fundedMonths = Math.min(months, data.grant.maxFundedMonths);
  const band = travelBand(data, input.km);
  const travel = band ? (input.green ? band.green : band.standard) : null;
  return { monthly, fundedMonths, travel, total: round2(monthly * fundedMonths + (travel ?? 0)) };
}

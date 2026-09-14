// Yol haritası bileşenlerinin ortak etiketleri ve renkleri.
import type { PlanSeason, RoadmapProgramKind } from "@/lib/roadmap/types";

/** Program başına fosforlu kalem: anadal sarı, çift anadal mavi, yandal yeşil. */
export const KIND_HL: Record<RoadmapProgramKind, number> = { anadal: 0, cap: 3, yandal: 1 };

export const KIND_LABEL: Record<RoadmapProgramKind, string> = {
  anadal: "Anadal",
  cap: "Çift anadal",
  yandal: "Yandal",
};

const SEASON_NAME: Record<PlanSeason, string> = { guz: "Güz", bahar: "Bahar", yaz: "Yaz", other: "Diğer" };

export function slotLabel(slot: { year: number; season: PlanSeason } | null): string {
  if (!slot) return "Dersler";
  const year = slot.year === 0 ? "Hazırlık" : `${slot.year}. yıl`;
  return `${year} ${SEASON_NAME[slot.season]}`;
}

export function creditsText(credits: number | null): string {
  return credits === null ? "AKTS ?" : `${credits} AKTS`;
}

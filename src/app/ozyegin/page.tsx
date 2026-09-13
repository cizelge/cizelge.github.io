import type { Metadata } from "next";
import { loadTerm } from "@/lib/data";
import { plannerMetadata, PlannerPage } from "./PlannerPage";

// Varsayılan dönem: yayındaki dönemlerin en sonuncusu.
export async function generateMetadata(): Promise<Metadata> {
  return plannerMetadata(loadTerm("ozyegin"));
}

export default function OzyeginPlanner() {
  return <PlannerPage term={loadTerm("ozyegin")} />;
}

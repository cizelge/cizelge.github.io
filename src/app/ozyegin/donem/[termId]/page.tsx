import type { Metadata } from "next";
import { loadTerm, loadTerms } from "@/lib/data";
import { plannerMetadata, PlannerPage } from "../../PlannerPage";

export const dynamicParams = false;

// Varsayılan dönem de üretilir (seçiciden gelen eski linkler için); kanonik adresi /ozyegin.
export function generateStaticParams() {
  return loadTerms("ozyegin").map((t) => ({ termId: t.termId }));
}

export async function generateMetadata(props: PageProps<"/ozyegin/donem/[termId]">): Promise<Metadata> {
  const { termId } = await props.params;
  return plannerMetadata(loadTerm("ozyegin", termId));
}

export default async function TermPlanner(props: PageProps<"/ozyegin/donem/[termId]">) {
  const { termId } = await props.params;
  return <PlannerPage term={loadTerm("ozyegin", termId)} />;
}

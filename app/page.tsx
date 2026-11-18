import { Planner } from "@/app/planner";
import { getChecklistTemplate, getMockCatalogSummary } from "@/lib/catalog";

export default function Home() {
  const checklist = getChecklistTemplate();
  const summary = getMockCatalogSummary();

  return <Planner items={checklist.items} tiers={checklist.tiers} summary={summary} />;
}

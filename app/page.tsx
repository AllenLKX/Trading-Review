"use client";

import { useState } from "react";
import { BottomTabBar, type AppTab } from "@/components/BottomTabBar";
import { TopAppBar } from "@/components/TopAppBar";
import { HistoryPage } from "@/features/audits/HistoryPage";
import { RecordPage } from "@/features/trades/RecordPage";
import { useTradePlans } from "@/lib/use-trade-plans";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("record");
  const {
    plans,
    selectedPlanId,
    highlightedPlanId,
    setSelectedPlanId,
    createPlan,
    updatePlan,
    deletePlan,
    addOperation,
    addReview,
    replacePlans,
    clearPlans,
    restoreSamplePlans
  } = useTradePlans();

  return (
    <div className="min-h-dvh bg-background text-muted-strong">
      <TopAppBar />
      {activeTab === "record" ? (
        <RecordPage
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectPlan={setSelectedPlanId}
          onCreatePlan={createPlan}
          onAddOperation={(operation) => {
            addOperation(operation);
            setActiveTab("history");
          }}
          onAddReview={(review) => {
            addReview(review);
            setActiveTab("history");
          }}
        />
      ) : (
        <HistoryPage
          plans={plans}
          highlightedPlanId={highlightedPlanId}
          onUpdatePlan={updatePlan}
          onDeletePlan={deletePlan}
          onAddOperation={addOperation}
          onAddReview={addReview}
          onReplacePlans={replacePlans}
          onClearPlans={clearPlans}
          onRestoreSamples={restoreSamplePlans}
        />
      )}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

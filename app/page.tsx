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
    dataStatus,
    dataMessage,
    isMutating,
    reload,
    setSelectedPlanId,
    createPlan,
    updatePlan,
    deletePlan,
    addOperation,
    addReview
  } = useTradePlans();

  return (
    <div className="min-h-dvh bg-background text-muted-strong">
      <TopAppBar />
      {activeTab === "record" ? (
        <RecordPage
          plans={plans}
          selectedPlanId={selectedPlanId}
          dataStatus={dataStatus}
          dataMessage={dataMessage}
          onSelectPlan={setSelectedPlanId}
          onCreatePlan={createPlan}
          onAddOperation={async (operation) => {
            await addOperation(operation);
            setActiveTab("history");
          }}
          onAddReview={async (review) => {
            await addReview(review);
            setActiveTab("history");
          }}
        />
      ) : (
        <HistoryPage
          plans={plans}
          highlightedPlanId={highlightedPlanId}
          dataStatus={dataStatus}
          connectionMessage={dataMessage}
          isMutating={isMutating}
          onReload={reload}
          onUpdatePlan={updatePlan}
          onDeletePlan={deletePlan}
          onAddOperation={addOperation}
          onAddReview={addReview}
        />
      )}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

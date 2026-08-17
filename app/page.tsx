"use client";

import { useCallback, useEffect, useState } from "react";
import { BottomTabBar, type AppTab } from "@/components/BottomTabBar";
import { OnboardingExperience } from "@/components/OnboardingExperience";
import { TopAppBar } from "@/components/TopAppBar";
import { HistoryPage } from "@/features/audits/HistoryPage";
import { RecordPage } from "@/features/trades/RecordPage";
import type { OnboardingStep } from "@/lib/onboarding";
import { useTradePlans } from "@/lib/use-trade-plans";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("record");
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);
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
    addReview,
    archiveScreenshotBatch
  } = useTradePlans();

  useEffect(() => {
    let active = true;
    void fetch("/api/onboarding", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/login");
          return null;
        }
        if (!response.ok) throw new Error("Onboarding status is unavailable.");
        return (await response.json()) as { step?: OnboardingStep };
      })
      .then((result) => {
        if (active && result) setOnboardingStep(result.step ?? 0);
      })
      .catch(() => {
        if (active) setOnboardingStep(4);
      });
    return () => {
      active = false;
    };
  }, []);

  const advanceOnboarding = useCallback(async (step: OnboardingStep) => {
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step })
    });
    if (!response.ok) throw new Error("Unable to save onboarding progress.");
    const result = (await response.json()) as { step?: OnboardingStep };
    setOnboardingStep(result.step ?? step);
  }, []);

  const persistOnboardingCompletion = useCallback(async () => {
    const response = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ step: 4 })
    });
    if (!response.ok) throw new Error("Unable to complete onboarding.");
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboardingStep(4);
    void persistOnboardingCompletion().catch(() => undefined);
  }, [persistOnboardingCompletion]);

  return (
    <div className="min-h-dvh bg-background text-muted-strong">
      <TopAppBar />
      {activeTab === "record" ? (
        <RecordPage
          plans={plans}
          selectedPlanId={selectedPlanId}
          dataStatus={dataStatus}
          dataMessage={dataMessage}
          deferEmptyPlanForm={onboardingStep !== 4}
          highlightNewPlan={onboardingStep === 3}
          onNewPlanTutorialComplete={finishOnboarding}
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
          onArchiveScreenshotBatch={archiveScreenshotBatch}
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
      <OnboardingExperience
        step={onboardingStep}
        onAdvance={advanceOnboarding}
        onPersistCompletion={persistOnboardingCompletion}
        onDismissSpotlight={finishOnboarding}
      />
    </div>
  );
}

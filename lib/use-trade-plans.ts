"use client";

import { useEffect, useMemo, useState } from "react";
import { samplePlans } from "@/lib/sample-data";
import { localTradeRepository } from "@/lib/trade-repository";
import type { PlanReview, TradeOperation, TradePlan } from "@/lib/types";

type TradePlanStore = {
  plans: TradePlan[];
  selectedPlanId: string | null;
  highlightedPlanId: string | null;
  setSelectedPlanId: (planId: string) => void;
  createPlan: (plan: TradePlan) => void;
  updatePlan: (plan: TradePlan) => void;
  deletePlan: (planId: string) => void;
  addOperation: (operation: TradeOperation) => void;
  addReview: (review: PlanReview) => void;
  replacePlans: (plans: TradePlan[]) => void;
  clearPlans: () => void;
  restoreSamplePlans: () => void;
};

export function useTradePlans(): TradePlanStore {
  const [plans, setPlans] = useState<TradePlan[]>(samplePlans);
  const [selectedPlanId, setSelectedPlanIdState] = useState<string | null>(samplePlans[0]?.id ?? null);
  const [highlightedPlanId, setHighlightedPlanId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const loadedPlans = localTradeRepository.load();
      setPlans(loadedPlans);
      setSelectedPlanIdState(loadedPlans[0]?.id ?? null);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    localTradeRepository.persist(plans);
  }, [isHydrated, plans]);

  return useMemo(
    () => ({
      plans,
      selectedPlanId,
      highlightedPlanId,
      setSelectedPlanId: (planId: string) => setSelectedPlanIdState(planId),
      createPlan: (plan: TradePlan) => {
        setPlans((current) => [plan, ...current]);
        setSelectedPlanIdState(plan.id);
        setHighlightedPlanId(plan.id);
      },
      updatePlan: (plan: TradePlan) => {
        setPlans((current) => current.map((item) => (item.id === plan.id ? plan : item)));
        setHighlightedPlanId(plan.id);
      },
      deletePlan: (planId: string) => {
        setPlans((current) => {
          const nextPlans = current.filter((item) => item.id !== planId);
          setSelectedPlanIdState((currentPlanId) => (currentPlanId === planId ? nextPlans[0]?.id ?? null : currentPlanId));
          return nextPlans;
        });
        setHighlightedPlanId((current) => (current === planId ? null : current));
      },
      addOperation: (operation: TradeOperation) => {
        setPlans((current) =>
          current.map((plan) =>
            plan.id === operation.planId
              ? { ...plan, operations: [operation, ...plan.operations], updatedAt: operation.updatedAt }
              : plan
          )
        );
        setSelectedPlanIdState(operation.planId);
        setHighlightedPlanId(operation.planId);
      },
      addReview: (review: PlanReview) => {
        setPlans((current) =>
          current.map((plan) =>
            plan.id === review.planId ? { ...plan, reviews: [review, ...plan.reviews], updatedAt: review.updatedAt } : plan
          )
        );
        setSelectedPlanIdState(review.planId);
        setHighlightedPlanId(review.planId);
      },
      replacePlans: (nextPlans: TradePlan[]) => {
        setPlans(nextPlans);
        setSelectedPlanIdState(nextPlans[0]?.id ?? null);
        setHighlightedPlanId(nextPlans[0]?.id ?? null);
      },
      clearPlans: () => {
        setPlans([]);
        setSelectedPlanIdState(null);
        setHighlightedPlanId(null);
      },
      restoreSamplePlans: () => {
        setPlans(samplePlans);
        setSelectedPlanIdState(samplePlans[0]?.id ?? null);
        setHighlightedPlanId(samplePlans[0]?.id ?? null);
      }
    }),
    [highlightedPlanId, plans, selectedPlanId]
  );
}

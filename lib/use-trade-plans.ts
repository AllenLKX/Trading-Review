"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { samplePlans } from "@/lib/sample-data";
import { loadWorkspaceMode, persistWorkspaceMode, type WorkspaceMode } from "@/lib/sync-state";
import { cloudTradeRepository, localTradeRepository } from "@/lib/trade-repository";
import type { PlanReview, TradeOperation, TradePlan } from "@/lib/types";

export type CloudWriteStatus = {
  state: "idle" | "saving" | "saved" | "error";
  message?: string;
  revision: number;
};

type FailedCloudWrite = {
  label: string;
  action: () => Promise<void>;
};

type TradePlanStore = {
  plans: TradePlan[];
  selectedPlanId: string | null;
  highlightedPlanId: string | null;
  workspaceMode: WorkspaceMode;
  cloudWriteStatus: CloudWriteStatus;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  retryCloudWrite: () => void;
  queueCloudWrite: (label: string, action: () => Promise<void>) => void;
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
  const [workspaceMode, setWorkspaceModeState] = useState<WorkspaceMode>("local");
  const [cloudWriteStatus, setCloudWriteStatus] = useState<CloudWriteStatus>({ state: "idle", revision: 0 });
  const [isHydrated, setIsHydrated] = useState(false);
  const writeQueueRef = useRef<FailedCloudWrite[]>([]);
  const isProcessingQueueRef = useRef(false);
  const lastFailedWriteRef = useRef<FailedCloudWrite | null>(null);

  useEffect(() => {
    try {
      const loadedPlans = localTradeRepository.load();
      setPlans(loadedPlans);
      setSelectedPlanIdState(loadedPlans[0]?.id ?? null);
      setWorkspaceModeState(loadWorkspaceMode());
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

  useEffect(() => {
    if (isHydrated) {
      persistWorkspaceMode(workspaceMode);
    }
  }, [isHydrated, workspaceMode]);

  const processCloudWriteQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || lastFailedWriteRef.current || writeQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;

    while (writeQueueRef.current.length > 0) {
      const currentWrite = writeQueueRef.current[0];
      setCloudWriteStatus((current) => ({ state: "saving", message: currentWrite.label, revision: current.revision }));

      try {
        await currentWrite.action();
        writeQueueRef.current.shift();
      } catch (error) {
        lastFailedWriteRef.current = currentWrite;
        setCloudWriteStatus((current) => ({
          state: "error",
          message: error instanceof Error ? error.message : `${currentWrite.label}失败。`,
          revision: current.revision
        }));
        isProcessingQueueRef.current = false;
        return;
      }
    }

    lastFailedWriteRef.current = null;
    isProcessingQueueRef.current = false;
    setCloudWriteStatus((current) => ({ state: "saved", message: "云端自动保存完成。", revision: current.revision + 1 }));
  }, []);

  const scheduleCloudWrite = useCallback(
    (label: string, action: () => Promise<void>) => {
      writeQueueRef.current.push({ label, action });
      void processCloudWriteQueue();
    },
    [processCloudWriteQueue]
  );

  const retryCloudWrite = useCallback(() => {
    const failedWrite = lastFailedWriteRef.current;
    if (failedWrite) {
      lastFailedWriteRef.current = null;
      void processCloudWriteQueue();
    }
  }, [processCloudWriteQueue]);

  const changeWorkspaceMode = useCallback((mode: WorkspaceMode) => {
    setWorkspaceModeState(mode);
    if (mode === "local") {
      writeQueueRef.current = [];
      lastFailedWriteRef.current = null;
      setCloudWriteStatus((current) => ({ state: "idle", revision: current.revision }));
    }
  }, []);

  return useMemo(
    () => ({
      plans,
      selectedPlanId,
      highlightedPlanId,
      workspaceMode,
      cloudWriteStatus,
      setWorkspaceMode: changeWorkspaceMode,
      retryCloudWrite,
      queueCloudWrite: scheduleCloudWrite,
      setSelectedPlanId: (planId: string) => setSelectedPlanIdState(planId),
      createPlan: (plan: TradePlan) => {
        setPlans((current) => [plan, ...current]);
        setSelectedPlanIdState(plan.id);
        setHighlightedPlanId(plan.id);
        if (workspaceMode === "cloud") {
          scheduleCloudWrite("创建云端计划", async () => {
            await cloudTradeRepository.createPlan(plan);
          });
        }
      },
      updatePlan: (plan: TradePlan) => {
        const previousPlan = plans.find((item) => item.id === plan.id);
        setPlans((current) => current.map((item) => (item.id === plan.id ? plan : item)));
        setHighlightedPlanId(plan.id);
        if (workspaceMode === "cloud" && previousPlan) {
          scheduleCloudWrite("更新云端计划", () => syncPlanChanges(previousPlan, plan));
        }
      },
      deletePlan: (planId: string) => {
        setPlans((current) => {
          const nextPlans = current.filter((item) => item.id !== planId);
          setSelectedPlanIdState((currentPlanId) => (currentPlanId === planId ? nextPlans[0]?.id ?? null : currentPlanId));
          return nextPlans;
        });
        setHighlightedPlanId((current) => (current === planId ? null : current));
        if (workspaceMode === "cloud") {
          scheduleCloudWrite("删除云端计划", () => cloudTradeRepository.deletePlan(planId));
        }
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
        if (workspaceMode === "cloud") {
          scheduleCloudWrite("保存云端操作", async () => {
            await cloudTradeRepository.createOperation(operation);
          });
        }
      },
      addReview: (review: PlanReview) => {
        setPlans((current) =>
          current.map((plan) =>
            plan.id === review.planId ? { ...plan, reviews: [review, ...plan.reviews], updatedAt: review.updatedAt } : plan
          )
        );
        setSelectedPlanIdState(review.planId);
        setHighlightedPlanId(review.planId);
        if (workspaceMode === "cloud") {
          scheduleCloudWrite("保存云端复盘", async () => {
            await cloudTradeRepository.createReview(review);
          });
        }
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
    [
      changeWorkspaceMode,
      cloudWriteStatus,
      highlightedPlanId,
      plans,
      retryCloudWrite,
      scheduleCloudWrite,
      selectedPlanId,
      workspaceMode
    ]
  );
}

async function syncPlanChanges(previousPlan: TradePlan, nextPlan: TradePlan) {
  await cloudTradeRepository.updatePlan(nextPlan);

  const previousOperations = new Map(previousPlan.operations.map((operation) => [operation.id, operation]));
  const nextOperations = new Map(nextPlan.operations.map((operation) => [operation.id, operation]));
  const previousReviews = new Map(previousPlan.reviews.map((review) => [review.id, review]));
  const nextReviews = new Map(nextPlan.reviews.map((review) => [review.id, review]));

  for (const operation of nextPlan.operations) {
    const previous = previousOperations.get(operation.id);
    if (!previous) {
      await cloudTradeRepository.createOperation(operation);
    } else if (!sameEntity(previous, operation)) {
      await cloudTradeRepository.updateOperation(operation);
    }
  }

  for (const operation of previousPlan.operations) {
    if (!nextOperations.has(operation.id)) {
      await cloudTradeRepository.deleteOperation(previousPlan.id, operation.id);
    }
  }

  for (const review of nextPlan.reviews) {
    const previous = previousReviews.get(review.id);
    if (!previous) {
      await cloudTradeRepository.createReview(review);
    } else if (!sameEntity(previous, review)) {
      await cloudTradeRepository.updateReview(review);
    }
  }

  for (const review of previousPlan.reviews) {
    if (!nextReviews.has(review.id)) {
      await cloudTradeRepository.deleteReview(previousPlan.id, review.id);
    }
  }
}

function sameEntity(left: TradeOperation | PlanReview, right: TradeOperation | PlanReview) {
  return JSON.stringify(left) === JSON.stringify(right);
}

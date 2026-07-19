"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { samplePlans } from "@/lib/sample-data";
import { cloudTradeRepository, localTradeRepository } from "@/lib/trade-repository";
import type { PlanReview, TradeOperation, TradePlan } from "@/lib/types";

export type DataStatus = "loading" | "ready" | "cached";

const SELECTED_PLAN_KEY = "rationaltrade.selectedPlanId.v1";

type TradePlanStore = {
  plans: TradePlan[];
  selectedPlanId: string | null;
  highlightedPlanId: string | null;
  dataStatus: DataStatus;
  dataMessage: string;
  isMutating: boolean;
  reload: () => Promise<void>;
  setSelectedPlanId: (planId: string) => void;
  createPlan: (plan: TradePlan) => Promise<void>;
  updatePlan: (plan: TradePlan) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;
  addOperation: (operation: TradeOperation) => Promise<void>;
  addReview: (review: PlanReview) => Promise<void>;
};

export function useTradePlans(): TradePlanStore {
  const [plans, setPlans] = useState<TradePlan[]>(samplePlans);
  const [selectedPlanId, setSelectedPlanIdState] = useState<string | null>(samplePlans[0]?.id ?? null);
  const [highlightedPlanId, setHighlightedPlanId] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus>("loading");
  const [dataMessage, setDataMessage] = useState("正在读取服务器数据…");
  const [isMutating, setIsMutating] = useState(false);
  const mutationLockRef = useRef(false);

  const applyServerPlans = useCallback((nextPlans: TradePlan[]) => {
    setPlans(nextPlans);
    localTradeRepository.persist(nextPlans);
    setSelectedPlanIdState((current) => {
      const persisted = window.localStorage.getItem(SELECTED_PLAN_KEY);
      const nextId = [persisted, current].find((id) => id && nextPlans.some((plan) => plan.id === id)) ?? nextPlans[0]?.id ?? null;
      persistSelectedPlanId(nextId);
      return nextId;
    });
    setDataStatus("ready");
    setDataMessage("数据已连接服务器");
  }, []);

  const reload = useCallback(async () => {
    try {
      const serverPlans = await cloudTradeRepository.load();
      applyServerPlans(serverPlans);
    } catch (error) {
      const cachedPlans = localTradeRepository.load();
      setPlans(cachedPlans);
      const persisted = window.localStorage.getItem(SELECTED_PLAN_KEY);
      const cachedSelection = persisted && cachedPlans.some((plan) => plan.id === persisted) ? persisted : cachedPlans[0]?.id ?? null;
      setSelectedPlanIdState(cachedSelection);
      setDataStatus("cached");
      setDataMessage(error instanceof Error ? `${error.message} 当前显示上次成功缓存。` : "服务器暂不可用，当前显示上次成功缓存。");
    }
  }, [applyServerPlans]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runMutation = useCallback(async <T,>(request: () => Promise<T>, apply: (result: T) => void) => {
    if (mutationLockRef.current) {
      throw new Error("另一项保存仍在进行，请稍候。");
    }

    mutationLockRef.current = true;
    setIsMutating(true);
    try {
      const result = await request();
      apply(result);
      setDataStatus("ready");
      setDataMessage("数据已连接服务器");
    } catch (error) {
      throw error instanceof Error ? error : new Error("服务器操作失败，请重试。");
    } finally {
      mutationLockRef.current = false;
      setIsMutating(false);
    }
  }, []);

  const persistCache = useCallback((updater: (current: TradePlan[]) => TradePlan[]) => {
    setPlans((current) => {
      const next = updater(current);
      localTradeRepository.persist(next);
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      plans,
      selectedPlanId,
      highlightedPlanId,
      dataStatus,
      dataMessage,
      isMutating,
      reload,
      setSelectedPlanId: (planId: string) => {
        setSelectedPlanIdState(planId);
        persistSelectedPlanId(planId);
      },
      createPlan: async (plan: TradePlan) => {
        await runMutation(
          () => cloudTradeRepository.createPlan(plan),
          (savedPlan) => {
            persistCache((current) => [savedPlan, ...current.filter((item) => item.id !== savedPlan.id)]);
            setSelectedPlanIdState(savedPlan.id);
            persistSelectedPlanId(savedPlan.id);
            setHighlightedPlanId(savedPlan.id);
          }
        );
      },
      updatePlan: async (plan: TradePlan) => {
        const previousPlan = plans.find((item) => item.id === plan.id);
        if (!previousPlan) {
          throw new Error("没有找到要修改的计划，请刷新后重试。");
        }

        await runMutation(
          async () => {
            await syncPlanChanges(previousPlan, plan);
            return plan;
          },
          (savedPlan) => {
            persistCache((current) => current.map((item) => (item.id === savedPlan.id ? savedPlan : item)));
            setHighlightedPlanId(savedPlan.id);
          }
        );
      },
      deletePlan: async (planId: string) => {
        await runMutation(
          () => cloudTradeRepository.deletePlan(planId),
          () => {
            persistCache((current) => {
              const nextPlans = current.filter((item) => item.id !== planId);
              setSelectedPlanIdState((currentId) => {
                const nextId = currentId === planId ? nextPlans[0]?.id ?? null : currentId;
                persistSelectedPlanId(nextId);
                return nextId;
              });
              return nextPlans;
            });
            setHighlightedPlanId((current) => (current === planId ? null : current));
          }
        );
      },
      addOperation: async (operation: TradeOperation) => {
        await runMutation(
          () => cloudTradeRepository.createOperation(operation),
          (savedOperation) => {
            persistCache((current) =>
              current.map((plan) =>
                plan.id === savedOperation.planId
                  ? {
                      ...plan,
                      operations: [savedOperation, ...plan.operations.filter((item) => item.id !== savedOperation.id)],
                      updatedAt: savedOperation.updatedAt
                    }
                  : plan
              )
            );
            setSelectedPlanIdState(savedOperation.planId);
            persistSelectedPlanId(savedOperation.planId);
            setHighlightedPlanId(savedOperation.planId);
          }
        );
      },
      addReview: async (review: PlanReview) => {
        await runMutation(
          () => cloudTradeRepository.createReview(review),
          (savedReview) => {
            persistCache((current) =>
              current.map((plan) =>
                plan.id === savedReview.planId
                  ? {
                      ...plan,
                      reviews: [savedReview, ...plan.reviews.filter((item) => item.id !== savedReview.id)],
                      updatedAt: savedReview.updatedAt
                    }
                  : plan
              )
            );
            setSelectedPlanIdState(savedReview.planId);
            persistSelectedPlanId(savedReview.planId);
            setHighlightedPlanId(savedReview.planId);
          }
        );
      }
    }),
    [dataMessage, dataStatus, highlightedPlanId, isMutating, persistCache, plans, reload, runMutation, selectedPlanId]
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
    if (!previous) await cloudTradeRepository.createOperation(operation);
    else if (!sameEntity(previous, operation)) await cloudTradeRepository.updateOperation(operation);
  }
  for (const review of nextPlan.reviews) {
    const previous = previousReviews.get(review.id);
    if (!previous) await cloudTradeRepository.createReview(review);
    else if (!sameEntity(previous, review)) await cloudTradeRepository.updateReview(review);
  }
  for (const operation of previousPlan.operations) {
    if (!nextOperations.has(operation.id)) await cloudTradeRepository.deleteOperation(previousPlan.id, operation.id);
  }
  for (const review of previousPlan.reviews) {
    if (!nextReviews.has(review.id)) await cloudTradeRepository.deleteReview(previousPlan.id, review.id);
  }
}

function sameEntity(left: TradeOperation | PlanReview, right: TradeOperation | PlanReview) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function persistSelectedPlanId(planId: string | null) {
  if (planId) window.localStorage.setItem(SELECTED_PLAN_KEY, planId);
  else window.localStorage.removeItem(SELECTED_PLAN_KEY);
}

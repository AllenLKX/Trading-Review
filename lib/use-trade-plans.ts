"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { samplePlans } from "@/lib/sample-data";
import { cloudTradeRepository, localTradeRepository } from "@/lib/trade-repository";
import type { PlanReview, ScreenshotArchiveBatch, TradeOperation, TradePlan } from "@/lib/types";

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
  archiveScreenshotBatch: (batch: ScreenshotArchiveBatch) => Promise<number>;
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
          () => cloudTradeRepository.replacePlanSnapshot(plan),
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
      },
      archiveScreenshotBatch: async (batch: ScreenshotArchiveBatch) => {
        let archivedOperationCount = 0;
        await runMutation(
          () => cloudTradeRepository.archiveScreenshotBatch(batch),
          (result) => {
            archivedOperationCount = result.archivedOperationCount;
            const affectedIds = new Set(result.plans.map((plan) => plan.id));
            persistCache((current) => [
              ...result.plans,
              ...current.filter((plan) => !affectedIds.has(plan.id))
            ]);
            const selectedId = result.plans[0]?.id;
            if (selectedId) {
              setSelectedPlanIdState(selectedId);
              persistSelectedPlanId(selectedId);
              setHighlightedPlanId(selectedId);
            }
          }
        );
        return archivedOperationCount;
      }
    }),
    [dataMessage, dataStatus, highlightedPlanId, isMutating, persistCache, plans, reload, runMutation, selectedPlanId]
  );
}

function persistSelectedPlanId(planId: string | null) {
  if (planId) window.localStorage.setItem(SELECTED_PLAN_KEY, planId);
  else window.localStorage.removeItem(SELECTED_PLAN_KEY);
}

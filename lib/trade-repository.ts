import { samplePlans, sampleTrades } from "@/lib/sample-data";
import { migrateTradesToPlans } from "@/lib/plan-migration";
import type { PlanReview, TradeDecision, TradeOperation, TradePlan } from "@/lib/types";

const TRADE_STORAGE_KEY = "rationaltrade.tradeDecisions.v1";
const PLAN_STORAGE_KEY = "rationaltrade.tradePlans.v2";

export type TradeRepository = {
  load: () => TradePlan[];
  persist: (plans: TradePlan[]) => void;
};

export const localTradeRepository: TradeRepository = {
  load: () => {
    try {
      const storedPlans = window.localStorage.getItem(PLAN_STORAGE_KEY);

      if (storedPlans) {
        const parsedPlans = JSON.parse(storedPlans) as unknown;
        if (Array.isArray(parsedPlans)) {
          return parsedPlans as TradePlan[];
        }
      }

      const storedTrades = window.localStorage.getItem(TRADE_STORAGE_KEY);

      if (!storedTrades) {
        return samplePlans;
      }

      const parsedTrades = JSON.parse(storedTrades) as unknown;

      if (!Array.isArray(parsedTrades)) {
        return samplePlans;
      }

      return migrateTradesToPlans(parsedTrades as TradeDecision[]);
    } catch {
      return samplePlans;
    }
  },
  persist: (plans) => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  }
};

type ApiMeta = {
  storage?: string;
  message?: string;
};

export const cloudTradeRepository = {
  async load(): Promise<TradePlan[]> {
    const response = await fetch("/api/plans");
    const result = (await response.json()) as { plans?: TradePlan[]; meta?: ApiMeta };
    assertCloudResponse(response, result.meta);
    return Array.isArray(result.plans) ? result.plans : [];
  },
  async createPlan(plan: TradePlan): Promise<TradePlan> {
    const response = await sendJson("/api/plans", "POST", toPlanPayload(plan));
    const result = (await response.json()) as { plan?: TradePlan; meta?: ApiMeta; errors?: string[] };
    return readMutationData(response, result.plan, result.meta, result.errors, "创建云端计划失败。");
  },
  async updatePlan(plan: TradePlan): Promise<TradePlan> {
    const response = await sendJson(`/api/plans/${encodeURIComponent(plan.id)}`, "PATCH", toPlanPayload(plan));
    const result = (await response.json()) as { plan?: TradePlan; meta?: ApiMeta; errors?: string[] };
    return readMutationData(response, result.plan, result.meta, result.errors, "更新云端计划失败。");
  },
  async deletePlan(planId: string): Promise<void> {
    await deleteCloudResource(`/api/plans/${encodeURIComponent(planId)}`, "删除云端计划失败。");
  },
  async createOperation(operation: TradeOperation): Promise<TradeOperation> {
    const response = await sendJson(
      `/api/plans/${encodeURIComponent(operation.planId)}/operations`,
      "POST",
      toOperationPayload(operation)
    );
    const result = (await response.json()) as { operation?: TradeOperation; meta?: ApiMeta; errors?: string[] };
    return readMutationData(response, result.operation, result.meta, result.errors, "创建云端操作失败。");
  },
  async updateOperation(operation: TradeOperation): Promise<TradeOperation> {
    const response = await sendJson(
      `/api/plans/${encodeURIComponent(operation.planId)}/operations/${encodeURIComponent(operation.id)}`,
      "PATCH",
      toOperationPayload(operation)
    );
    const result = (await response.json()) as { operation?: TradeOperation; meta?: ApiMeta; errors?: string[] };
    return readMutationData(response, result.operation, result.meta, result.errors, "更新云端操作失败。");
  },
  async deleteOperation(planId: string, operationId: string): Promise<void> {
    await deleteCloudResource(
      `/api/plans/${encodeURIComponent(planId)}/operations/${encodeURIComponent(operationId)}`,
      "删除云端操作失败。"
    );
  },
  async createReview(review: PlanReview): Promise<PlanReview> {
    const response = await sendJson(
      `/api/plans/${encodeURIComponent(review.planId)}/reviews`,
      "POST",
      toReviewPayload(review)
    );
    const result = (await response.json()) as { review?: PlanReview; meta?: ApiMeta; errors?: string[] };
    return readMutationData(response, result.review, result.meta, result.errors, "创建云端复盘失败。");
  },
  async updateReview(review: PlanReview): Promise<PlanReview> {
    const response = await sendJson(
      `/api/plans/${encodeURIComponent(review.planId)}/reviews/${encodeURIComponent(review.id)}`,
      "PATCH",
      toReviewPayload(review)
    );
    const result = (await response.json()) as { review?: PlanReview; meta?: ApiMeta; errors?: string[] };
    return readMutationData(response, result.review, result.meta, result.errors, "更新云端复盘失败。");
  },
  async deleteReview(planId: string, reviewId: string): Promise<void> {
    await deleteCloudResource(
      `/api/plans/${encodeURIComponent(planId)}/reviews/${encodeURIComponent(reviewId)}`,
      "删除云端复盘失败。"
    );
  }
};

function toPlanPayload(plan: TradePlan) {
  const { title, assetName, ticker, market, currency, status, thesis } = plan;
  return { title, assetName, ticker, market, currency, status, thesis };
}

function toOperationPayload(operation: TradeOperation) {
  const {
    action,
    tradeTime,
    currency,
    price,
    quantity,
    quantityUnit,
    totalAmount,
    takeProfitPrice,
    stopLossPrice,
    decisionReason,
    psychologyNote,
    emotionTags,
    strategyTags,
    source
  } = operation;
  return {
    action,
    tradeTime,
    currency,
    price,
    quantity,
    quantityUnit,
    totalAmount,
    takeProfitPrice,
    stopLossPrice,
    decisionReason,
    psychologyNote,
    emotionTags,
    strategyTags,
    source
  };
}

function toReviewPayload(review: PlanReview) {
  const { reviewTime, operationIds, realizedResult, profitLoss, violatedRules, reviewNote, emotionTags } = review;
  return { reviewTime, operationIds, realizedResult, profitLoss, violatedRules, reviewNote, emotionTags };
}

function sendJson(url: string, method: "POST" | "PATCH", body: unknown) {
  return fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function deleteCloudResource(url: string, fallbackMessage: string) {
  const response = await fetch(url, { method: "DELETE", headers: { "X-Confirm-Delete": "true" } });
  if (!response.ok) {
    const result = (await response.json()) as { meta?: ApiMeta; errors?: string[] };
    throw new Error(result.meta?.message ?? result.errors?.[0] ?? fallbackMessage);
  }
}

function assertCloudResponse(response: Response, meta?: ApiMeta) {
  if (!response.ok || meta?.storage !== "postgres") {
    throw new Error(meta?.message ?? "读取云端计划失败。");
  }
}

function readMutationData<T>(
  response: Response,
  data: T | undefined,
  meta: ApiMeta | undefined,
  errors: string[] | undefined,
  fallbackMessage: string
): T {
  if (!response.ok || !data) {
    throw new Error(meta?.message ?? errors?.[0] ?? fallbackMessage);
  }

  return data;
}

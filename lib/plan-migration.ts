import type { PlanReview, TradeDecision, TradeOperation, TradePlan } from "@/lib/types";

export function buildPlanFromTrade(trade: TradeDecision): TradePlan {
  const planId = `plan-${trade.id}`;
  const operation = buildOperationFromTrade(trade, planId);
  const review = buildReviewFromTrade(trade, planId);

  return {
    id: planId,
    title: `${trade.assetName} 计划`,
    assetName: trade.assetName,
    ticker: trade.ticker,
    market: trade.market,
    currency: trade.currency,
    status: "active",
    thesis: trade.decisionReason,
    operations: [operation],
    reviews: review ? [review] : [],
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt
  };
}

export function migrateTradesToPlans(trades: TradeDecision[]): TradePlan[] {
  return trades.map(buildPlanFromTrade);
}

export function normalizeTradePlans(plans: TradePlan[]): TradePlan[] {
  return plans.map((plan) => ({
    ...plan,
    operations: plan.operations.map((operation) => normalizeTradeOperation(operation))
  }));
}

export function normalizeTradeOperation(operation: TradeOperation): TradeOperation {
  if (operation.action !== "observe") {
    return operation;
  }

  return {
    ...operation,
    quantity: undefined,
    quantityUnit: undefined,
    totalAmount: undefined
  };
}

function buildOperationFromTrade(trade: TradeDecision, planId: string): TradeOperation {
  return normalizeTradeOperation({
    id: `operation-${trade.id}`,
    planId,
    action: trade.action,
    tradeTime: trade.tradeTime,
    currency: trade.currency,
    price: trade.price,
    quantity: trade.quantity,
    quantityUnit: trade.quantityUnit,
    totalAmount: trade.totalAmount,
    takeProfitPrice: trade.takeProfitPrice,
    stopLossPrice: trade.stopLossPrice,
    decisionReason: trade.decisionReason,
    psychologyNote: trade.psychologyNote,
    emotionTags: trade.emotionTags,
    strategyTags: trade.strategyTags,
    source: trade.source,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt
  });
}

function buildReviewFromTrade(trade: TradeDecision, planId: string): PlanReview | null {
  const hasReview =
    trade.realizedResult !== undefined ||
    typeof trade.profitLoss === "number" ||
    trade.violatedRules.length > 0 ||
    Boolean(trade.reviewNote);

  if (!hasReview) {
    return null;
  }

  return {
    id: `review-${trade.id}`,
    planId,
    reviewTime: trade.updatedAt,
    operationIds: [`operation-${trade.id}`],
    realizedResult: trade.realizedResult ?? "unknown",
    profitLoss: trade.profitLoss,
    violatedRules: trade.violatedRules,
    reviewNote: trade.reviewNote ?? "从旧版单条记录迁移来的复盘。",
    emotionTags: trade.emotionTags,
    createdAt: trade.updatedAt,
    updatedAt: trade.updatedAt
  };
}

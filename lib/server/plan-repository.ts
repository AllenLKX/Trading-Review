import type { QueryResultRow } from "pg";

import { getDatabasePool, isDatabaseConfigured } from "@/lib/server/db";
import type { CurrencyCode, PlanReview, PlanStatus, QuantityUnit, RealizedResult, TradeAction, TradeOperation, TradePlan, TradeSource } from "@/lib/types";

type PlanListResult = {
  plans: TradePlan[];
  storage: "postgres" | "not-configured" | "missing-user" | "error";
  message?: string;
};

type PlanRow = QueryResultRow & {
  id: string;
  title: string;
  asset_name: string;
  ticker: string;
  market: string;
  currency: CurrencyCode;
  status: PlanStatus;
  thesis: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type OperationRow = QueryResultRow & {
  id: string;
  plan_id: string;
  action: TradeAction;
  trade_time: Date | string;
  currency: CurrencyCode;
  price: string | number | null;
  quantity: string | number | null;
  quantity_unit: QuantityUnit | null;
  total_amount: string | number | null;
  take_profit_price: string | number | null;
  stop_loss_price: string | number | null;
  decision_reason: string;
  psychology_note: string | null;
  emotion_tags: string[];
  strategy_tags: string[];
  source: TradeSource;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReviewRow = QueryResultRow & {
  id: string;
  plan_id: string;
  review_time: Date | string;
  operation_ids: string[];
  realized_result: RealizedResult;
  profit_loss: string | number | null;
  violated_rules: string[];
  review_note: string;
  emotion_tags: string[];
  created_at: Date | string;
  updated_at: Date | string;
};

export async function listServerTradePlans(): Promise<PlanListResult> {
  if (!isDatabaseConfigured()) {
    return {
      plans: [],
      storage: "not-configured",
      message: "DATABASE_URL is not configured."
    };
  }

  const userId = process.env.RATIONALTRADE_SINGLE_USER_ID;

  if (!userId) {
    return {
      plans: [],
      storage: "missing-user",
      message: "RATIONALTRADE_SINGLE_USER_ID is not configured."
    };
  }

  try {
    const pool = getDatabasePool();
    const [planResult, operationResult, reviewResult] = await Promise.all([
      pool.query<PlanRow>(
        `select id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at
         from trade_plans
         where user_id = $1
         order by updated_at desc`,
        [userId]
      ),
      pool.query<OperationRow>(
        `select id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
                total_amount, take_profit_price, stop_loss_price, decision_reason,
                psychology_note, emotion_tags, strategy_tags, source, created_at, updated_at
         from trade_operations
         where user_id = $1
         order by trade_time desc`,
        [userId]
      ),
      pool.query<ReviewRow>(
        `select id, plan_id, review_time, operation_ids, realized_result, profit_loss,
                violated_rules, review_note, emotion_tags, created_at, updated_at
         from plan_reviews
         where user_id = $1
         order by review_time desc`,
        [userId]
      )
    ]);

    const operationsByPlan = groupByPlanId(operationResult.rows.map(mapOperationRow));
    const reviewsByPlan = groupByPlanId(reviewResult.rows.map(mapReviewRow));

    return {
      plans: planResult.rows.map((row) => ({
        id: row.id,
        title: row.title,
        assetName: row.asset_name,
        ticker: row.ticker,
        market: row.market,
        currency: row.currency,
        status: row.status,
        thesis: row.thesis,
        operations: operationsByPlan.get(row.id) ?? [],
        reviews: reviewsByPlan.get(row.id) ?? [],
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at)
      })),
      storage: "postgres"
    };
  } catch {
    return {
      plans: [],
      storage: "error",
      message: "Failed to load plans from PostgreSQL."
    };
  }
}

function mapOperationRow(row: OperationRow): TradeOperation {
  return {
    id: row.id,
    planId: row.plan_id,
    action: row.action,
    tradeTime: toIsoString(row.trade_time),
    currency: row.currency,
    price: toOptionalNumber(row.price),
    quantity: toOptionalNumber(row.quantity),
    quantityUnit: row.quantity_unit ?? undefined,
    totalAmount: toOptionalNumber(row.total_amount),
    takeProfitPrice: toOptionalNumber(row.take_profit_price),
    stopLossPrice: toOptionalNumber(row.stop_loss_price),
    decisionReason: row.decision_reason,
    psychologyNote: row.psychology_note ?? undefined,
    emotionTags: row.emotion_tags ?? [],
    strategyTags: row.strategy_tags ?? [],
    source: row.source,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapReviewRow(row: ReviewRow): PlanReview {
  return {
    id: row.id,
    planId: row.plan_id,
    reviewTime: toIsoString(row.review_time),
    operationIds: row.operation_ids ?? [],
    realizedResult: row.realized_result,
    profitLoss: toOptionalNumber(row.profit_loss),
    violatedRules: row.violated_rules ?? [],
    reviewNote: row.review_note,
    emotionTags: row.emotion_tags ?? [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function groupByPlanId<T extends { planId: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    grouped.set(item.planId, [...(grouped.get(item.planId) ?? []), item]);
  }

  return grouped;
}

function toOptionalNumber(value: string | number | null) {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

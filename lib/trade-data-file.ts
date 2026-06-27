import { migrateTradesToPlans } from "@/lib/plan-migration";
import type { TradeDataFile, TradeDecision, TradePlan } from "@/lib/types";

const TRADE_DATA_SOURCE = "rationaltrade-local";

export function buildTradeDataFile(plans: TradePlan[]): TradeDataFile {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    source: TRADE_DATA_SOURCE,
    plans
  };
}

export function parseTradeDataFile(rawText: string): TradePlan[] {
  const parsed = JSON.parse(rawText) as unknown;

  if (Array.isArray(parsed)) {
    return migrateTradesToPlans(parsed.filter(isTradeDecisionLike));
  }

  const data = getDataObject(parsed);
  const plans = Array.isArray(data?.plans) ? data.plans : null;

  if (plans) {
    const validPlans = plans.filter(isTradePlanLike);
    if (validPlans.length > 0) {
      return validPlans;
    }
  }

  const trades = Array.isArray(data?.trades) ? data.trades : null;

  if (trades) {
    const validTrades = trades.filter(isTradeDecisionLike);
    if (validTrades.length > 0) {
      return migrateTradesToPlans(validTrades);
    }
  }

  throw new Error("没有找到有效的计划或旧版交易记录。");
}

function getDataObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Partial<TradeDataFile>;
}

function isTradePlanLike(value: unknown): value is TradePlan {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as Partial<TradePlan>;

  return (
    typeof plan.id === "string" &&
    typeof plan.title === "string" &&
    typeof plan.assetName === "string" &&
    typeof plan.ticker === "string" &&
    typeof plan.currency === "string" &&
    Array.isArray(plan.operations) &&
    Array.isArray(plan.reviews)
  );
}

function isTradeDecisionLike(value: unknown): value is TradeDecision {
  if (!value || typeof value !== "object") {
    return false;
  }

  const trade = value as Partial<TradeDecision>;

  return (
    typeof trade.id === "string" &&
    isTradeAction(trade.action) &&
    typeof trade.assetName === "string" &&
    typeof trade.ticker === "string" &&
    typeof trade.tradeTime === "string" &&
    typeof trade.currency === "string" &&
    typeof trade.decisionReason === "string" &&
    Array.isArray(trade.emotionTags) &&
    Array.isArray(trade.strategyTags) &&
    Array.isArray(trade.violatedRules)
  );
}

function isTradeAction(value: unknown) {
  return value === "buy" || value === "sell" || value === "observe";
}

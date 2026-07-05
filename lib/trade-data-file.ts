import { migrateTradesToPlans } from "@/lib/plan-migration";
import type { AuditReport, TradeDataFile, TradeDecision, TradePlan } from "@/lib/types";

const TRADE_DATA_SOURCE = "rationaltrade-local";

export type ParsedTradeDataFile = {
  plans: TradePlan[];
  auditReports: AuditReport[];
};

export function buildTradeDataFile(plans: TradePlan[], auditReports: AuditReport[] = []): TradeDataFile {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    source: TRADE_DATA_SOURCE,
    plans,
    auditReports
  };
}

export function parseTradeDataFile(rawText: string): ParsedTradeDataFile {
  const parsed = JSON.parse(rawText) as unknown;

  if (Array.isArray(parsed)) {
    return {
      plans: migrateTradesToPlans(parsed.filter(isTradeDecisionLike)),
      auditReports: []
    };
  }

  const data = getDataObject(parsed);
  const plans = Array.isArray(data?.plans) ? data.plans : null;
  const auditReports = Array.isArray(data?.auditReports) ? data.auditReports.filter(isAuditReportLike) : [];

  if (plans) {
    const validPlans = plans.filter(isTradePlanLike);
    if (plans.length === 0 || validPlans.length > 0) {
      return {
        plans: validPlans,
        auditReports
      };
    }
  }

  const trades = Array.isArray(data?.trades) ? data.trades : null;

  if (trades) {
    const validTrades = trades.filter(isTradeDecisionLike);
    if (validTrades.length > 0) {
      return {
        plans: migrateTradesToPlans(validTrades),
        auditReports
      };
    }
  }

  throw new Error("没有找到有效的计划或旧版交易记录。");
}

function isAuditReportLike(value: unknown): value is AuditReport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const report = value as Partial<AuditReport>;

  return (
    typeof report.id === "string" &&
    typeof report.periodStart === "string" &&
    typeof report.periodEnd === "string" &&
    typeof report.title === "string" &&
    typeof report.summary === "string" &&
    typeof report.signalLabel === "string" &&
    Array.isArray(report.findings) &&
    Array.isArray(report.aiInputDigest) &&
    Array.isArray(report.reviewQuestions)
  );
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

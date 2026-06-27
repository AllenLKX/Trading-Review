import type { TradeDataFile, TradeDecision } from "@/lib/types";

const TRADE_DATA_SOURCE = "rationaltrade-local";

export function buildTradeDataFile(trades: TradeDecision[]): TradeDataFile {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: TRADE_DATA_SOURCE,
    trades
  };
}

export function parseTradeDataFile(rawText: string): TradeDecision[] {
  const parsed = JSON.parse(rawText) as unknown;
  const trades = Array.isArray(parsed) ? parsed : getTradesFromDataFile(parsed);

  if (!Array.isArray(trades)) {
    throw new Error("文件里没有可导入的历史记录。");
  }

  const validTrades = trades.filter(isTradeDecisionLike);

  if (validTrades.length === 0) {
    throw new Error("没有找到有效的交易记录。");
  }

  return validTrades;
}

function getTradesFromDataFile(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const dataFile = value as Partial<TradeDataFile>;
  return dataFile.trades;
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

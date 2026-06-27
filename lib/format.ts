import type { QuantityUnit, RealizedResult, TradeAction } from "@/lib/types";

const currencySymbols: Record<string, string> = {
  HKD: "HK$",
  USD: "$",
  CNY: "¥",
  EUR: "€",
  JPY: "¥",
  GBP: "£"
};

export function formatCurrency(value?: number, currency = "HKD") {
  if (typeof value !== "number") {
    return "--";
  }

  const symbol = currencySymbols[currency] ?? currency;

  return `${symbol} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getActionLabel(action: TradeAction) {
  const labels: Record<TradeAction, string> = {
    buy: "买入",
    sell: "卖出",
    observe: "观察"
  };

  return labels[action];
}

export function getActionTone(action: TradeAction) {
  const tones: Record<TradeAction, string> = {
    buy: "border-buy/40 bg-buy/10 text-emerald-200",
    sell: "border-sell/50 bg-sell/10 text-rose-200",
    observe: "border-line bg-surface-raised text-muted-strong"
  };

  return tones[action];
}

export function getQuantityUnitLabel(unit: QuantityUnit) {
  const labels: Record<QuantityUnit, string> = {
    shares: "股数",
    units: "份额"
  };

  return labels[unit];
}

export function getRealizedResultLabel(result: RealizedResult = "unknown") {
  const labels: Record<RealizedResult, string> = {
    profit: "盈利",
    loss: "亏损",
    breakeven: "持平",
    unknown: "待复盘"
  };

  return labels[result];
}

export type TradeAction = "buy" | "sell" | "observe";

export type TradeSource = "manual" | "ai_screenshot" | "sample";

export type ReviewStatus = "draft" | "confirmed" | "archived";

export type CurrencyCode = "HKD" | "USD" | "CNY" | "EUR" | "JPY" | "GBP";

export type QuantityUnit = "shares" | "units";

export type RealizedResult = "profit" | "loss" | "breakeven" | "unknown";

export type TradeDecision = {
  id: string;
  action: TradeAction;
  assetName: string;
  ticker: string;
  market: string;
  tradeTime: string;
  currency: CurrencyCode;
  price?: number;
  quantity?: number;
  quantityUnit?: QuantityUnit;
  totalAmount?: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  decisionReason: string;
  psychologyNote?: string;
  emotionTags: string[];
  strategyTags: string[];
  source: TradeSource;
  reviewStatus: ReviewStatus;
  errorTags: string[];
  realizedResult?: RealizedResult;
  profitLoss?: number;
  violatedRules: string[];
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type TradeDataFile = {
  schemaVersion: 1;
  exportedAt: string;
  source: "rationaltrade-local";
  trades: TradeDecision[];
};

export type BatchRecognitionItem = {
  id: string;
  action: TradeAction;
  assetName: string;
  ticker: string;
  market: string;
  tradeTime: string;
  currency: CurrencyCode;
  price: number;
  quantity?: number;
  quantityUnit?: QuantityUnit;
  totalAmount?: number;
  sourceImageName: string;
  confidence: number;
  psychologyNote: string;
  emotionTags: string[];
};

export type AuditReport = {
  id: string;
  periodStart: string;
  periodEnd: string;
  title: string;
  summary: string;
  signalLabel: string;
  signalLevel: "stable" | "watch" | "risk";
  metrics: {
    emotionHeat: number;
    delayedExitRate: number;
    recordCount: number;
    reviewCoverageRate: number;
    violationRate: number;
  };
  findings: string[];
  createdAt: string;
};

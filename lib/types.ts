export type TradeAction = "buy" | "sell" | "observe";

export type TradeSource = "manual" | "ai_screenshot" | "sample";

export type ReviewStatus = "draft" | "confirmed" | "archived";

export type CurrencyCode = "HKD" | "USD" | "CNY" | "EUR" | "JPY" | "GBP";

export type QuantityUnit = "shares" | "units";

export type RealizedResult = "met" | "partial" | "missed" | "profit" | "loss" | "breakeven" | "unknown";

export type PlanStatus = "active" | "closed" | "archived";

export type TradeOperation = {
  id: string;
  planId: string;
  action: TradeAction;
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
  createdAt: string;
  updatedAt: string;
};

export type PlanReview = {
  id: string;
  planId: string;
  reviewTime: string;
  operationIds?: string[];
  realizedResult: RealizedResult;
  profitLoss?: number;
  violatedRules: string[];
  reviewNote: string;
  emotionTags: string[];
  createdAt: string;
  updatedAt: string;
};

export type TradePlan = {
  id: string;
  title: string;
  assetName: string;
  ticker: string;
  market: string;
  currency: CurrencyCode;
  status: PlanStatus;
  thesis: string;
  operations: TradeOperation[];
  reviews: PlanReview[];
  createdAt: string;
  updatedAt: string;
};

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
  schemaVersion: 2;
  exportedAt: string;
  source: "rationaltrade-local";
  plans: TradePlan[];
  auditReports?: AuditReport[];
  trades?: TradeDecision[];
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

export type ScreenshotArchiveBatch = {
  newPlans: TradePlan[];
  operations: TradeOperation[];
};

export type ScreenshotArchiveResult = {
  plans: TradePlan[];
  archivedOperationCount: number;
};

export type AuditFallbackReason = "not-configured" | "timeout" | "provider-error" | "invalid-output";

export type AuditGeneration = {
  source: "deepseek" | "local-rules" | "legacy";
  provider: "deepseek" | "local" | "unknown";
  model?: string;
  promptVersion: string;
  status: "success" | "fallback" | "local" | "legacy";
  fallbackReason?: AuditFallbackReason;
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
  aiInputDigest: string[];
  findings: string[];
  reviewQuestions: string[];
  generation?: AuditGeneration;
  createdAt: string;
};

import type {
  CurrencyCode,
  PlanStatus,
  QuantityUnit,
  RealizedResult,
  TradeAction,
  TradeSource
} from "@/lib/types";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export type CreatePlanInput = {
  title: string;
  assetName: string;
  ticker: string;
  market: string;
  currency: CurrencyCode;
  status: PlanStatus;
  thesis: string;
};

export type CreateOperationInput = {
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
};

export type CreateReviewInput = {
  reviewTime: string;
  operationIds: string[];
  realizedResult: RealizedResult;
  profitLoss?: number;
  violatedRules: string[];
  reviewNote: string;
  emotionTags: string[];
};

const currencyCodes: CurrencyCode[] = ["HKD", "USD", "CNY", "EUR", "JPY", "GBP"];
const planStatuses: PlanStatus[] = ["active", "closed", "archived"];
const tradeActions: TradeAction[] = ["buy", "sell", "observe"];
const quantityUnits: QuantityUnit[] = ["shares", "units"];
const tradeSources: TradeSource[] = ["manual", "ai_screenshot", "sample"];
const realizedResults: RealizedResult[] = ["met", "partial", "missed", "profit", "loss", "breakeven", "unknown"];

export function parseCreatePlanInput(raw: unknown): ValidationResult<CreatePlanInput> {
  const data = asRecord(raw);
  const errors: string[] = [];
  const title = readRequiredString(data, "title", errors);
  const assetName = readRequiredString(data, "assetName", errors);
  const ticker = readOptionalString(data, "ticker") || assetName;
  const market = readOptionalString(data, "market") || "自选";
  const currency = readEnum(data, "currency", currencyCodes, "HKD", errors);
  const status = readEnum(data, "status", planStatuses, "active", errors);
  const thesis = readRequiredString(data, "thesis", errors);

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { title, assetName, ticker, market, currency, status, thesis } };
}

export function parseCreateOperationInput(raw: unknown): ValidationResult<CreateOperationInput> {
  const data = asRecord(raw);
  const errors: string[] = [];
  const action = readEnum(data, "action", tradeActions, "observe", errors);
  const tradeTime = readIsoDateString(data, "tradeTime", errors);
  const currency = readEnum(data, "currency", currencyCodes, "HKD", errors);
  const price = readOptionalPositiveNumber(data, "price", errors);
  const quantity = readOptionalPositiveNumber(data, "quantity", errors);
  const quantityUnit = readOptionalEnum(data, "quantityUnit", quantityUnits, errors);
  const totalAmount = readOptionalPositiveNumber(data, "totalAmount", errors);
  const takeProfitPrice = readOptionalPositiveNumber(data, "takeProfitPrice", errors);
  const stopLossPrice = readOptionalPositiveNumber(data, "stopLossPrice", errors);
  const decisionReason = readRequiredString(data, "decisionReason", errors);
  const psychologyNote = readOptionalString(data, "psychologyNote");
  const emotionTags = readStringArray(data, "emotionTags");
  const strategyTags = readStringArray(data, "strategyTags");
  const source = readEnum(data, "source", tradeSources, "manual", errors);

  if (!price) {
    errors.push("price is required.");
  }

  if (action === "observe" && (quantity || quantityUnit || totalAmount)) {
    errors.push("observe operation cannot include quantity, quantityUnit, or totalAmount.");
  }

  if (action !== "observe" && (!quantity || !quantityUnit)) {
    errors.push("buy/sell operation requires quantity and quantityUnit.");
  }

  if (quantityUnit === "shares" && action !== "observe" && !totalAmount) {
    errors.push("shares operation requires totalAmount.");
  }

  if (quantityUnit === "units" && action !== "observe" && totalAmount !== quantity) {
    errors.push("units operation totalAmount must equal quantity.");
  }

  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        value: {
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
        }
      };
}

export function parseCreateReviewInput(raw: unknown): ValidationResult<CreateReviewInput> {
  const data = asRecord(raw);
  const errors: string[] = [];
  const reviewTime = readIsoDateString(data, "reviewTime", errors);
  const operationIds = readStringArray(data, "operationIds");
  const realizedResult = readEnum(data, "realizedResult", realizedResults, "unknown", errors);
  const profitLoss = readOptionalNumber(data, "profitLoss", errors);
  const violatedRules = readStringArray(data, "violatedRules");
  const reviewNote = readRequiredString(data, "reviewNote", errors);
  const emotionTags = readStringArray(data, "emotionTags");

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: { reviewTime, operationIds, realizedResult, profitLoss, violatedRules, reviewNote, emotionTags } };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readRequiredString(data: Record<string, unknown>, field: string, errors: string[]) {
  const value = data[field];

  if (typeof value !== "string" || !value.trim()) {
    errors.push(`${field} is required.`);
    return "";
  }

  return value.trim();
}

function readOptionalString(data: Record<string, unknown>, field: string) {
  const value = data[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(data: Record<string, unknown>, field: string) {
  const value = data[field];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function readEnum<T extends string>(data: Record<string, unknown>, field: string, values: T[], fallback: T, errors: string[]) {
  const value = data[field];

  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "string" && values.includes(value as T)) {
    return value as T;
  }

  errors.push(`${field} is invalid.`);
  return fallback;
}

function readOptionalEnum<T extends string>(data: Record<string, unknown>, field: string, values: T[], errors: string[]) {
  const value = data[field];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "string" && values.includes(value as T)) {
    return value as T;
  }

  errors.push(`${field} is invalid.`);
  return undefined;
}

function readIsoDateString(data: Record<string, unknown>, field: string, errors: string[]) {
  const value = data[field];

  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    errors.push(`${field} must be a valid date string.`);
    return new Date().toISOString();
  }

  return new Date(value).toISOString();
}

function readOptionalNumber(data: Record<string, unknown>, field: string, errors: string[]) {
  const value = data[field];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    errors.push(`${field} must be a valid number.`);
    return undefined;
  }

  return parsed;
}

function readOptionalPositiveNumber(data: Record<string, unknown>, field: string, errors: string[]) {
  const parsed = readOptionalNumber(data, field, errors);

  if (parsed !== undefined && parsed <= 0) {
    errors.push(`${field} must be greater than 0.`);
    return undefined;
  }

  return parsed;
}

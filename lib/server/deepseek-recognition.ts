import { randomUUID } from "node:crypto";

import { buildRecognitionPromptMessages } from "@/lib/server/recognition-prompts";
import type { VisionTextLine } from "@/lib/server/kimi-vision";
import type { BatchRecognitionItem, CurrencyCode, TradeAction } from "@/lib/types";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_ITEMS = 30;

type DeepSeekResponse = {
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

const MAX_STRUCTURE_ATTEMPTS = 2;

export type RecognitionTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type DeepSeekRecognitionResult =
  | {
      ok: true;
      items: BatchRecognitionItem[];
      model: string;
      promptVersion: string;
      usage?: RecognitionTokenUsage;
      attempts: number;
    }
  | {
      ok: false;
      reason: "not-configured" | "timeout" | "provider-error" | "invalid-output";
      model?: string;
      promptVersion?: string;
      attempts?: number;
    };

export async function structureRecognizedTrades(input: {
  sourceImageName: string;
  lines: VisionTextLine[];
}): Promise<DeepSeekRecognitionResult> {
  const apiKey = (process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY)?.trim();
  if (!apiKey) return { ok: false, reason: "not-configured" };

  const baseUrl = (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  let promptVersion: string | undefined;

  try {
    const prompt = await buildRecognitionPromptMessages(input);
    promptVersion = prompt.promptVersion;
    let usage: RecognitionTokenUsage | undefined;

    for (let attempts = 1; attempts <= MAX_STRUCTURE_ATTEMPTS; attempts += 1) {
      const result = await requestStructureCompletion({ apiKey, baseUrl, model, messages: prompt.messages });
      if (!result.ok) return { ...result, model, promptVersion, attempts };

      usage = combineUsage(usage, readUsage(result.payload));
      const choice = result.payload.choices?.[0];
      const items =
        choice?.finish_reason === "length"
          ? null
          : parseRecognitionItems(choice?.message?.content, input.sourceImageName);
      if (items) return { ok: true, items, model, promptVersion, usage, attempts };
    }

    return { ok: false, reason: "invalid-output", model, promptVersion, attempts: MAX_STRUCTURE_ATTEMPTS };
  } catch (error) {
    console.error("DeepSeek screenshot recognition request failed", error);
    return { ok: false, reason: "provider-error", model, promptVersion };
  }
}

async function requestStructureCompletion(input: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
}): Promise<{ ok: true; payload: DeepSeekResponse } | { ok: false; reason: "timeout" | "provider-error" }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeout(process.env.AI_TIMEOUT_MS));

  try {
    const response = await fetch(`${input.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        max_tokens: 2400
      }),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      console.error("DeepSeek screenshot recognition request failed", { status: response.status });
      return { ok: false, reason: "provider-error" };
    }
    return { ok: true, payload: (await response.json()) as DeepSeekResponse };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { ok: false, reason: "timeout" };
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function readUsage(payload: DeepSeekResponse): RecognitionTokenUsage {
  return {
    promptTokens: payload.usage?.prompt_tokens,
    completionTokens: payload.usage?.completion_tokens,
    totalTokens: payload.usage?.total_tokens
  };
}

function combineUsage(current: RecognitionTokenUsage | undefined, next: RecognitionTokenUsage) {
  return {
    promptTokens: (current?.promptTokens ?? 0) + (next.promptTokens ?? 0),
    completionTokens: (current?.completionTokens ?? 0) + (next.completionTokens ?? 0),
    totalTokens: (current?.totalTokens ?? 0) + (next.totalTokens ?? 0)
  };
}

function parseRecognitionItems(content: string | null | undefined, sourceImageName: string) {
  if (!content?.trim()) return null;
  try {
    const data = JSON.parse(content) as { items?: unknown };
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > MAX_ITEMS) return null;
    const items = data.items.map((raw, index) => parseRecognitionItem(raw, sourceImageName, index));
    return items.every((item): item is BatchRecognitionItem => Boolean(item)) ? items : null;
  } catch {
    return null;
  }
}

function parseRecognitionItem(raw: unknown, sourceImageName: string, index: number): BatchRecognitionItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const action = readAction(data.action);
  const assetName = readText(data.assetName, 80);
  const ticker = readText(data.ticker, 40, true);
  const market = readText(data.market, 40, true) || "CHN";
  const currency = readCurrency(data.currency);
  const tradeTime = readTradeTime(data.tradeTime);
  const price = readPositiveNumber(data.price);
  const quantity = action === "observe" ? undefined : readPositiveNumber(data.quantity);
  if (!action || !assetName || !currency || !tradeTime || !price || (action !== "observe" && !quantity)) return null;

  const calculatedAmount = quantity ? price * quantity : undefined;
  const statedAmount = readPositiveNumber(data.totalAmount);
  const totalAmount = calculatedAmount
    ? statedAmount && Math.abs(statedAmount - calculatedAmount) / calculatedAmount <= 0.01
      ? statedAmount
      : calculatedAmount
    : undefined;

  return {
    id: `recognition-${Date.now()}-${index}-${randomUUID().slice(0, 8)}`,
    action,
    assetName,
    ticker: ticker ?? "",
    market,
    tradeTime,
    currency,
    price,
    quantity,
    quantityUnit: action === "observe" ? undefined : "shares",
    totalAmount,
    sourceImageName: sourceImageName.slice(0, 160),
    confidence: readConfidence(data.confidence),
    psychologyNote: "",
    emotionTags: []
  };
}

function readText(value: unknown, maxLength: number, allowEmpty = false) {
  if (typeof value !== "string") return allowEmpty ? "" : null;
  const text = value.trim();
  if (!text) return allowEmpty ? "" : null;
  return text.length <= maxLength ? text : null;
}

function readAction(value: unknown): TradeAction | null {
  return value === "buy" || value === "sell" || value === "observe" ? value : null;
}

function readCurrency(value: unknown): CurrencyCode | null {
  return value === "HKD" || value === "USD" || value === "CNY" || value === "EUR" || value === "JPY" || value === "GBP"
    ? value
    : null;
}

function readTradeTime(value: unknown) {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function readPositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readConfidence(value: unknown) {
  const parsed = typeof value === "number" ? value : 0.7;
  return Math.min(1, Math.max(0, parsed));
}

function readTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 5_000 && parsed <= 60_000 ? parsed : DEFAULT_TIMEOUT_MS;
}

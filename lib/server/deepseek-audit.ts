import type { AuditAiRequest } from "@/lib/audit-ai-adapter";
import { buildAuditPromptMessages } from "@/lib/server/audit-prompts";
import type { AuditFallbackReason, AuditReport } from "@/lib/types";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_TIMEOUT_MS = 60_000;

const prohibitedAdvicePatterns = [
  /应该(买入|卖出|加仓|减仓|继续持有)/,
  /建议(买入|卖出|加仓|减仓|持有|立即止损)/,
  /(最佳买点|目标价应|合理目标价|大概率赚钱)/,
  /(未来|接下来).{0,8}(上涨|下跌)/
];

type DeepSeekAuditNarrative = Pick<AuditReport, "summary" | "signalLabel" | "signalLevel" | "findings" | "reviewQuestions">;

type DeepSeekResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type AuditTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type DeepSeekAuditResult =
  | { ok: true; narrative: DeepSeekAuditNarrative; model: string; promptVersion: string; usage?: AuditTokenUsage }
  | { ok: false; reason: AuditFallbackReason; model?: string; promptVersion?: string };

export async function generateDeepSeekAudit(aiRequest: AuditAiRequest): Promise<DeepSeekAuditResult> {
  const apiKey = (process.env.DEEPSEEK_API_KEY ?? process.env.AI_API_KEY)?.trim();
  if (!apiKey) return { ok: false, reason: "not-configured" };

  const baseUrl = (process.env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = readTimeout(process.env.AI_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let promptVersion: string | undefined;

  try {
    const prompt = await buildAuditPromptMessages(aiRequest);
    promptVersion = prompt.promptVersion;
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: prompt.messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        max_tokens: 1200
      }),
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      console.error("DeepSeek audit request failed", { status: response.status });
      return { ok: false, reason: "provider-error", model, promptVersion };
    }

    const payload = (await response.json()) as DeepSeekResponse;
    const choice = payload.choices?.[0];
    if (choice?.finish_reason === "length") return { ok: false, reason: "invalid-output", model, promptVersion };

    const narrative = parseNarrative(choice?.message?.content);
    return narrative
      ? {
          ok: true,
          narrative,
          model,
          promptVersion,
          usage: {
            promptTokens: payload.usage?.prompt_tokens,
            completionTokens: payload.usage?.completion_tokens,
            totalTokens: payload.usage?.total_tokens
          }
        }
      : { ok: false, reason: "invalid-output", model, promptVersion };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout", model, promptVersion };
    }
    console.error("DeepSeek audit request failed", error);
    return { ok: false, reason: "provider-error", model, promptVersion };
  } finally {
    clearTimeout(timeout);
  }
}

function parseNarrative(content: string | null | undefined): DeepSeekAuditNarrative | null {
  if (!content?.trim()) return null;

  try {
    const data = JSON.parse(content) as Record<string, unknown>;
    const summary = readText(data.summary, 180);
    const signalLabel = readText(data.signalLabel, 16);
    const signalLevel = data.signalLevel;
    const findings = readTextArray(data.findings, 1, 5, 100);
    const reviewQuestions = readTextArray(data.reviewQuestions, 1, 4, 120);

    if (!summary || !signalLabel || !isSignalLevel(signalLevel) || !findings || !reviewQuestions) return null;
    const allText = [summary, signalLabel, ...findings, ...reviewQuestions].join("\n");
    if (prohibitedAdvicePatterns.some((pattern) => pattern.test(allText))) return null;

    return { summary, signalLabel, signalLevel, findings, reviewQuestions };
  } catch {
    return null;
  }
}

function readText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function readTextArray(value: unknown, minItems: number, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) return null;
  const texts = value.map((item) => readText(item, maxLength));
  return texts.every((item): item is string => Boolean(item)) ? texts : null;
}

function isSignalLevel(value: unknown): value is AuditReport["signalLevel"] {
  return value === "stable" || value === "watch" || value === "risk";
}

function readTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
}

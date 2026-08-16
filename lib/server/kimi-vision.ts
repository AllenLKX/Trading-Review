import { buildVisionPromptMessages } from "@/lib/server/vision-prompts";

const DEFAULT_BASE_URL = "https://tokenhub.tencentmaas.com/v1";
const DEFAULT_MODEL = "kimi-k3";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_LINES = 300;

export type VisionTextLine = {
  text: string;
  confidence: number;
  x: number;
  y: number;
};

type KimiResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null };
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type VisionTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type KimiVisionResult =
  | {
      ok: true;
      lines: VisionTextLine[];
      model: string;
      promptVersion: string;
      usage?: VisionTokenUsage;
    }
  | {
      ok: false;
      reason: "not-configured" | "timeout" | "provider-error" | "invalid-output";
      model?: string;
      promptVersion?: string;
    };

export async function transcribeTradeScreenshot(input: {
  imageBase64: string;
  mimeType: string;
  sourceImageName: string;
}): Promise<KimiVisionResult> {
  const apiKey = process.env.VISION_AI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "not-configured" };

  const baseUrl = (process.env.VISION_AI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env.VISION_AI_MODEL?.trim() || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), readTimeout(process.env.VISION_AI_TIMEOUT_MS));
  let promptVersion: string | undefined;

  try {
    const prompt = await buildVisionPromptMessages(input.sourceImageName);
    promptVersion = prompt.promptVersion;
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          {
            role: "user",
            content: [
              { type: "text", text: prompt.user },
              { type: "image_url", image_url: { url: `data:${input.mimeType};base64,${input.imageBase64}` } }
            ]
          }
        ],
        response_format: { type: "json_object" },
        reasoning_effort: "max",
        max_completion_tokens: 8192,
        stream: false
      }),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) {
      console.error("Kimi screenshot transcription failed", { status: response.status });
      return { ok: false, reason: "provider-error", model, promptVersion };
    }

    const payload = (await response.json()) as KimiResponse;
    const choice = payload.choices?.[0];
    if (choice?.finish_reason === "length") return { ok: false, reason: "invalid-output", model, promptVersion };
    const lines = parseVisionLines(choice?.message?.content);
    if (!lines) return { ok: false, reason: "invalid-output", model, promptVersion };

    return {
      ok: true,
      lines,
      model: payload.model?.trim() || model,
      promptVersion,
      usage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens
      }
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, reason: "timeout", model, promptVersion };
    }
    console.error("Kimi screenshot transcription failed", error);
    return { ok: false, reason: "provider-error", model, promptVersion };
  } finally {
    clearTimeout(timeout);
  }
}

function parseVisionLines(content: string | null | undefined) {
  if (!content?.trim()) return null;
  try {
    const data = JSON.parse(content) as { lines?: unknown };
    if (!Array.isArray(data.lines) || data.lines.length === 0 || data.lines.length > MAX_LINES) return null;
    const lines = data.lines.map((raw, index) => parseVisionLine(raw, index));
    return lines.every((line): line is VisionTextLine => Boolean(line)) ? lines : null;
  } catch {
    return null;
  }
}

function parseVisionLine(raw: unknown, index: number): VisionTextLine | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text || text.length > 500) return null;
  const lineNumber = typeof data.lineNumber === "number" && Number.isFinite(data.lineNumber) ? data.lineNumber : index + 1;
  const confidence = typeof data.confidence === "number" && Number.isFinite(data.confidence) ? data.confidence : 0.7;
  return {
    text,
    confidence: Math.min(1, Math.max(0, confidence)) * 100,
    x: 0,
    y: Math.max(0, Math.round(lineNumber))
  };
}

function readTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 10_000 ? Math.min(parsed, MAX_TIMEOUT_MS) : DEFAULT_TIMEOUT_MS;
}

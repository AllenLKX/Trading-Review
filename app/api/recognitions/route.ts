import { NextResponse } from "next/server";

import { structureRecognizedTrades } from "@/lib/server/deepseek-recognition";
import { recordAppEvent } from "@/lib/server/events";
import { transcribeTradeScreenshot } from "@/lib/server/kimi-vision";
import { getConfiguredUserId } from "@/lib/server/single-user";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 7_500_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/bmp"]);

export async function POST(request: Request) {
  const startedAt = Date.now();
  const userResult = await getConfiguredUserId();
  if (!userResult.ok) return NextResponse.json({ error: "请先登录。" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const image = formData?.get("image");
  if (!(image instanceof File)) return NextResponse.json({ error: "请选择交易截图。" }, { status: 400 });
  if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
    return NextResponse.json({ error: "仅支持 PNG、JPG、JPEG 或 BMP 图片。" }, { status: 415 });
  }
  if (image.size <= 0 || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "截图大小必须在 7.5MB 以内。" }, { status: 413 });
  }

  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString("base64");
  const visionResult = await transcribeTradeScreenshot({
    imageBase64,
    mimeType: image.type,
    sourceImageName: image.name
  });
  if (!visionResult.ok) {
    await recordRecognitionEvent(userResult.userId, startedAt, {
      status: "failed",
      stage: "vision",
      provider: "tencent-tokenhub",
      model: visionResult.model,
      promptVersion: visionResult.promptVersion,
      reason: visionResult.reason
    });
    return NextResponse.json(
      {
        error:
          visionResult.reason === "not-configured"
            ? "Kimi 识图服务尚未配置。"
            : visionResult.reason === "timeout"
              ? "Kimi 识图超时，请重试。"
              : "Kimi 无法读取这张截图，请重试或更换截图。"
      },
      { status: visionResult.reason === "not-configured" ? 503 : 502 }
    );
  }

  const aiResult = await structureRecognizedTrades({ sourceImageName: image.name, lines: visionResult.lines });
  const usage = combineUsage(visionResult.usage, aiResult.ok ? aiResult.usage : undefined);
  await recordRecognitionEvent(userResult.userId, startedAt, {
    status: aiResult.ok ? "success" : "failed",
    stage: "structure",
    visionProvider: "tencent-tokenhub",
    visionModel: visionResult.model,
    visionPromptVersion: visionResult.promptVersion,
    structureProvider: "deepseek",
    structureModel: aiResult.model,
    structurePromptVersion: aiResult.promptVersion,
    structureAttempts: aiResult.attempts,
    transcribedLineCount: visionResult.lines.length,
    itemCount: aiResult.ok ? aiResult.items.length : 0,
    visionUsage: visionResult.usage,
    structureUsage: aiResult.ok ? aiResult.usage : undefined,
    ...usage,
    ...(!aiResult.ok ? { reason: aiResult.reason } : {})
  });

  if (!aiResult.ok) {
    return NextResponse.json(
      { error: aiResult.reason === "not-configured" ? "AI 结构化服务尚未配置。" : "AI 无法整理这张截图，请重试或更换截图。" },
      { status: aiResult.reason === "not-configured" ? 503 : 502 }
    );
  }

  return NextResponse.json({
    items: aiResult.items,
    meta: {
      source: "kimi-vision+deepseek",
      visionModel: visionResult.model,
      visionPromptVersion: visionResult.promptVersion,
      structureModel: aiResult.model,
      structurePromptVersion: aiResult.promptVersion,
      transcribedLineCount: visionResult.lines.length
    }
  });
}

async function recordRecognitionEvent(userId: string, startedAt: number, metadata: Record<string, unknown>) {
  await recordAppEvent({
    eventName: "ai_screenshot_recognized",
    userId,
    path: "/api/recognitions",
    metadata: { durationMs: Date.now() - startedAt, ...metadata }
  });
}

function combineUsage(
  vision: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
  structure: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined
) {
  return {
    promptTokens: (vision?.promptTokens ?? 0) + (structure?.promptTokens ?? 0),
    completionTokens: (vision?.completionTokens ?? 0) + (structure?.completionTokens ?? 0),
    totalTokens: (vision?.totalTokens ?? 0) + (structure?.totalTokens ?? 0)
  };
}

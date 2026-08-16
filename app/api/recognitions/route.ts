import { NextResponse } from "next/server";

import { structureRecognizedTrades } from "@/lib/server/deepseek-recognition";
import { recordAppEvent } from "@/lib/server/events";
import { getConfiguredUserId } from "@/lib/server/single-user";
import { recognizeImageText } from "@/lib/server/tencent-ocr";

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
  const ocrResult = await recognizeImageText(imageBase64);
  if (!ocrResult.ok) {
    await recordRecognitionEvent(userResult.userId, startedAt, {
      status: "failed",
      stage: "ocr",
      reason: ocrResult.reason
    });
    return NextResponse.json(
      { error: ocrResult.reason === "not-configured" ? "截图识别服务尚未配置。" : "图片文字识别失败，请重试。" },
      { status: ocrResult.reason === "not-configured" ? 503 : 502 }
    );
  }
  if (ocrResult.lines.length === 0) {
    await recordRecognitionEvent(userResult.userId, startedAt, { status: "failed", stage: "ocr", reason: "empty" });
    return NextResponse.json({ error: "没有从图片中识别到文字，请换一张更清晰的截图。" }, { status: 422 });
  }

  const aiResult = await structureRecognizedTrades({ sourceImageName: image.name, lines: ocrResult.lines });
  await recordRecognitionEvent(userResult.userId, startedAt, {
    status: aiResult.ok ? "success" : "failed",
    stage: "structure",
    provider: "deepseek",
    model: aiResult.model,
    promptVersion: aiResult.promptVersion,
    ocrLineCount: ocrResult.lines.length,
    itemCount: aiResult.ok ? aiResult.items.length : 0,
    ...(!aiResult.ok ? { reason: aiResult.reason } : { ...aiResult.usage })
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
      source: "tencent-ocr+deepseek",
      model: aiResult.model,
      promptVersion: aiResult.promptVersion,
      ocrLineCount: ocrResult.lines.length
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

import { NextResponse } from "next/server";
import { buildAuditAiRequest, buildAuditReport } from "@/lib/audit-ai-adapter";
import { generateDeepSeekAudit } from "@/lib/server/deepseek-audit";
import { recordAppEvent } from "@/lib/server/events";
import { getConfiguredUserId } from "@/lib/server/single-user";
import type { TradePlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const userResult = await getConfiguredUserId();
    if (!userResult.ok) {
      return NextResponse.json({ error: "请先登录。" }, { status: 401 });
    }
    const body = (await request.json()) as { plans?: TradePlan[] };
    const plans = Array.isArray(body.plans) ? body.plans : [];
    const localReport = buildAuditReport(plans);
    const aiRequest = buildAuditAiRequest(localReport);
    const aiResult = await generateDeepSeekAudit(aiRequest);
    const eventBase = {
      eventName: "ai_audit_generated",
      userId: userResult.userId,
      path: "/api/audit",
      metadata: {
        provider: aiResult.model ? "deepseek" : "local",
        model: aiResult.model,
        promptVersion: aiResult.promptVersion,
        status: aiResult.ok ? "success" : "fallback",
        durationMs: Date.now() - startedAt,
        ...(!aiResult.ok ? { fallbackReason: aiResult.reason } : { ...aiResult.usage })
      }
    };
    await recordAppEvent(eventBase);

    if (aiResult.ok) {
      return NextResponse.json({
        report: {
          ...localReport,
          ...aiResult.narrative,
          generation: {
            source: "deepseek",
            provider: "deepseek",
            model: aiResult.model,
            promptVersion: aiResult.promptVersion,
            status: "success"
          }
        },
        aiRequest,
        source: "deepseek",
        model: aiResult.model
      });
    }

    return NextResponse.json({
      report: {
        ...localReport,
        generation: {
          source: "local-rules",
          provider: aiResult.model ? "deepseek" : "local",
          model: aiResult.model,
          promptVersion: aiResult.promptVersion ?? "local-rules-v1",
          status: "fallback",
          fallbackReason: aiResult.reason
        }
      },
      aiRequest,
      source: "local-fallback",
      fallbackReason: aiResult.reason
    });
  } catch {
    return NextResponse.json({ error: "无法生成审计报告。" }, { status: 400 });
  }
}

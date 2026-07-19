import { NextResponse } from "next/server";
import { buildAuditAiRequest, buildAuditReport } from "@/lib/audit-ai-adapter";
import { generateDeepSeekAudit } from "@/lib/server/deepseek-audit";
import type { TradePlan } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plans?: TradePlan[] };
    const plans = Array.isArray(body.plans) ? body.plans : [];
    const localReport = buildAuditReport(plans);
    const aiRequest = buildAuditAiRequest(localReport);
    const aiResult = await generateDeepSeekAudit(aiRequest);

    if (aiResult.ok) {
      return NextResponse.json({
        report: { ...localReport, ...aiResult.narrative },
        aiRequest,
        source: "deepseek",
        model: aiResult.model
      });
    }

    return NextResponse.json({
      report: localReport,
      aiRequest,
      source: "local-fallback",
      fallbackReason: aiResult.reason
    });
  } catch {
    return NextResponse.json({ error: "无法生成审计报告。" }, { status: 400 });
  }
}

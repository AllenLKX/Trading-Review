import { NextResponse } from "next/server";
import { buildAuditAiRequest, buildAuditReport } from "@/lib/audit-ai-adapter";
import type { TradePlan } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plans?: TradePlan[] };
    const plans = Array.isArray(body.plans) ? body.plans : [];
    const report = buildAuditReport(plans);

    return NextResponse.json({
      report,
      aiRequest: buildAuditAiRequest(report),
      source: "mock-local"
    });
  } catch {
    return NextResponse.json({ error: "无法生成审计报告。" }, { status: 400 });
  }
}

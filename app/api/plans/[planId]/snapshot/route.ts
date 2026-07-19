import { NextResponse } from "next/server";

import { replaceServerTradePlanSnapshot } from "@/lib/server/plan-repository";
import type { TradePlan } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const { planId } = await context.params;
  const rawBody = await request.json().catch(() => null);

  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ ok: false, errors: ["计划快照不是有效的 JSON 对象。"] }, { status: 400 });
  }

  const result = await replaceServerTradePlanSnapshot(planId, rawBody as TradePlan);
  if (!result.ok) {
    const status =
      result.storage === "validation"
        ? 400
        : result.storage === "not-found"
          ? 404
          : result.storage === "error"
            ? 500
            : 503;
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status }
    );
  }

  return NextResponse.json({ ok: true, plan: result.data, meta: { storage: result.storage } });
}

import { NextResponse } from "next/server";

import { createServerTradePlan, listServerTradePlans } from "@/lib/server/plan-repository";
import { parseCreatePlanInput } from "@/lib/server/trade-validation";

export const runtime = "nodejs";

export async function GET() {
  const result = await listServerTradePlans();

  return NextResponse.json({
    ok: result.storage !== "error",
    plans: result.plans,
    meta: {
      storage: result.storage,
      count: result.plans.length,
      message: result.message
    }
  });
}

export async function POST(request: Request) {
  const parsed = parseCreatePlanInput(await request.json().catch(() => null));

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const result = await createServerTradePlan(parsed.value);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "not-configured" || result.storage === "missing-user" ? 503 : 500 }
    );
  }

  return NextResponse.json({ ok: true, plan: result.data, meta: { storage: result.storage } }, { status: 201 });
}

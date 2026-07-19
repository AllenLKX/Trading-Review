import { NextResponse } from "next/server";

import { createServerTradePlan, listServerTradePlans } from "@/lib/server/plan-repository";
import { parseCreateEntityIdentity, parseCreatePlanInput } from "@/lib/server/trade-validation";

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
  const body = await request.json().catch(() => null);
  const parsed = parseCreatePlanInput(body);
  const identity = parseCreateEntityIdentity(body);

  if (!parsed.ok || !identity.ok) {
    return NextResponse.json(
      { ok: false, errors: [...(!parsed.ok ? parsed.errors : []), ...(!identity.ok ? identity.errors : [])] },
      { status: 400 }
    );
  }

  const result = await createServerTradePlan(parsed.value, identity.value);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "not-configured" || result.storage === "missing-user" ? 503 : 500 }
    );
  }

  return NextResponse.json({ ok: true, plan: result.data, meta: { storage: result.storage } }, { status: 201 });
}

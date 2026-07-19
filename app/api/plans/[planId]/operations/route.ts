import { NextResponse } from "next/server";

import { createServerTradeOperation } from "@/lib/server/plan-repository";
import { parseCreateEntityIdentity, parseCreateOperationInput } from "@/lib/server/trade-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { planId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseCreateOperationInput(body);
  const identity = parseCreateEntityIdentity(body);

  if (!parsed.ok || !identity.ok) {
    return NextResponse.json(
      { ok: false, errors: [...(!parsed.ok ? parsed.errors : []), ...(!identity.ok ? identity.errors : [])] },
      { status: 400 }
    );
  }

  const result = await createServerTradeOperation(planId, parsed.value, identity.value);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "not-found" ? 404 : result.storage === "error" ? 500 : 503 }
    );
  }

  return NextResponse.json({ ok: true, operation: result.data, meta: { storage: result.storage } }, { status: 201 });
}

import { NextResponse } from "next/server";

import { createServerPlanReview } from "@/lib/server/plan-repository";
import { parseCreateReviewInput } from "@/lib/server/trade-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { planId } = await context.params;
  const parsed = parseCreateReviewInput(await request.json().catch(() => null));

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const result = await createServerPlanReview(planId, parsed.value);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "not-found" ? 404 : result.storage === "error" ? 500 : 503 }
    );
  }

  return NextResponse.json({ ok: true, review: result.data, meta: { storage: result.storage } }, { status: 201 });
}

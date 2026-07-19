import { NextResponse } from "next/server";

import { deleteServerPlanReview, updateServerPlanReview } from "@/lib/server/plan-repository";
import { parseCreateReviewInput } from "@/lib/server/trade-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ planId: string; reviewId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { planId, reviewId } = await context.params;
  const parsed = parseCreateReviewInput(await request.json().catch(() => null));

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const result = await updateServerPlanReview(planId, reviewId, parsed.value);
  return mutationResponse(result, "review");
}

export async function DELETE(request: Request, context: RouteContext) {
  if (request.headers.get("x-confirm-delete") !== "true") {
    return NextResponse.json({ ok: false, errors: ["Deletion requires explicit confirmation."] }, { status: 428 });
  }

  const { planId, reviewId } = await context.params;
  const result = await deleteServerPlanReview(planId, reviewId);
  return mutationResponse(result, "deleted");
}

function mutationResponse(
  result: Awaited<ReturnType<typeof updateServerPlanReview>> | Awaited<ReturnType<typeof deleteServerPlanReview>>,
  field: "review" | "deleted"
) {
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "not-found" ? 404 : result.storage === "error" ? 500 : 503 }
    );
  }

  return NextResponse.json({ ok: true, [field]: result.data, meta: { storage: result.storage } });
}

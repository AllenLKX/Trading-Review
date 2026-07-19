import { NextResponse } from "next/server";

import { deleteServerTradeOperation, updateServerTradeOperation } from "@/lib/server/plan-repository";
import { parseCreateOperationInput } from "@/lib/server/trade-validation";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ planId: string; operationId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { planId, operationId } = await context.params;
  const parsed = parseCreateOperationInput(await request.json().catch(() => null));

  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const result = await updateServerTradeOperation(planId, operationId, parsed.value);
  return mutationResponse(result, "operation");
}

export async function DELETE(request: Request, context: RouteContext) {
  if (request.headers.get("x-confirm-delete") !== "true") {
    return NextResponse.json({ ok: false, errors: ["Deletion requires explicit confirmation."] }, { status: 428 });
  }

  const { planId, operationId } = await context.params;
  const result = await deleteServerTradeOperation(planId, operationId);
  return mutationResponse(result, "deleted");
}

function mutationResponse(
  result:
    | Awaited<ReturnType<typeof updateServerTradeOperation>>
    | Awaited<ReturnType<typeof deleteServerTradeOperation>>,
  field: "operation" | "deleted"
) {
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "not-found" ? 404 : result.storage === "error" ? 500 : 503 }
    );
  }

  return NextResponse.json({ ok: true, [field]: result.data, meta: { storage: result.storage } });
}

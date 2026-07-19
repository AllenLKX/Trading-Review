import { NextResponse } from "next/server";

import { listServerTradePlans } from "@/lib/server/plan-repository";

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

import { NextResponse } from "next/server";

import { importLocalTradeData } from "@/lib/server/plan-repository";
import { parseTradeDataFile } from "@/lib/trade-data-file";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.json().catch(() => null);

  try {
    const parsed = parseTradeDataFile(JSON.stringify(rawBody));
    const result = await importLocalTradeData(parsed.plans, parsed.auditReports);

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, meta: { storage: result.storage, message: result.message } },
        { status: result.storage === "error" ? 500 : 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      imported: result.imported,
      meta: {
        storage: result.storage
      }
    });
  } catch {
    return NextResponse.json({ ok: false, errors: ["Invalid RationalTrade data file."] }, { status: 400 });
  }
}

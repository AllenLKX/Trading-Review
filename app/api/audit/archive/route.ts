import { NextResponse } from "next/server";

import { createServerAuditReport } from "@/lib/server/audit-repository";
import { parseAuditReportInput } from "@/lib/server/audit-validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = parseAuditReportInput(await request.json().catch(() => null));
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, errors: parsed.errors }, { status: 400 });
  }

  const result = await createServerAuditReport(parsed.value);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "error" ? 500 : 503 }
    );
  }

  return NextResponse.json({ ok: true, report: result.data, meta: { storage: result.storage } }, { status: 201 });
}

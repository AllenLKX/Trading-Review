import { NextResponse } from "next/server";

import { deleteServerAuditReport } from "@/lib/server/audit-repository";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  if (request.headers.get("x-confirm-delete") !== "true") {
    return NextResponse.json({ ok: false, errors: ["Deletion requires explicit confirmation."] }, { status: 428 });
  }

  const { reportId } = await context.params;
  const result = await deleteServerAuditReport(reportId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status: result.storage === "not-found" ? 404 : result.storage === "error" ? 500 : 503 }
    );
  }

  return NextResponse.json({ ok: true, deleted: result.data, meta: { storage: result.storage } });
}

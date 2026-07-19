import { NextResponse } from "next/server";

import { listServerAuditReports } from "@/lib/server/audit-repository";

export const runtime = "nodejs";

export async function GET() {
  const result = await listServerAuditReports();
  return NextResponse.json({
    ok: result.storage !== "error",
    reports: result.reports,
    meta: {
      storage: result.storage,
      count: result.reports.length,
      message: result.message
    }
  });
}

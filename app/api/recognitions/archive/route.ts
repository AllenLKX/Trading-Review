import { NextResponse } from "next/server";

import { archiveServerScreenshotBatch } from "@/lib/server/plan-repository";
import type { ScreenshotArchiveBatch } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const result = await archiveServerScreenshotBatch(body as ScreenshotArchiveBatch);

  if (!result.ok) {
    const status =
      result.storage === "validation"
        ? 400
        : result.storage === "not-found"
          ? 404
          : result.storage === "error"
            ? 500
            : 503;
    return NextResponse.json(
      { ok: false, meta: { storage: result.storage, message: result.message } },
      { status }
    );
  }

  return NextResponse.json({ ok: true, ...result.data, meta: { storage: result.storage } });
}

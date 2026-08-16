import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { recordAppEvent } from "@/lib/server/events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || body.eventName !== "page_view") {
    return NextResponse.json({ ok: false, error: "Unsupported event." }, { status: 400 });
  }

  const requestHeaders = await headers();
  await recordAppEvent({
    eventName: "page_view",
    userId: requestHeaders.get("x-rationaltrade-user-id") ?? undefined,
    sessionId: requestHeaders.get("x-rationaltrade-session-id") ?? undefined,
    anonymousId: typeof body.anonymousId === "string" ? body.anonymousId : undefined,
    path: typeof body.path === "string" ? body.path : undefined,
    metadata: { referrerHost: typeof body.referrerHost === "string" ? body.referrerHost.slice(0, 120) : undefined }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}

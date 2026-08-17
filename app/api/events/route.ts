import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { readAdtag, recordAppEvent } from "@/lib/server/events";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Unsupported event." }, { status: 400 });
  }

  const requestHeaders = await headers();
  if (body.eventName === "support_qr_opened") {
    const userId = requestHeaders.get("x-rationaltrade-user-id");
    const sessionId = requestHeaders.get("x-rationaltrade-session-id");
    if (!userId || !sessionId) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }
    await recordAppEvent({ eventName: "support_qr_opened", userId, sessionId, path: "/" });
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  if (body.eventName !== "page_view") {
    return NextResponse.json({ ok: false, error: "Unsupported event." }, { status: 400 });
  }

  await recordAppEvent({
    eventName: "page_view",
    userId: requestHeaders.get("x-rationaltrade-user-id") ?? undefined,
    sessionId: requestHeaders.get("x-rationaltrade-session-id") ?? undefined,
    anonymousId: typeof body.anonymousId === "string" ? body.anonymousId : undefined,
    path: typeof body.path === "string" ? body.path : undefined,
    metadata: {
      adtag: readAdtag(body),
      referrerHost: typeof body.referrerHost === "string" ? body.referrerHost.slice(0, 120) : undefined
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/server/auth-http";
import { revokeDatabaseSession } from "@/lib/server/auth-repository";
import { recordAppEvent } from "@/lib/server/events";

export const runtime = "nodejs";

export async function POST() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-rationaltrade-user-id");
  const sessionId = requestHeaders.get("x-rationaltrade-session-id");
  if (userId && sessionId) {
    await revokeDatabaseSession(sessionId, userId);
    await recordAppEvent({ eventName: "auth_logged_out", userId, sessionId, path: "/" });
  }
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);
  return response;
}

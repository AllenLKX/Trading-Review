import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { readActiveSession } from "@/lib/server/auth-repository";

export const runtime = "nodejs";

export async function GET() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("x-rationaltrade-user-id");
  const sessionId = requestHeaders.get("x-rationaltrade-session-id");
  const user = userId && sessionId ? await readActiveSession(sessionId, userId) : null;
  if (!user) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  return NextResponse.json({ ok: true, user });
}

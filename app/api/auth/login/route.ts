import { NextResponse } from "next/server";

import { attachNewSession } from "@/lib/server/auth-http";
import { authenticateAccount, validateCredentialsInput } from "@/lib/server/auth-repository";
import { recordAppEvent } from "@/lib/server/events";
import { checkAuthRateLimit } from "@/lib/server/auth-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request, "login");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "尝试次数过多，请稍后再试。" },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } }
    );
  }
  const input = validateCredentialsInput(await request.json().catch(() => null));
  if (!input) {
    await recordAppEvent({ eventName: "auth_login_failed", path: "/login", metadata: { reason: "invalid-input" } });
    return NextResponse.json({ ok: false, error: "邮箱或密码不正确。" }, { status: 400 });
  }

  const result = await authenticateAccount(input.email, input.password);
  if (!result.ok) {
    await recordAppEvent({ eventName: "auth_login_failed", path: "/login", metadata: { reason: result.reason } });
    return NextResponse.json({ ok: false, error: "邮箱或密码不正确。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, user: result.user });
  const session = await attachNewSession(response, result.user);
  await recordAppEvent({ eventName: "auth_login_succeeded", userId: result.user.id, sessionId: session.id, path: "/login" });
  return response;
}

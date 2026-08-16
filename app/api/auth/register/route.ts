import { NextResponse } from "next/server";

import { attachNewSession } from "@/lib/server/auth-http";
import { registerAccount, validateCredentialsInput } from "@/lib/server/auth-repository";
import { recordAppEvent } from "@/lib/server/events";
import { checkAuthRateLimit } from "@/lib/server/auth-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request, "register");
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "注册尝试过多，请稍后再试。" },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } }
    );
  }
  const input = validateCredentialsInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json({ ok: false, error: "请输入有效邮箱，密码至少 8 位。" }, { status: 400 });
  }

  const result = await registerAccount(input.email, input.password);
  if (!result.ok) {
    const disabled = result.reason === "registration-disabled";
    return NextResponse.json(
      { ok: false, error: disabled ? "注册暂未开放。" : "该邮箱已经注册。" },
      { status: disabled ? 403 : 409 }
    );
  }

  const response = NextResponse.json({ ok: true, user: result.user }, { status: 201 });
  const session = await attachNewSession(response, result.user);
  await recordAppEvent({ eventName: "auth_registered", userId: result.user.id, sessionId: session.id, path: "/register" });
  return response;
}

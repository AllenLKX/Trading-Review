import type { NextResponse } from "next/server";

import { createSignedSession, SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { createDatabaseSession, type AuthUser } from "@/lib/server/auth-repository";

const MILLISECONDS_PER_SECOND = 1000;

export async function attachNewSession(response: NextResponse, user: AuthUser) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters.");

  const session = await createDatabaseSession(user.id);
  const value = await createSignedSession(
    { userId: user.id, sessionId: session.id, expiresAt: session.expiresAt.getTime() },
    secret
  );
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / MILLISECONDS_PER_SECOND)),
    expires: session.expiresAt
  });
  return session;
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0)
  });
}

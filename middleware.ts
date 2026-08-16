import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth-session";

const PUBLIC_ASSET_PATHS = new Set([
  "/api/health",
  "/apple-icon",
  "/icon",
  "/manifest.webmanifest",
  "/offline.html",
  "/sw.js"
]);
const SESSION_PUBLIC_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/events",
  "/login",
  "/register"
]);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (PUBLIC_ASSET_PATHS.has(path)) return NextResponse.next();

  if (process.env.AUTH_MODE !== "session") {
    return applyBasicAuth(request);
  }

  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { ok: false, error: "Session authentication is not configured." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const session = await verifySignedSession(request.cookies.get(SESSION_COOKIE_NAME)?.value, secret);
  if (SESSION_PUBLIC_PATHS.has(path)) {
    if (session && (path === "/login" || path === "/register")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return session ? nextWithSession(request, session) : NextResponse.next();
  }

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return nextWithSession(request, session);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"]
};

function nextWithSession(request: NextRequest, session: { userId: string; sessionId: string }) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-rationaltrade-user-id", session.userId);
  requestHeaders.set("x-rationaltrade-session-id", session.sessionId);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function applyBasicAuth(request: NextRequest) {
  const username = process.env.APP_ACCESS_USERNAME;
  const password = process.env.APP_ACCESS_PASSWORD;
  if (!username || !password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return NextResponse.json(
      { ok: false, error: "Private access is not configured." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const credentials = readBasicCredentials(request.headers.get("authorization"));
  if (
    credentials &&
    constantTimeEqual(credentials.username, username) &&
    constantTimeEqual(credentials.password, password)
  ) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "cache-control": "no-store",
      "www-authenticate": 'Basic realm="RationalTrade", charset="UTF-8"'
    }
  });
}

function readBasicCredentials(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

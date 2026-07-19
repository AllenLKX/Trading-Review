import { NextRequest, NextResponse } from "next/server";

const ACCESS_USERNAME = process.env.APP_ACCESS_USERNAME;
const ACCESS_PASSWORD = process.env.APP_ACCESS_PASSWORD;

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") {
    return NextResponse.next();
  }

  if (!ACCESS_USERNAME || !ACCESS_PASSWORD) {
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.next();
    }

    return NextResponse.json(
      { ok: false, error: "Private access is not configured." },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const credentials = readBasicCredentials(request.headers.get("authorization"));
  if (
    credentials &&
    constantTimeEqual(credentials.username, ACCESS_USERNAME) &&
    constantTimeEqual(credentials.password, ACCESS_PASSWORD)
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"]
};

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

import { NextResponse } from "next/server";

export function GET() {
  // Health check is intentionally lightweight: Tencent Cloud/Nginx/PM2 can call it
  // without touching user data, database connections, AI services, or COS.
  return NextResponse.json({
    ok: true,
    service: "rationaltrade",
    version: process.env.APP_VERSION ?? process.env.NEXT_PUBLIC_APP_VERSION ?? "local-dev",
    environment: process.env.NODE_ENV ?? "development",
    checkedAt: new Date().toISOString()
  });
}

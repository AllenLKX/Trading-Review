import { NextResponse } from "next/server";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "local-dev";

export function GET() {
  // Health check is intentionally lightweight: Tencent Cloud/Nginx/PM2 can call it
  // without touching user data, database connections, AI services, or COS.
  return NextResponse.json({
    ok: true,
    service: "rationaltrade",
    version: APP_VERSION,
    environment: process.env.NODE_ENV ?? "development",
    checkedAt: new Date().toISOString()
  });
}

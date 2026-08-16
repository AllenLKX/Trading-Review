import { NextRequest, NextResponse } from "next/server";

import { checkDatabaseConnection, isDatabaseConfigured } from "@/lib/server/db";
import { readServerRuntimeConfig } from "@/lib/server/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = readServerRuntimeConfig();
  const shouldCheckDatabase = request.nextUrl.searchParams.get("db") === "1";

  const database = shouldCheckDatabase
    ? await checkDatabaseConnection()
    : {
        configured: isDatabaseConfigured(),
        checked: false
      };

  return NextResponse.json({
    ok: true,
    service: "rationaltrade",
    version: config.appVersion,
    environment: config.nodeEnv,
    integrations: {
      access: config.access,
      database: {
        ...database,
        singleUserConfigured: config.database.singleUserConfigured
      },
      ai: config.ai,
      vision: config.vision,
      cos: config.cos
    },
    checkedAt: new Date().toISOString()
  });
}

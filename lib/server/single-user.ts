import { isDatabaseConfigured } from "@/lib/server/db";
import { headers } from "next/headers";

import { readActiveSession } from "@/lib/server/auth-repository";

export type ConfiguredUserResult =
  | { ok: true; userId: string }
  | { ok: false; storage: "not-configured" | "missing-user"; message: string };

export async function getConfiguredUserId(): Promise<ConfiguredUserResult> {
  if (!isDatabaseConfigured()) {
    return { ok: false, storage: "not-configured", message: "DATABASE_URL is not configured." };
  }

  if (process.env.AUTH_MODE === "session") {
    const requestHeaders = await headers();
    const userId = requestHeaders.get("x-rationaltrade-user-id");
    const sessionId = requestHeaders.get("x-rationaltrade-session-id");
    if (!userId || !sessionId || !(await readActiveSession(sessionId, userId))) {
      return { ok: false, storage: "missing-user", message: "An active login session is required." };
    }
    return { ok: true, userId };
  }

  const userId = process.env.RATIONALTRADE_SINGLE_USER_ID;

  if (!userId) {
    return {
      ok: false,
      storage: "missing-user",
      message: "RATIONALTRADE_SINGLE_USER_ID is not configured."
    };
  }

  return { ok: true, userId };
}

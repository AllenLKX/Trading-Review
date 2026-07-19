import { isDatabaseConfigured } from "@/lib/server/db";

export type ConfiguredUserResult =
  | { ok: true; userId: string }
  | { ok: false; storage: "not-configured" | "missing-user"; message: string };

export function getConfiguredUserId(): ConfiguredUserResult {
  if (!isDatabaseConfigured()) {
    return { ok: false, storage: "not-configured", message: "DATABASE_URL is not configured." };
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

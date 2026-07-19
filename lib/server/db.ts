import { Pool } from "pg";

type DatabaseCheckResult =
  | {
      configured: false;
      checked: false;
      ok: false;
      message: string;
    }
  | {
      configured: true;
      checked: true;
      ok: true;
      latencyMs: number;
    }
  | {
      configured: true;
      checked: true;
      ok: false;
      message: string;
    };

let pool: Pool | null = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    // Keep the pool small for the first Tencent Cloud CVM deployment.
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    });
  }

  return pool;
}

export async function checkDatabaseConnection(): Promise<DatabaseCheckResult> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      checked: false,
      ok: false,
      message: "DATABASE_URL is not configured."
    };
  }

  const startedAt = Date.now();

  try {
    await getDatabasePool().query("select 1");

    return {
      configured: true,
      checked: true,
      ok: true,
      latencyMs: Date.now() - startedAt
    };
  } catch {
    return {
      configured: true,
      checked: true,
      ok: false,
      message: "Database connection failed."
    };
  }
}

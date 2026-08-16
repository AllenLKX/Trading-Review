import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import { getDatabasePool } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/password";

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
};

export const DEFAULT_SESSION_DAYS = 7;

type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: "invalid-input" | "email-exists" | "invalid-credentials" | "registration-disabled" };

export function validateCredentialsInput(raw: unknown) {
  const data = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const password = typeof data.password === "string" ? data.password : "";

  if (!email || email.length > 254 || !email.includes("@") || password.length < 8 || password.length > 128) {
    return null;
  }
  return { email, password };
}

export async function registerAccount(email: string, password: string): Promise<AuthResult> {
  if (process.env.AUTH_ALLOW_REGISTRATION !== "true") {
    return { ok: false, reason: "registration-disabled" };
  }

  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const existing = await client.query("select 1 from profiles where email = $1 limit 1", [email]);
    if (existing.rowCount) {
      await client.query("rollback");
      return { ok: false, reason: "email-exists" };
    }

    const user: AuthUser = {
      id: randomUUID(),
      email,
      displayName: email.split("@")[0]
    };
    const passwordHash = await hashPassword(password);
    await client.query(
      `insert into profiles (id, email, display_name) values ($1, $2, $3)`,
      [user.id, user.email, user.displayName]
    );
    await client.query(`insert into auth_credentials (user_id, password_hash) values ($1, $2)`, [user.id, passwordHash]);
    await client.query("commit");
    return { ok: true, user };
  } catch (error) {
    await rollbackQuietly(client);
    if (isUniqueViolation(error)) return { ok: false, reason: "email-exists" };
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticateAccount(email: string, password: string): Promise<AuthResult> {
  const result = await getDatabasePool().query<{
    id: string;
    email: string;
    display_name: string | null;
    password_hash: string;
  }>(
    `select p.id, p.email, p.display_name, c.password_hash
     from profiles p join auth_credentials c on c.user_id = p.id
     where p.email = $1 limit 1`,
    [email]
  );
  const row = result.rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return { ok: false, reason: "invalid-credentials" };
  }
  return { ok: true, user: { id: row.id, email: row.email, displayName: row.display_name ?? undefined } };
}

export async function createDatabaseSession(userId: string) {
  const id = randomUUID();
  const days = readSessionDays();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await getDatabasePool().query(
    `delete from auth_sessions where user_id = $1 and (expires_at <= now() or revoked_at is not null)`,
    [userId]
  );
  await getDatabasePool().query(
    `insert into auth_sessions (id, user_id, expires_at) values ($1, $2, $3)`,
    [id, userId, expiresAt]
  );
  return { id, expiresAt };
}

export async function revokeDatabaseSession(sessionId: string, userId: string) {
  await getDatabasePool().query(
    `update auth_sessions set revoked_at = now() where id = $1 and user_id = $2 and revoked_at is null`,
    [sessionId, userId]
  );
}

export async function readActiveSession(sessionId: string, userId: string) {
  const result = await getDatabasePool().query<{
    id: string;
    email: string;
    display_name: string | null;
  }>(
    `select p.id, p.email, p.display_name
     from auth_sessions s join profiles p on p.id = s.user_id
     where s.id = $1 and s.user_id = $2 and s.revoked_at is null and s.expires_at > now()
     limit 1`,
    [sessionId, userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.display_name ?? undefined } satisfies AuthUser;
}

function readSessionDays() {
  const parsed = Number(process.env.AUTH_SESSION_DAYS ?? String(DEFAULT_SESSION_DAYS));
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 365 ? parsed : DEFAULT_SESSION_DAYS;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

async function rollbackQuietly(client: PoolClient) {
  await client.query("rollback").catch(() => undefined);
}

import { scrypt as scryptCallback, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(scryptCallback);
const databaseUrl = process.env.DATABASE_URL;
const userId = process.env.RATIONALTRADE_SINGLE_USER_ID;
const [emailLine, passwordLine] = (await readStandardInput()).split(/\r?\n/);
const email = emailLine?.trim().toLowerCase();
const password = passwordLine ?? "";

if (!databaseUrl || !userId) throw new Error("DATABASE_URL and RATIONALTRADE_SINGLE_USER_ID are required.");
if (!email || !email.includes("@") || email.length > 254) throw new Error("Enter a valid email address.");
if (password.length < 8 || password.length > 128) throw new Error("Password must contain 8-128 characters.");

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query("begin");
  const profile = await client.query("select id from profiles where id = $1 for update", [userId]);
  if (profile.rowCount !== 1) throw new Error("Configured owner profile was not found.");
  const conflict = await client.query("select id from profiles where email = $1 and id <> $2 limit 1", [email, userId]);
  if (conflict.rowCount) throw new Error("Email is already used by another account.");

  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  const passwordHash = `scrypt$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
  await client.query(`update profiles set email = $2, display_name = coalesce(display_name, $3), updated_at = now() where id = $1`, [
    userId,
    email,
    email.split("@")[0]
  ]);
  await client.query(
    `insert into auth_credentials (user_id, password_hash) values ($1, $2)
     on conflict (user_id) do update set password_hash = excluded.password_hash, updated_at = now()`,
    [userId, passwordHash]
  );
  await client.query(`update auth_sessions set revoked_at = now() where user_id = $1 and revoked_at is null`, [userId]);
  await client.query(
    `insert into app_events (user_id, event_name, path, metadata)
     values ($1, 'owner_account_bootstrapped', '/server', '{}'::jsonb)`,
    [userId]
  );
  await client.query("commit");
  console.log(`Owner account is ready for ${maskEmail(email)}. Existing data remains attached to ${userId}.`);
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}

async function readStandardInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function maskEmail(value) {
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

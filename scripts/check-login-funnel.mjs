import { execFileSync } from "node:child_process";

import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const timeZone = process.env.REPORT_TIMEZONE ?? "Asia/Shanghai";
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const date = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const convertedId = `funnel-converted-${runId}`;
const stalledId = `funnel-stalled-${runId}`;
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  const before = readReport(date).loginFunnel;
  await pool.query(
    `insert into app_events (anonymous_id, event_name, path) values
       ($1, 'page_view', '/login'),
       ($1, 'page_view', '/login'),
       ($2, 'page_view', '/login'),
       ($1, 'auth_registered', '/register')`,
    [convertedId, stalledId]
  );
  const after = readReport(date).loginFunnel;

  assert(after.login_page_uv === before.login_page_uv + 2, "Login page visitors were not deduplicated by anonymous ID.");
  assert(after.entered_product_uv === before.entered_product_uv + 1, "Converted login visitor was not counted.");
  assert(after.stalled_login_uv === before.stalled_login_uv + 1, "Stalled login visitor was not counted.");
  console.log("Login page funnel deduplication and conversion verification passed.");
} finally {
  await pool.query("delete from app_events where anonymous_id = any($1::text[])", [[convertedId, stalledId]]);
  await pool.end();
}

function readReport(reportDate) {
  const output = execFileSync(process.execPath, ["scripts/report-daily.mjs", reportDate], {
    encoding: "utf8",
    env: process.env
  });
  return JSON.parse(output);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

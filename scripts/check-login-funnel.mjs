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
const adtag = `share-${runId}`;
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  const beforeReport = readReport(date);
  const before = beforeReport.loginFunnel;
  await pool.query(
    `insert into app_events (anonymous_id, event_name, path, metadata) values
       ($1, 'page_view', '/login', jsonb_build_object('adtag', $3::text)),
       ($1, 'page_view', '/login', jsonb_build_object('adtag', $3::text)),
       ($2, 'page_view', '/login', jsonb_build_object('adtag', $3::text)),
       ($1, 'auth_registered', '/register', jsonb_build_object('adtag', $3::text))`,
    [convertedId, stalledId, adtag]
  );
  const afterReport = readReport(date);
  const after = afterReport.loginFunnel;
  const source = afterReport.trafficSources.find((item) => item.adtag === adtag);

  assert(after.login_page_uv === before.login_page_uv + 2, "Login page visitors were not deduplicated by anonymous ID.");
  assert(after.entered_product_uv === before.entered_product_uv + 1, "Converted login visitor was not counted.");
  assert(after.stalled_login_uv === before.stalled_login_uv + 1, "Stalled login visitor was not counted.");
  assert(source?.pv === 3 && source?.uv === 2 && source?.registrations === 1, "Adtag traffic source totals were incorrect.");
  console.log("Login funnel and adtag traffic source verification passed.");
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

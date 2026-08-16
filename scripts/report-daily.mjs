import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const requestedDate = process.argv.slice(2).find((argument) => argument !== "--");
const date = requestedDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const timeZone = process.env.REPORT_TIMEZONE ?? "Asia/Shanghai";
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must use YYYY-MM-DD.");

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  const [summary, eventCounts, activity] = await Promise.all([
    pool.query(
      `select
         count(*) filter (where event_name = 'page_view')::int as pv,
         count(distinct coalesce(user_id, case when anonymous_id is not null then 'anon:' || anonymous_id end))
           filter (where event_name = 'page_view')::int as uv,
         count(*) filter (where event_name = 'auth_registered')::int as registrations,
         count(*) filter (where event_name = 'auth_login_succeeded')::int as successful_logins,
         count(*) filter (where event_name = 'auth_login_failed')::int as failed_logins,
         count(*) filter (where event_name in ('ai_audit_generated', 'ai_screenshot_recognized'))::int as ai_calls,
         coalesce(sum((metadata->>'promptTokens')::int) filter (where event_name in ('ai_audit_generated', 'ai_screenshot_recognized')), 0)::int as prompt_tokens,
         coalesce(sum((metadata->>'completionTokens')::int) filter (where event_name in ('ai_audit_generated', 'ai_screenshot_recognized')), 0)::int as completion_tokens,
         coalesce(sum((metadata->>'totalTokens')::int) filter (where event_name in ('ai_audit_generated', 'ai_screenshot_recognized')), 0)::int as total_tokens
       from app_events where (occurred_at at time zone $1)::date = $2::date`,
      [timeZone, date]
    ),
    pool.query(
      `select event_name, count(*)::int as count
       from app_events where (occurred_at at time zone $1)::date = $2::date
       group by event_name order by count desc, event_name`,
      [timeZone, date]
    ),
    pool.query(
      `select to_char(e.occurred_at at time zone $1, 'HH24:MI:SS') as time,
              e.event_name, p.email, e.path, e.metadata
       from app_events e left join profiles p on p.id = e.user_id
       where (e.occurred_at at time zone $1)::date = $2::date
       order by e.occurred_at desc limit 300`,
      [timeZone, date]
    )
  ]);

  console.log(JSON.stringify({ date, timeZone, summary: summary.rows[0], eventCounts: eventCounts.rows, activity: activity.rows }, null, 2));
} finally {
  await pool.end();
}

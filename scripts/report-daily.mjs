import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
const requestedDate = process.argv.slice(2).find((argument) => argument !== "--");
const date = requestedDate ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
const timeZone = process.env.REPORT_TIMEZONE ?? "Asia/Shanghai";
const loginFunnelTrackingStartedAt = "2026-08-16T11:56:00Z";
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must use YYYY-MM-DD.");

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  const [summary, loginFunnel, trafficSources, eventCounts, activity] = await Promise.all([
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
      `with login_visitors as (
         select anonymous_id, min(occurred_at) as first_seen_at
         from app_events
         where event_name = 'page_view' and path = '/login' and anonymous_id is not null
           and occurred_at >= $3::timestamptz
           and (occurred_at at time zone $1)::date = $2::date
         group by anonymous_id
       ), converted_visitors as (
         select distinct visitor.anonymous_id
         from login_visitors visitor
         join app_events event on event.anonymous_id = visitor.anonymous_id
           and event.event_name in ('auth_registered', 'auth_login_succeeded')
           and event.occurred_at >= visitor.first_seen_at
       )
       select
         $3::timestamptz as tracking_started_at,
         count(*)::int as login_page_uv,
         count(converted.anonymous_id)::int as entered_product_uv,
         (count(*) - count(converted.anonymous_id))::int as stalled_login_uv,
         case when count(*) = 0 then 0
           else round(100.0 * (count(*) - count(converted.anonymous_id)) / count(*), 1)::float8
         end as stalled_rate_percent
       from login_visitors visitor
       left join converted_visitors converted on converted.anonymous_id = visitor.anonymous_id`,
      [timeZone, date, loginFunnelTrackingStartedAt]
    ),
    pool.query(
      `select metadata->>'adtag' as adtag,
              count(*) filter (where event_name = 'page_view')::int as pv,
              count(distinct coalesce(user_id, case when anonymous_id is not null then 'anon:' || anonymous_id end))
                filter (where event_name = 'page_view')::int as uv,
              count(*) filter (where event_name = 'auth_registered')::int as registrations,
              count(*) filter (where event_name = 'auth_login_succeeded')::int as successful_logins
       from app_events
       where (occurred_at at time zone $1)::date = $2::date
         and nullif(metadata->>'adtag', '') is not null
       group by metadata->>'adtag'
       order by uv desc, pv desc, adtag`,
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

  console.log(
    JSON.stringify(
      {
        date,
        timeZone,
        summary: summary.rows[0],
        loginFunnel: loginFunnel.rows[0],
        trafficSources: trafficSources.rows,
        eventCounts: eventCounts.rows,
        activity: activity.rows
      },
      null,
      2
    )
  );
} finally {
  await pool.end();
}

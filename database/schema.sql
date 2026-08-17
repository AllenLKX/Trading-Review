-- RationalTrade Backend M1 initial PostgreSQL schema.
-- This file is safe to commit: it contains structure only, no secrets or user data.

create extension if not exists pgcrypto;

do $$
begin
  create type plan_status as enum ('active', 'closed', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type trade_action as enum ('buy', 'sell', 'observe');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type trade_source as enum ('manual', 'ai_screenshot', 'sample');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type quantity_unit as enum ('shares', 'units');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type realized_result as enum ('met', 'partial', 'missed', 'profit', 'loss', 'breakeven', 'unknown');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type audit_signal_level as enum ('stable', 'watch', 'risk');
exception
  when duplicate_object then null;
end $$;

create table if not exists profiles (
  id text primary key default gen_random_uuid()::text,
  email text unique,
  display_name text,
  onboarding_step smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles add column if not exists onboarding_step smallint not null default 0;

do $$
begin
  alter table profiles add constraint profiles_onboarding_step_check check (onboarding_step between 0 and 4);
exception
  when duplicate_object then null;
end $$;

create table if not exists auth_credentials (
  user_id text primary key references profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists app_events (
  id bigint generated always as identity primary key,
  user_id text references profiles(id) on delete set null,
  anonymous_id text,
  session_id text,
  event_name text not null,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists trade_plans (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references profiles(id) on delete cascade,
  title text not null,
  asset_name text not null,
  ticker text not null,
  market text not null default '',
  currency char(3) not null,
  status plan_status not null default 'active',
  thesis text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trade_operations (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references profiles(id) on delete cascade,
  plan_id text not null references trade_plans(id) on delete cascade,
  action trade_action not null,
  trade_time timestamptz not null,
  currency char(3) not null,
  price numeric(20, 6),
  quantity numeric(20, 6),
  quantity_unit quantity_unit,
  total_amount numeric(20, 2),
  take_profit_price numeric(20, 6),
  stop_loss_price numeric(20, 6),
  decision_reason text not null default '',
  psychology_note text,
  emotion_tags text[] not null default '{}',
  strategy_tags text[] not null default '{}',
  source trade_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trade_operations_observe_has_no_quantity check (
    action <> 'observe'
    or (quantity is null and quantity_unit is null and total_amount is null)
  ),
  constraint trade_operations_quantity_pair check (
    (quantity is null and quantity_unit is null)
    or (quantity is not null and quantity_unit is not null)
  )
);

create table if not exists plan_reviews (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references profiles(id) on delete cascade,
  plan_id text not null references trade_plans(id) on delete cascade,
  review_time timestamptz not null,
  operation_ids text[] not null default '{}',
  realized_result realized_result not null default 'unknown',
  profit_loss numeric(20, 2),
  violated_rules text[] not null default '{}',
  review_note text not null default '',
  emotion_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_reports (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  title text not null,
  summary text not null,
  signal_label text not null,
  signal_level audit_signal_level not null,
  metrics jsonb not null default '{}'::jsonb,
  ai_input_digest text[] not null default '{}',
  findings text[] not null default '{}',
  review_questions text[] not null default '{}',
  source text not null default 'mock-local',
  generation jsonb not null default '{"source":"legacy","provider":"unknown","promptVersion":"unknown","status":"legacy"}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_reports_period_order check (period_start <= period_end)
);

alter table audit_reports
  add column if not exists generation jsonb not null
  default '{"source":"legacy","provider":"unknown","promptVersion":"unknown","status":"legacy"}'::jsonb;

-- These tables are not implemented in the H5 flow yet, but reserving them avoids
-- a future data migration when user-defined rules and AI review records are added.
create table if not exists trading_rules (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references profiles(id) on delete cascade,
  title text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_reviews (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references profiles(id) on delete cascade,
  plan_id text references trade_plans(id) on delete cascade,
  operation_id text references trade_operations(id) on delete cascade,
  review_id text references plan_reviews(id) on delete cascade,
  audit_report_id text references audit_reports(id) on delete set null,
  summary text not null,
  findings text[] not null default '{}',
  questions text[] not null default '{}',
  source text not null default 'ai',
  created_at timestamptz not null default now()
);

create index if not exists trade_plans_user_status_idx on trade_plans(user_id, status, updated_at desc);
create index if not exists trade_operations_user_plan_time_idx on trade_operations(user_id, plan_id, trade_time desc);
create index if not exists plan_reviews_user_plan_time_idx on plan_reviews(user_id, plan_id, review_time desc);
create index if not exists audit_reports_user_period_idx on audit_reports(user_id, period_end desc, period_start desc);
create index if not exists trading_rules_user_active_idx on trading_rules(user_id, is_active);
create index if not exists ai_reviews_user_created_idx on ai_reviews(user_id, created_at desc);
create index if not exists auth_sessions_user_expiry_idx on auth_sessions(user_id, expires_at desc);
create index if not exists auth_sessions_expiry_idx on auth_sessions(expires_at) where revoked_at is null;
create index if not exists app_events_time_name_idx on app_events(occurred_at desc, event_name);
create index if not exists app_events_user_time_idx on app_events(user_id, occurred_at desc);

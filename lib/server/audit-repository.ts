import type { QueryResultRow } from "pg";

import { getDatabasePool } from "@/lib/server/db";
import { getConfiguredUserId } from "@/lib/server/single-user";
import type { AuditGeneration, AuditReport } from "@/lib/types";

type AuditRow = QueryResultRow & {
  id: string;
  period_start: Date | string;
  period_end: Date | string;
  title: string;
  summary: string;
  signal_label: string;
  signal_level: AuditReport["signalLevel"];
  metrics: AuditReport["metrics"];
  ai_input_digest: string[];
  findings: string[];
  review_questions: string[];
  generation: AuditGeneration;
  created_at: Date | string;
};

type AuditListResult = {
  reports: AuditReport[];
  storage: "postgres" | "not-configured" | "missing-user" | "error";
  message?: string;
};

type AuditMutationResult<T> =
  | { ok: true; storage: "postgres"; data: T }
  | {
      ok: false;
      storage: "not-configured" | "missing-user" | "not-found" | "error";
      message: string;
    };

const auditColumns = `id, period_start, period_end, title, summary, signal_label, signal_level,
  metrics, ai_input_digest, findings, review_questions, generation, created_at`;

export async function listServerAuditReports(): Promise<AuditListResult> {
  const userResult = getConfiguredUserId();
  if (!userResult.ok) {
    return { reports: [], storage: userResult.storage, message: userResult.message };
  }

  try {
    const result = await getDatabasePool().query<AuditRow>(
      `select ${auditColumns} from audit_reports where user_id = $1 order by created_at desc limit 20`,
      [userResult.userId]
    );
    return { reports: result.rows.map(mapAuditRow), storage: "postgres" };
  } catch {
    return { reports: [], storage: "error", message: "Failed to load audit reports from PostgreSQL." };
  }
}

export async function createServerAuditReport(report: AuditReport): Promise<AuditMutationResult<AuditReport>> {
  const userResult = getConfiguredUserId();
  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<AuditRow>(
      `insert into audit_reports (
         id, user_id, period_start, period_end, title, summary, signal_label, signal_level,
         metrics, ai_input_digest, findings, review_questions, source, generation, created_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       on conflict (id) do update set
         period_start = excluded.period_start,
         period_end = excluded.period_end,
         title = excluded.title,
         summary = excluded.summary,
         signal_label = excluded.signal_label,
         signal_level = excluded.signal_level,
         metrics = excluded.metrics,
         ai_input_digest = excluded.ai_input_digest,
         findings = excluded.findings,
         review_questions = excluded.review_questions,
         source = excluded.source,
         generation = excluded.generation
       where audit_reports.user_id = excluded.user_id
       returning ${auditColumns}`,
      [
        report.id,
        userResult.userId,
        report.periodStart,
        report.periodEnd,
        report.title,
        report.summary,
        report.signalLabel,
        report.signalLevel,
        JSON.stringify(report.metrics),
        report.aiInputDigest,
        report.findings,
        report.reviewQuestions,
        report.generation?.source ?? "legacy",
        JSON.stringify(report.generation ?? legacyGeneration),
        report.createdAt
      ]
    );
    return { ok: true, storage: "postgres", data: mapAuditRow(result.rows[0]) };
  } catch {
    return { ok: false, storage: "error", message: "Failed to archive audit report in PostgreSQL." };
  }
}

export async function deleteServerAuditReport(reportId: string): Promise<AuditMutationResult<{ id: string }>> {
  const userResult = getConfiguredUserId();
  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<{ id: string }>(
      `delete from audit_reports where id = $1 and user_id = $2 returning id`,
      [reportId, userResult.userId]
    );
    if (result.rowCount !== 1) {
      return { ok: false, storage: "not-found", message: "Audit report was not found." };
    }

    return { ok: true, storage: "postgres", data: result.rows[0] };
  } catch {
    return { ok: false, storage: "error", message: "Failed to delete audit report from PostgreSQL." };
  }
}

function mapAuditRow(row: AuditRow): AuditReport {
  return {
    id: row.id,
    periodStart: toDateOnly(row.period_start),
    periodEnd: toDateOnly(row.period_end),
    title: row.title,
    summary: row.summary,
    signalLabel: row.signal_label,
    signalLevel: row.signal_level,
    metrics: row.metrics,
    aiInputDigest: row.ai_input_digest ?? [],
    findings: row.findings ?? [],
    reviewQuestions: row.review_questions ?? [],
    generation: row.generation ?? legacyGeneration,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString()
  };
}

const legacyGeneration: AuditGeneration = {
  source: "legacy",
  provider: "unknown",
  promptVersion: "unknown",
  status: "legacy"
};

function toDateOnly(value: Date | string) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

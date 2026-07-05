import { buildRollingAuditReport } from "@/lib/audit-summary";
import type { AuditReport, TradePlan } from "@/lib/types";

export type AuditAiRequest = {
  schemaVersion: 1;
  period: {
    start: string;
    end: string;
  };
  inputDigest: string[];
};

export function buildAuditReport(plans: TradePlan[]): AuditReport {
  return buildRollingAuditReport(plans);
}

export function buildAuditAiRequest(report: AuditReport): AuditAiRequest {
  return {
    schemaVersion: 1,
    period: {
      start: report.periodStart,
      end: report.periodEnd
    },
    inputDigest: report.aiInputDigest
  };
}

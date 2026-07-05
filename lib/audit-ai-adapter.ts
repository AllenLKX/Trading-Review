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

export type AuditApiResponse = {
  report: AuditReport;
  aiRequest: AuditAiRequest;
  source: "mock-local";
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

export async function requestAuditReport(plans: TradePlan[], signal?: AbortSignal): Promise<AuditApiResponse> {
  const response = await fetch("/api/audit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ plans }),
    signal
  });

  if (!response.ok) {
    throw new Error("审计接口暂时不可用。");
  }

  return response.json() as Promise<AuditApiResponse>;
}

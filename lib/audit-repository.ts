import { isAuditReportLike } from "@/lib/trade-data-file";
import type { AuditReport } from "@/lib/types";

const AUDIT_ARCHIVE_STORAGE_KEY = "rationaltrade.auditReports.v1";

export const localAuditRepository = {
  load(): AuditReport[] {
    try {
      const rawReports = window.localStorage.getItem(AUDIT_ARCHIVE_STORAGE_KEY);
      const parsedReports = rawReports ? (JSON.parse(rawReports) as unknown) : [];
      return Array.isArray(parsedReports) ? parsedReports.filter(isAuditReportLike) : [];
    } catch {
      return [];
    }
  },
  persist(reports: AuditReport[]) {
    window.localStorage.setItem(AUDIT_ARCHIVE_STORAGE_KEY, JSON.stringify(reports));
  }
};

export const cloudAuditRepository = {
  async load(): Promise<AuditReport[]> {
    const response = await fetch("/api/audit/reports");
    const result = (await response.json()) as {
      reports?: AuditReport[];
      meta?: { storage?: string; message?: string };
    };
    if (!response.ok || result.meta?.storage !== "postgres") {
      throw new Error(result.meta?.message ?? "读取云端审计归档失败。");
    }

    return Array.isArray(result.reports) ? result.reports.filter(isAuditReportLike) : [];
  },
  async archive(report: AuditReport): Promise<AuditReport> {
    const response = await fetch("/api/audit/archive", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report)
    });
    const result = (await response.json()) as { report?: AuditReport; meta?: { message?: string }; errors?: string[] };
    if (!response.ok || !result.report) {
      throw new Error(result.meta?.message ?? result.errors?.[0] ?? "云端归档审计失败。");
    }

    return result.report;
  },
  async delete(reportId: string): Promise<void> {
    const response = await fetch(`/api/audit/reports/${encodeURIComponent(reportId)}`, {
      method: "DELETE",
      headers: { "X-Confirm-Delete": "true" }
    });
    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      const result = (await response.json()) as { meta?: { message?: string }; errors?: string[] };
      throw new Error(result.meta?.message ?? result.errors?.[0] ?? "删除云端审计归档失败。");
    }
  }
};

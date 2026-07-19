import type { AuditReport } from "@/lib/types";

type ValidationResult = { ok: true; value: AuditReport } | { ok: false; errors: string[] };

const signalLevels: AuditReport["signalLevel"][] = ["stable", "watch", "risk"];
const metricFields: Array<keyof AuditReport["metrics"]> = [
  "emotionHeat",
  "delayedExitRate",
  "recordCount",
  "reviewCoverageRate",
  "violationRate"
];

export function parseAuditReportInput(raw: unknown): ValidationResult {
  const data = asRecord(raw);
  const metricsData = asRecord(data.metrics);
  const errors: string[] = [];
  const id = readString(data, "id", errors);
  const periodStart = readDate(data, "periodStart", errors, true);
  const periodEnd = readDate(data, "periodEnd", errors, true);
  const title = readString(data, "title", errors);
  const summary = readString(data, "summary", errors);
  const signalLabel = readString(data, "signalLabel", errors);
  const signalLevel = readSignalLevel(data.signalLevel, errors);
  const metrics = Object.fromEntries(
    metricFields.map((field) => [field, readNumber(metricsData, field, errors)])
  ) as AuditReport["metrics"];
  const aiInputDigest = readStringArray(data, "aiInputDigest", errors);
  const findings = readStringArray(data, "findings", errors);
  const reviewQuestions = readStringArray(data, "reviewQuestions", errors);
  const createdAt = readDate(data, "createdAt", errors, false);

  if (periodStart && periodEnd && periodStart > periodEnd) {
    errors.push("periodStart must be before or equal to periodEnd.");
  }

  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        value: {
          id,
          periodStart,
          periodEnd,
          title,
          summary,
          signalLabel,
          signalLevel,
          metrics,
          aiInputDigest,
          findings,
          reviewQuestions,
          createdAt
        }
      };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(data: Record<string, unknown>, field: string, errors: string[]) {
  const value = data[field];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  errors.push(`${field} is required.`);
  return "";
}

function readDate(data: Record<string, unknown>, field: string, errors: string[], dateOnly: boolean) {
  const value = data[field];
  if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
    errors.push(`${field} must be a valid date string.`);
    return "";
  }

  return dateOnly ? value.slice(0, 10) : new Date(value).toISOString();
}

function readSignalLevel(value: unknown, errors: string[]) {
  if (typeof value === "string" && signalLevels.includes(value as AuditReport["signalLevel"])) {
    return value as AuditReport["signalLevel"];
  }

  errors.push("signalLevel is invalid.");
  return "watch" as const;
}

function readNumber(data: Record<string, unknown>, field: string, errors: string[]) {
  const value = data[field];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  errors.push(`metrics.${field} must be a valid number.`);
  return 0;
}

function readStringArray(data: Record<string, unknown>, field: string, errors: string[]) {
  const value = data[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    errors.push(`${field} must be a string array.`);
    return [];
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

import type { AuditGeneration, AuditReport } from "@/lib/types";

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
  const generation = readGeneration(data.generation, errors);
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
          generation,
          createdAt
        }
      };
}

function readGeneration(value: unknown, errors: string[]): AuditGeneration {
  if (value === undefined) {
    return { source: "legacy", provider: "unknown", promptVersion: "unknown", status: "legacy" };
  }

  const data = asRecord(value);
  const source = data.source;
  const provider = data.provider;
  const promptVersion = data.promptVersion;
  const status = data.status;
  const model = data.model;
  const fallbackReason = data.fallbackReason;

  if (!(["deepseek", "local-rules", "legacy"] as unknown[]).includes(source)) errors.push("generation.source is invalid.");
  if (!(["deepseek", "local", "unknown"] as unknown[]).includes(provider)) errors.push("generation.provider is invalid.");
  if (typeof promptVersion !== "string" || !promptVersion.trim()) errors.push("generation.promptVersion is required.");
  if (!(["success", "fallback", "local", "legacy"] as unknown[]).includes(status)) errors.push("generation.status is invalid.");
  if (model !== undefined && typeof model !== "string") errors.push("generation.model must be a string.");
  if (
    fallbackReason !== undefined &&
    !(["not-configured", "timeout", "provider-error", "invalid-output"] as unknown[]).includes(fallbackReason)
  ) {
    errors.push("generation.fallbackReason is invalid.");
  }

  return {
    source: source === "deepseek" || source === "local-rules" ? source : "legacy",
    provider: provider === "deepseek" || provider === "local" ? provider : "unknown",
    model: typeof model === "string" ? model.trim() || undefined : undefined,
    promptVersion: typeof promptVersion === "string" ? promptVersion.trim() : "unknown",
    status: status === "success" || status === "fallback" || status === "local" ? status : "legacy",
    fallbackReason:
      fallbackReason === "not-configured" ||
      fallbackReason === "timeout" ||
      fallbackReason === "provider-error" ||
      fallbackReason === "invalid-output"
        ? fallbackReason
        : undefined
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

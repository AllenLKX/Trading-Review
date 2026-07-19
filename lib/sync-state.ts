import type { AuditReport, TradePlan } from "@/lib/types";

const SYNC_STATE_KEY = "rationaltrade.cloudSync.v2";
const WORKSPACE_MODE_KEY = "rationaltrade.workspaceMode.v1";

export type SyncDirection = "upload" | "download";
export type WorkspaceMode = "local" | "cloud";

export type SyncState = {
  baselineFingerprint: string;
  lastSuccessfulSyncAt: string;
  lastDirection: SyncDirection;
};

export type SyncAssessment = {
  localFingerprint: string;
  cloudFingerprint: string;
  localChanged: boolean;
  cloudChanged: boolean;
  requiresResolution: boolean;
  reason: "same" | "first-sync-difference" | "cloud-changed" | "local-changed";
};

export type TradeDataSnapshot = {
  plans: TradePlan[];
  auditReports: AuditReport[];
};

export function loadSyncState(): SyncState | null {
  try {
    const raw = window.localStorage.getItem(SYNC_STATE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SyncState>) : null;

    if (
      !parsed ||
      typeof parsed.baselineFingerprint !== "string" ||
      typeof parsed.lastSuccessfulSyncAt !== "string" ||
      (parsed.lastDirection !== "upload" && parsed.lastDirection !== "download")
    ) {
      return null;
    }

    return parsed as SyncState;
  } catch {
    return null;
  }
}

export function persistSyncState(state: SyncState) {
  window.localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(state));
}

export function loadWorkspaceMode(): WorkspaceMode {
  return window.localStorage.getItem(WORKSPACE_MODE_KEY) === "cloud" ? "cloud" : "local";
}

export function persistWorkspaceMode(mode: WorkspaceMode) {
  window.localStorage.setItem(WORKSPACE_MODE_KEY, mode);
}

export function fingerprintTradeData(plans: TradePlan[], auditReports: AuditReport[]) {
  const canonical = canonicalize({ plans, auditReports });
  const serialized = JSON.stringify(canonical);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${plans.length}:${auditReports.length}:${(hash >>> 0).toString(16)}`;
}

export function assessSyncState(
  localPlans: TradePlan[],
  localAuditReports: AuditReport[],
  cloudPlans: TradePlan[],
  cloudAuditReports: AuditReport[],
  syncState: SyncState | null
): SyncAssessment {
  const localFingerprint = fingerprintTradeData(localPlans, localAuditReports);
  const cloudFingerprint = fingerprintTradeData(cloudPlans, cloudAuditReports);

  if (localFingerprint === cloudFingerprint) {
    return {
      localFingerprint,
      cloudFingerprint,
      localChanged: false,
      cloudChanged: false,
      requiresResolution: false,
      reason: "same"
    };
  }

  if (!syncState) {
    const cloudHasData = cloudPlans.length > 0 || cloudAuditReports.length > 0;
    return {
      localFingerprint,
      cloudFingerprint,
      localChanged: true,
      cloudChanged: cloudHasData,
      requiresResolution: cloudHasData,
      reason: cloudHasData ? "first-sync-difference" : "local-changed"
    };
  }

  const localChanged = localFingerprint !== syncState.baselineFingerprint;
  const cloudChanged = cloudFingerprint !== syncState.baselineFingerprint;

  return {
    localFingerprint,
    cloudFingerprint,
    localChanged,
    cloudChanged,
    requiresResolution: cloudChanged,
    reason: cloudChanged ? "cloud-changed" : "local-changed"
  };
}

export function mergeTradeData(
  localPlans: TradePlan[],
  localAuditReports: AuditReport[],
  cloudPlans: TradePlan[],
  cloudAuditReports: AuditReport[]
): TradeDataSnapshot {
  const plansById = new Map(cloudPlans.map((plan) => [plan.id, plan]));

  for (const localPlan of localPlans) {
    const cloudPlan = plansById.get(localPlan.id);
    plansById.set(
      localPlan.id,
      cloudPlan
        ? {
            ...cloudPlan,
            ...localPlan,
            operations: mergeById(localPlan.operations, cloudPlan.operations),
            reviews: mergeById(localPlan.reviews, cloudPlan.reviews)
          }
        : localPlan
    );
  }

  return {
    plans: [...plansById.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    auditReports: mergeById(localAuditReports, cloudAuditReports).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    )
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(canonicalize);
    return items.every(hasStringId)
      ? [...items].sort((left, right) => left.id.localeCompare(right.id))
      : items;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, item]) => item !== undefined && key !== "createdAt" && key !== "updatedAt")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }

  return value;
}

function hasStringId(value: unknown): value is { id: string } {
  return Boolean(value && typeof value === "object" && "id" in value && typeof value.id === "string");
}

function mergeById<T extends { id: string }>(localItems: T[], cloudItems: T[]) {
  const itemsById = new Map(cloudItems.map((item) => [item.id, item]));
  localItems.forEach((item) => itemsById.set(item.id, item));
  return [...itemsById.values()];
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudDownload, RefreshCw, RotateCcw, UploadCloud } from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { cloudAuditRepository } from "@/lib/audit-repository";
import {
  assessSyncState,
  fingerprintTradeData,
  loadSyncState,
  mergeTradeData,
  persistSyncState,
  type SyncAssessment,
  type SyncDirection,
  type SyncState,
  type WorkspaceMode
} from "@/lib/sync-state";
import { buildTradeDataFile } from "@/lib/trade-data-file";
import { cloudTradeRepository } from "@/lib/trade-repository";
import type { AuditReport, TradePlan } from "@/lib/types";
import type { CloudWriteStatus } from "@/lib/use-trade-plans";

type NotifyTone = "success" | "error" | "info";

type CloudSyncPanelProps = {
  plans: TradePlan[];
  auditReports: AuditReport[];
  workspaceMode: WorkspaceMode;
  cloudWriteStatus: CloudWriteStatus;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;
  onRetryCloudWrite: () => void;
  onNotify: (message: string, tone?: NotifyTone) => void;
  onLoadCloudData: (plans: TradePlan[], auditReports: AuditReport[]) => void;
};

type SystemStatusResponse = {
  ok: boolean;
  integrations: {
    database: {
      configured: boolean;
      singleUserConfigured?: boolean;
      checked?: boolean;
      ok?: boolean;
      message?: string;
    };
    ai: { configured: boolean };
    cos: { configured: boolean; bucketConfigured: boolean; regionConfigured: boolean };
  };
};

type CloudPreview = {
  plans: TradePlan[];
  auditReports: AuditReport[];
  assessment: SyncAssessment;
};

type RetryAction = "status" | "upload" | "preview";

export function CloudSyncPanel({
  plans,
  auditReports,
  workspaceMode,
  cloudWriteStatus,
  onWorkspaceModeChange,
  onRetryCloudWrite,
  onNotify,
  onLoadCloudData
}: CloudSyncPanelProps) {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isSyncStateHydrated, setIsSyncStateHydrated] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [cloudPreview, setCloudPreview] = useState<CloudPreview | null>(null);
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);
  const localFingerprint = useMemo(() => fingerprintTradeData(plans, auditReports), [auditReports, plans]);

  const saveSyncState = (fingerprint: string, direction: SyncDirection) => {
    const nextState: SyncState = {
      baselineFingerprint: fingerprint,
      lastSuccessfulSyncAt: new Date().toISOString(),
      lastDirection: direction
    };
    persistSyncState(nextState);
    setSyncState(nextState);
  };

  const loadStatus = async () => {
    setIsLoadingStatus(true);

    try {
      const response = await fetch("/api/system/status?db=1");
      const data = (await response.json()) as SystemStatusResponse;
      setStatus(data);
      setRetryAction((current) => (current === "status" ? null : current));
    } catch {
      setRetryAction("status");
      onNotify("读取云端状态失败，请确认本地服务仍在运行。", "error");
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    setSyncState(loadSyncState());
    setIsSyncStateHydrated(true);
    void loadStatus();
  }, []);

  useEffect(() => {
    if (workspaceMode !== "cloud" || cloudWriteStatus.state !== "saved" || cloudWriteStatus.revision === 0) {
      return;
    }

    saveSyncState(localFingerprint, "upload");
  }, [cloudWriteStatus.revision, cloudWriteStatus.state, localFingerprint, workspaceMode]);

  const readCloudSnapshot = async () => {
    const [cloudPlans, cloudAuditReports] = await Promise.all([
      cloudTradeRepository.load(),
      cloudAuditRepository.load()
    ]);
    return { plans: cloudPlans, auditReports: cloudAuditReports };
  };

  const sendUpload = async (nextPlans: TradePlan[], nextAuditReports: AuditReport[]) => {
    const response = await fetch("/api/sync/import-local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildTradeDataFile(nextPlans, nextAuditReports))
    });
    const result = (await response.json()) as {
      ok: boolean;
      imported?: { plans: number; operations: number; reviews: number; auditReports: number };
      meta?: { storage?: string; message?: string };
      errors?: string[];
    };

    if (!response.ok || !result.ok) {
      throw new Error(result.meta?.message ?? result.errors?.[0] ?? "上传本地数据失败。");
    }

    return result;
  };

  const uploadLocalData = async (skipConfirmation = false) => {
    if (plans.length === 0 && auditReports.length === 0) {
      onNotify("当前没有可上传的本地数据。", "info");
      return;
    }

    if (
      !skipConfirmation &&
      !window.confirm(`确认上传 ${plans.length} 个计划和 ${auditReports.length} 条审计归档到云端吗？上传前会先检查云端变化。`)
    ) {
      return;
    }

    setIsUploading(true);

    try {
      const cloud = await readCloudSnapshot();
      const assessment = assessSyncState(plans, auditReports, cloud.plans, cloud.auditReports, syncState);

      if (assessment.requiresResolution) {
        setCloudPreview({ ...cloud, assessment });
        setRetryAction(null);
        onWorkspaceModeChange("local");
        onNotify("检测到云端数据与本地不同，已暂停上传，请先选择处理方式。", "error");
        return;
      }

      const result = await sendUpload(plans, auditReports);
      saveSyncState(localFingerprint, "upload");
      setCloudPreview(null);
      setRetryAction(null);
      onNotify(
        `已同步 ${result.imported?.plans ?? 0} 个计划、${result.imported?.operations ?? 0} 条操作、${result.imported?.reviews ?? 0} 条复盘。`,
        "success"
      );
      await loadStatus();
    } catch (error) {
      setRetryAction("upload");
      onNotify(error instanceof Error ? error.message : "上传本地数据失败，请稍后再试。", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const previewCloudData = async () => {
    setIsLoadingPreview(true);

    try {
      const cloud = await readCloudSnapshot();
      const assessment = assessSyncState(plans, auditReports, cloud.plans, cloud.auditReports, syncState);
      setCloudPreview({ ...cloud, assessment });
      if (assessment.requiresResolution) {
        onWorkspaceModeChange("local");
      }
      setRetryAction(null);
      onNotify("云端数据预览已更新，尚未修改当前本地记录。", "info");
    } catch (error) {
      setCloudPreview(null);
      setRetryAction("preview");
      onNotify(error instanceof Error ? error.message : "读取云端数据失败。", "error");
      await loadStatus();
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const applyCloudPreview = () => {
    if (!cloudPreview) {
      return;
    }

    const operationCount = countOperations(cloudPreview.plans);
    const reviewCount = countReviews(cloudPreview.plans);
    const confirmed = window.confirm(
      `确认用云端的 ${cloudPreview.plans.length} 个计划、${operationCount} 条操作、${reviewCount} 条复盘替换当前本地工作副本吗？建议先导出本地 JSON 备份。`
    );

    if (confirmed) {
      onLoadCloudData(cloudPreview.plans, cloudPreview.auditReports);
      saveSyncState(cloudPreview.assessment.cloudFingerprint, "download");
      setCloudPreview(null);
      setRetryAction(null);
      onNotify("已下载云端数据，并建立新的同步基线。", "success");
    }
  };

  const mergeAndUpload = async () => {
    if (!cloudPreview) {
      return;
    }

    if (!window.confirm("确认合并本地与云端数据后上传吗？同 ID 的内容以本地版本为准，云端独有记录会保留。")) {
      return;
    }

    const merged = mergeTradeData(plans, auditReports, cloudPreview.plans, cloudPreview.auditReports);
    setIsUploading(true);

    try {
      const result = await sendUpload(merged.plans, merged.auditReports);
      onLoadCloudData(merged.plans, merged.auditReports);
      const mergedFingerprint = fingerprintTradeData(merged.plans, merged.auditReports);
      saveSyncState(mergedFingerprint, "upload");
      setCloudPreview(null);
      setRetryAction(null);
      onNotify(
        `合并同步完成：${result.imported?.plans ?? 0} 个计划、${result.imported?.operations ?? 0} 条操作、${result.imported?.reviews ?? 0} 条复盘。`,
        "success"
      );
    } catch (error) {
      setRetryAction("upload");
      onNotify(error instanceof Error ? error.message : "合并上传失败，请稍后重试。", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const activateCloudMode = async () => {
    if (!canSync) {
      onNotify("数据库当前不可用，暂时不能开启云端自动保存。", "error");
      return;
    }

    if (hasUnsyncedChanges) {
      onNotify("请先完成一次同步或下载，建立一致基线后再开启云端自动保存。", "error");
      return;
    }

    setIsLoadingPreview(true);
    try {
      const cloud = await readCloudSnapshot();
      const assessment = assessSyncState(plans, auditReports, cloud.plans, cloud.auditReports, syncState);
      if (assessment.requiresResolution) {
        setCloudPreview({ ...cloud, assessment });
        onWorkspaceModeChange("local");
        onNotify("云端在上次同步后发生变化，请先解决差异。", "error");
        return;
      }

      onWorkspaceModeChange("cloud");
      onNotify("已开启云端自动保存。", "success");
    } catch (error) {
      setRetryAction("preview");
      onNotify(error instanceof Error ? error.message : "开启云端自动保存前的检查失败。", "error");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const retry = () => {
    if (cloudWriteStatus.state === "error") {
      onRetryCloudWrite();
      return;
    }

    if (retryAction === "status") {
      void loadStatus();
    } else if (retryAction === "preview") {
      void previewCloudData();
    } else if (retryAction === "upload") {
      void uploadLocalData(true);
    }
  };

  const databaseStatus = status?.integrations.database;
  const canSync = Boolean(databaseStatus?.configured && databaseStatus.singleUserConfigured && databaseStatus.ok);
  const statusLabel = !databaseStatus
    ? "未检查"
    : !databaseStatus.configured
      ? "未连接"
      : !databaseStatus.singleUserConfigured
        ? "待配置"
        : databaseStatus.ok
          ? "可用"
          : "异常";
  const hasUnsyncedChanges = isSyncStateHydrated && (!syncState || syncState.baselineFingerprint !== localFingerprint);
  const syncLabel = !isSyncStateHydrated
    ? "读取状态"
    : retryAction
      ? "上次同步失败"
      : hasUnsyncedChanges
        ? syncState
          ? "有未上传修改"
          : "尚未建立同步基线"
        : "本地与上次同步一致";

  useEffect(() => {
    if (
      isSyncStateHydrated &&
      workspaceMode === "cloud" &&
      cloudWriteStatus.state === "idle" &&
      cloudWriteStatus.revision === 0 &&
      hasUnsyncedChanges
    ) {
      onWorkspaceModeChange("local");
      onNotify("本地与同步基线不一致，已安全回到本地编辑模式。", "error");
    }
  }, [
    cloudWriteStatus.revision,
    cloudWriteStatus.state,
    hasUnsyncedChanges,
    isSyncStateHydrated,
    onNotify,
    onWorkspaceModeChange,
    workspaceMode
  ]);

  return (
    <section className="rt-card space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary-soft" />
            <h3 className="text-lg font-bold text-white">云端备份</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted">
            {workspaceMode === "cloud" ? "工作方式：本地立即响应，修改顺序保存到 PostgreSQL。" : "工作方式：本地编辑，确认后同步到 PostgreSQL。"}
          </p>
        </div>
        <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-bold ${canSync ? "bg-buy/20 text-buy" : "bg-surface-raised text-muted-strong"}`}>
          {statusLabel}
        </span>
      </div>

      <SegmentedControl
        value={workspaceMode}
        onChange={(mode) => {
          if (mode === "local") {
            onWorkspaceModeChange("local");
            onNotify("已切换到本地编辑，修改不会自动写入云端。", "info");
            return;
          }

          void activateCloudMode();
        }}
        options={[
          { value: "local", label: "本地编辑" },
          { value: "cloud", label: "云端自动保存" }
        ]}
      />

      {workspaceMode === "cloud" ? (
        <div className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${cloudWriteStatus.state === "error" ? "border-sell/50 bg-sell/10" : "border-buy/30 bg-buy/10"}`}>
          {cloudWriteStatus.state === "saving" ? (
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary-soft" />
          ) : cloudWriteStatus.state === "error" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-buy" />
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">
              {cloudWriteStatus.state === "saving"
                ? "正在保存到云端"
                : cloudWriteStatus.state === "error"
                  ? "云端保存失败"
                  : "云端自动保存已开启"}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-muted">
              {cloudWriteStatus.message ?? "计划、操作、复盘和审计归档会在修改后写入 PostgreSQL。"}
            </p>
          </div>
        </div>
      ) : null}

      <div className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${hasUnsyncedChanges ? "border-primary/40 bg-primary/10" : "border-buy/30 bg-buy/10"}`}>
        {hasUnsyncedChanges ? <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary-soft" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-buy" />}
        <div className="min-w-0">
          <p className="text-xs font-bold text-white">{syncLabel}</p>
          <p className="mt-1 text-[11px] leading-4 text-muted">
            {syncState
              ? `上次${syncState.lastDirection === "upload" ? "上传" : "下载"}：${formatSyncTime(syncState.lastSuccessfulSyncAt)}`
              : "首次同步会先比较本地和云端，避免直接覆盖。"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <StatusPill label="数据库" active={Boolean(databaseStatus?.configured)} />
        <StatusPill label="AI" active={Boolean(status?.integrations.ai.configured)} />
        <StatusPill label="COS" active={Boolean(status?.integrations.cos.configured)} />
      </div>

      {databaseStatus?.message ? <p className="rounded-xl border border-line bg-background px-3 py-2 text-xs leading-5 text-muted">{databaseStatus.message}</p> : null}

      {retryAction || cloudWriteStatus.state === "error" ? (
        <button
          type="button"
          onClick={retry}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-sell/40 bg-sell/10 text-xs font-bold text-risk"
        >
          <RotateCcw className="h-4 w-4" />
          重试上次失败操作
        </button>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={loadStatus} disabled={isLoadingStatus} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong transition active:scale-[0.98] disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${isLoadingStatus ? "animate-spin" : ""}`} />
          刷新状态
        </button>
        <button type="button" onClick={() => uploadLocalData()} disabled={isUploading || !canSync || workspaceMode === "cloud"} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-white shadow-lg shadow-primary/20 transition active:scale-[0.98] disabled:bg-surface-raised disabled:text-muted disabled:shadow-none">
          <UploadCloud className="h-4 w-4" />
          {isUploading ? "检查并上传" : "同步本地修改"}
        </button>
        <button type="button" onClick={previewCloudData} disabled={isLoadingPreview || !canSync} className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98] disabled:border-line disabled:bg-surface-raised disabled:text-muted">
          <CloudDownload className="h-4 w-4" />
          {isLoadingPreview ? "读取中" : "查看云端副本"}
        </button>
      </div>

      {cloudPreview ? (
        <div className="space-y-3 border-t border-line pt-4">
          {cloudPreview.assessment.requiresResolution ? (
            <div className="flex gap-2 rounded-xl border border-sell/50 bg-sell/10 p-3 text-xs leading-5 text-risk">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>本地和云端不在同一同步基线上，上传已暂停。请选择下载云端，或合并两边后再上传。</span>
            </div>
          ) : null}
          <div className="grid grid-cols-4 gap-2 text-center">
            <PreviewMetric label="计划" value={cloudPreview.plans.length} />
            <PreviewMetric label="操作" value={countOperations(cloudPreview.plans)} />
            <PreviewMetric label="复盘" value={countReviews(cloudPreview.plans)} />
            <PreviewMetric label="审计" value={cloudPreview.auditReports.length} />
          </div>
          <p className="text-xs leading-5 text-muted">预览不会修改本地记录。下载替换会覆盖当前本地工作副本，合并上传会保留云端独有记录。</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={applyCloudPreview} className="h-10 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong">
              使用云端副本
            </button>
            {cloudPreview.assessment.requiresResolution ? (
              <button type="button" onClick={mergeAndUpload} disabled={isUploading} className="h-10 rounded-xl bg-primary text-xs font-bold text-white disabled:opacity-60">
                合并后上传
              </button>
            ) : (
              <button type="button" onClick={() => setCloudPreview(null)} className="h-10 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong">
                关闭预览
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-bold text-white">{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-muted">{label}</p>
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-background px-2 py-2">
      <p className={`text-xs font-bold ${active ? "text-buy" : "text-muted"}`}>{active ? "已配置" : "未配置"}</p>
      <p className="mt-1 text-[11px] font-semibold text-muted">{label}</p>
    </div>
  );
}

function countOperations(plans: TradePlan[]) {
  return plans.reduce((total, plan) => total + plan.operations.length, 0);
}

function countReviews(plans: TradePlan[]) {
  return plans.reduce((total, plan) => total + plan.reviews.length, 0);
}

function formatSyncTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

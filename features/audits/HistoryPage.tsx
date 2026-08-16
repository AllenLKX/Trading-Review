"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, FileSearch, Pencil, RefreshCw, Search, Trash2 } from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { EmptyState } from "@/components/EmptyState";
import { Toast, type ToastMessage } from "@/components/Toast";
import { PlanOperationForm } from "@/features/trades/PlanOperationForm";
import { PlanReviewForm } from "@/features/trades/PlanReviewForm";
import { buildAuditReport, requestAuditReport } from "@/lib/audit-ai-adapter";
import { cloudAuditRepository, localAuditRepository } from "@/lib/audit-repository";
import { formatCurrency, formatDateTime, getActionLabel, getActionTone, getRealizedResultLabel } from "@/lib/format";
import { currencyOptions, sampleAuditReports } from "@/lib/sample-data";
import { buildTradeDataFile } from "@/lib/trade-data-file";
import type { AuditReport, CurrencyCode, PlanReview, TradeOperation, TradePlan } from "@/lib/types";
import { AuditSnapshotCard } from "./AuditSnapshotCard";

type HistoryPageProps = {
  plans: TradePlan[];
  highlightedPlanId: string | null;
  dataStatus: "loading" | "ready" | "cached";
  connectionMessage: string;
  isMutating: boolean;
  onReload: () => Promise<void>;
  onUpdatePlan: (plan: TradePlan) => Promise<void>;
  onDeletePlan: (planId: string) => Promise<void>;
  onAddOperation: (operation: TradeOperation) => Promise<void>;
  onAddReview: (review: PlanReview) => Promise<void>;
};

export function HistoryPage({
  plans,
  highlightedPlanId,
  dataStatus,
  connectionMessage,
  isMutating,
  onReload,
  onUpdatePlan,
  onDeletePlan,
  onAddOperation,
  onAddReview
}: HistoryPageProps) {
  const [query, setQuery] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [selectedDetailPlanId, setSelectedDetailPlanId] = useState<string | null>(null);
  const [, ...sampleArchivedAudits] = sampleAuditReports;
  const [userArchivedAudits, setUserArchivedAudits] = useState<AuditReport[]>([]);
  const [isAuditArchiveHydrated, setIsAuditArchiveHydrated] = useState(false);
  const [latestAudit, setLatestAudit] = useState(() => buildAuditReport(plans));
  const [isAuditRefreshing, setIsAuditRefreshing] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredPlans = useMemo(
    () =>
      plans.filter((plan) => {
        const searchableText = [
          plan.title,
          plan.assetName,
          plan.ticker,
          plan.market,
          plan.thesis,
          ...plan.operations.flatMap((operation) => [
            operation.decisionReason,
            operation.psychologyNote,
            ...operation.emotionTags,
            ...operation.strategyTags
          ]),
          ...plan.reviews.flatMap((review) => [
            review.reviewNote,
            getRealizedResultLabel(review.realizedResult),
            ...review.violatedRules,
            ...review.emotionTags
          ])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return !normalizedQuery || searchableText.includes(normalizedQuery);
      }),
    [normalizedQuery, plans]
  );
  const selectedDetailPlan = plans.find((plan) => plan.id === selectedDetailPlanId) ?? null;
  const archivedAudits = userArchivedAudits.length > 0 ? userArchivedAudits : sampleArchivedAudits;
  const notify = useCallback((text: string, tone: ToastMessage["tone"] = "info") => {
    setDataMessage(text);
    setToast({ id: Date.now(), text, tone });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  const refreshAudit = async (signal?: AbortSignal) => {
    const fallbackReport = buildAuditReport(plans);
    setLatestAudit(fallbackReport);
    setIsAuditRefreshing(true);

    try {
      const response = await requestAuditReport(plans, signal);
      if (!signal?.aborted) {
        setLatestAudit(response.report);
        if (!signal) {
          notify(
            response.source === "deepseek" ? "DeepSeek 行为审计已更新。" : "DeepSeek 暂不可用，已显示本地规则审计。",
            response.source === "deepseek" ? "success" : "info"
          );
        }
      }
    } catch {
      if (!signal?.aborted) {
        setLatestAudit(fallbackReport);
        if (!signal) notify("审计接口暂不可用，已显示本地规则审计。", "error");
      }
    } finally {
      if (!signal?.aborted) {
        setIsAuditRefreshing(false);
      }
    }
  };

  useEffect(() => {
    setLatestAudit(buildAuditReport(plans));
  }, [plans]);

  useEffect(() => {
    let active = true;
    cloudAuditRepository
      .load()
      .then((reports) => {
        if (active) setUserArchivedAudits(reports);
      })
      .catch(() => {
        if (active) setUserArchivedAudits(localAuditRepository.load());
      })
      .finally(() => {
        if (active) setIsAuditArchiveHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuditArchiveHydrated) {
      return;
    }

    localAuditRepository.persist(userArchivedAudits);
  }, [isAuditArchiveHydrated, userArchivedAudits]);

  const archiveCurrentAudit = async () => {
    const now = new Date().toISOString();
    const archivedReport: AuditReport = {
      ...latestAudit,
      id: `audit-archive-${Date.now()}`,
      title: "归档审计快照",
      createdAt: now
    };

    try {
      const savedReport = await cloudAuditRepository.archive(archivedReport);
      setUserArchivedAudits((current) => [savedReport, ...current.filter((report) => report.id !== savedReport.id)].slice(0, 20));
      notify("审计分析已成功归档。", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "审计归档失败，请重试。", "error");
    }
  };

  const exportPlans = () => {
    const dataFile = buildTradeDataFile(plans, userArchivedAudits);
    const blob = new Blob([JSON.stringify(dataFile, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rationaltrade-plans-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setDataMessage(`已导出 ${plans.length} 个计划。`);
  };

  const deleteArchivedAudit = async (reportId: string) => {
    if (!window.confirm("确认删除这条审计归档吗？计划和操作记录不会被删除。")) {
      return;
    }

    try {
      await cloudAuditRepository.delete(reportId);
      setUserArchivedAudits((current) => current.filter((report) => report.id !== reportId));
      notify("已删除审计归档。", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "删除审计归档失败，请重试。", "error");
    }
  };

  const clearArchivedAudits = async () => {
    if (userArchivedAudits.length === 0) {
      return;
    }

    if (window.confirm(`确认清空 ${userArchivedAudits.length} 条审计归档吗？计划和操作记录不会被删除。`)) {
      try {
        for (const report of userArchivedAudits) await cloudAuditRepository.delete(report.id);
        setUserArchivedAudits([]);
        notify("已清空审计归档。", "success");
      } catch (error) {
        const serverReports = await cloudAuditRepository.load().catch(() => null);
        if (serverReports) setUserArchivedAudits(serverReports);
        notify(error instanceof Error ? error.message : "清空审计归档失败，请重试。", "error");
      }
    }
  };

  if (selectedDetailPlan) {
    return (
      <>
        <PlanDetailView
          plan={selectedDetailPlan}
          onBack={() => setSelectedDetailPlanId(null)}
          onDeletePlan={async (planId) => {
            await onDeletePlan(planId);
            setSelectedDetailPlanId(null);
          }}
          onUpdatePlan={onUpdatePlan}
          onAddOperation={onAddOperation}
          onAddReview={onAddReview}
          isMutating={isMutating}
          onNotify={notify}
        />
        <Toast message={toast} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">近 30 天</p>
        <h2 className="mt-1 text-2xl font-bold text-foreground">计划与审计</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          计划承载操作和独立复盘，审计会聚合近期所有计划下的行为记录。
        </p>
      </div>

      <AuditSnapshotCard
        latest={latestAudit}
        archived={archivedAudits}
        isRefreshing={isAuditRefreshing}
        onRefresh={() => refreshAudit()}
        onArchive={archiveCurrentAudit}
        canManageArchives={userArchivedAudits.length > 0}
        onDeleteArchive={deleteArchivedAudit}
        onClearArchives={clearArchivedAudits}
      />

      {dataStatus !== "ready" ? (
        <div className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-3 text-xs font-semibold leading-5 ${dataStatus === "cached" ? "border-sell/50 bg-sell/10 text-risk" : "border-line bg-surface text-muted-strong"}`}>
          <span>{connectionMessage}</span>
          <button type="button" onClick={() => void onReload()} className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-current px-2">
            <RefreshCw className="h-3.5 w-3.5" />重试
          </button>
        </div>
      ) : null}

      {dataMessage ? <p className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted-strong">{dataMessage}</p> : null}

      <Toast message={toast} onDismiss={dismissToast} />

      <section className="space-y-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">计划列表</h3>
            <span className="text-xs font-semibold text-muted">
              {filteredPlans.length}/{plans.length} 个
            </span>
          </div>

          <div>
            <button type="button" onClick={exportPlans} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong transition active:scale-[0.98]">
              <Download className="h-4 w-4" />
              导出 JSON
            </button>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="rt-input pl-9" placeholder="搜索计划、标的、理由、复盘" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        {filteredPlans.length > 0 ? (
          filteredPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isHighlighted={plan.id === highlightedPlanId}
              onDeletePlan={onDeletePlan}
              onUpdatePlan={onUpdatePlan}
              onOpenDetail={setSelectedDetailPlanId}
              isMutating={isMutating}
              onNotify={notify}
            />
          ))
        ) : plans.length > 0 ? (
          <EmptyState icon={FileSearch} title="没有匹配计划" description="换一个关键词，或清空搜索查看所有计划。" />
        ) : (
          <EmptyState icon={FileSearch} title="暂无计划" description="先创建一个计划，再记录操作或复盘。" />
        )}
      </section>
    </main>
  );
}

function PlanCard({
  plan,
  isHighlighted,
  onDeletePlan,
  onUpdatePlan,
  onOpenDetail,
  isMutating,
  onNotify
}: {
  plan: TradePlan;
  isHighlighted: boolean;
  onDeletePlan: (planId: string) => Promise<void>;
  onUpdatePlan: (plan: TradePlan) => Promise<void>;
  onOpenDetail: (planId: string) => void;
  isMutating: boolean;
  onNotify: (text: string, tone?: ToastMessage["tone"]) => void;
}) {
  const confirmDelete = async () => {
    if (window.confirm(`确认删除「${plan.title}」以及其中所有操作和复盘吗？`)) {
      try {
        await onDeletePlan(plan.id);
        onNotify("计划已删除。", "success");
      } catch (error) {
        onNotify(error instanceof Error ? error.message : "删除计划失败，请重试。", "error");
      }
    }
  };

  const toggleStatus = async () => {
    const now = new Date().toISOString();
    try {
      await onUpdatePlan({ ...plan, status: plan.status === "active" ? "closed" : "active", updatedAt: now });
      onNotify(plan.status === "active" ? "计划已关闭。" : "计划已重新打开。", "success");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "更新计划失败，请重试。", "error");
    }
  };

  return (
    <article className={`rounded-2xl border bg-surface p-4 transition ${isHighlighted ? "border-primary shadow-glow" : "border-line"}`}>
      {isHighlighted ? (
        <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary-soft">
          刚刚新增或修改
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-foreground">{plan.title}</h3>
            <span className="rounded-lg border border-line bg-background px-2 py-1 text-xs font-bold text-muted-strong">
              {plan.status === "active" ? "进行中" : "已关闭"}
            </span>
          </div>
          <p className="text-xs text-muted">
            {plan.assetName} · {plan.ticker} · {plan.currency}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-foreground">{plan.operations.length} 操作</p>
          <p className="mt-1 text-xs text-muted">{plan.reviews.length} 复盘</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border-l-2 border-primary bg-background p-3">
        <p className="text-sm leading-6 text-muted-strong">{plan.thesis}</p>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
        <button type="button" onClick={() => onOpenDetail(plan.id)} className="h-10 rounded-xl border border-line bg-background text-xs font-bold text-muted-strong transition active:scale-[0.98]">
          查看详情
        </button>
        <button type="button" onClick={() => void toggleStatus()} disabled={isMutating} className="h-10 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98] disabled:opacity-60">
          {plan.status === "active" ? "关闭计划" : "重新打开"}
        </button>
        <button type="button" onClick={() => void confirmDelete()} disabled={isMutating} className="flex h-10 w-12 items-center justify-center rounded-xl border border-sell/40 bg-sell/10 text-risk transition active:scale-[0.98] disabled:opacity-60" aria-label={`删除 ${plan.title}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function PlanDetailView({
  plan,
  onBack,
  onDeletePlan,
  onUpdatePlan,
  onAddOperation,
  onAddReview,
  isMutating,
  onNotify
}: {
  plan: TradePlan;
  onBack: () => void;
  onDeletePlan: (planId: string) => Promise<void>;
  onUpdatePlan: (plan: TradePlan) => Promise<void>;
  onAddOperation: (operation: TradeOperation) => Promise<void>;
  onAddReview: (review: PlanReview) => Promise<void>;
  isMutating: boolean;
  onNotify: (text: string, tone?: ToastMessage["tone"]) => void;
}) {
  const [entryMode, setEntryMode] = useState<"operation" | "review">("operation");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [editTitle, setEditTitle] = useState(plan.title);
  const [editAssetName, setEditAssetName] = useState(plan.assetName);
  const [editTicker, setEditTicker] = useState(plan.ticker);
  const [editMarket, setEditMarket] = useState(plan.market);
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>(plan.currency);
  const [editThesis, setEditThesis] = useState(plan.thesis);
  const [planEditError, setPlanEditError] = useState("");
  const timeline = [
    ...plan.operations.map((operation) => ({ type: "operation" as const, time: operation.tradeTime, item: operation })),
    ...plan.reviews.map((review) => ({ type: "review" as const, time: review.reviewTime, item: review }))
  ].sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());

  const confirmDelete = async () => {
    if (window.confirm(`确认删除「${plan.title}」以及其中所有操作和复盘吗？`)) {
      try {
        await onDeletePlan(plan.id);
        onNotify("计划已删除。", "success");
      } catch (error) {
        onNotify(error instanceof Error ? error.message : "删除计划失败，请重试。", "error");
      }
    }
  };

  const toggleStatus = async () => {
    const now = new Date().toISOString();
    try {
      await onUpdatePlan({ ...plan, status: plan.status === "active" ? "closed" : "active", updatedAt: now });
      onNotify(plan.status === "active" ? "计划已关闭。" : "计划已重新打开。", "success");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "更新计划失败，请重试。", "error");
    }
  };

  const startEditingPlan = () => {
    setEditTitle(plan.title);
    setEditAssetName(plan.assetName);
    setEditTicker(plan.ticker);
    setEditMarket(plan.market);
    setEditCurrency(plan.currency);
    setEditThesis(plan.thesis);
    setPlanEditError("");
    setIsEditingPlan(true);
  };

  const savePlanEdits = async () => {
    if (!editTitle.trim() || !editAssetName.trim() || !editThesis.trim()) {
      setPlanEditError("请补全计划名称、标的和计划假设。");
      return;
    }

    try {
      await onUpdatePlan({
        ...plan,
        title: editTitle.trim(),
        assetName: editAssetName.trim(),
        ticker: editTicker.trim() || editAssetName.trim(),
        market: editMarket.trim() || "自选",
        currency: editCurrency,
        thesis: editThesis.trim(),
        updatedAt: new Date().toISOString()
      });
      setPlanEditError("");
      setIsEditingPlan(false);
      onNotify("计划修改已保存。", "success");
    } catch (error) {
      setPlanEditError(error instanceof Error ? error.message : "保存计划失败，请重试。");
    }
  };

  const updateOperation = async (operation: TradeOperation) => {
    await onUpdatePlan({
      ...plan,
      operations: plan.operations.map((item) => (item.id === operation.id ? operation : item)),
      updatedAt: operation.updatedAt
    });
    setEditingEventId(null);
    onNotify("操作修改已保存。", "success");
  };

  const updateReview = async (review: PlanReview) => {
    await onUpdatePlan({
      ...plan,
      reviews: plan.reviews.map((item) => (item.id === review.id ? review : item)),
      updatedAt: review.updatedAt
    });
    setEditingEventId(null);
    onNotify("复盘修改已保存。", "success");
  };

  const deleteOperation = async (operation: TradeOperation) => {
    if (!window.confirm("确认删除这条操作记录吗？")) {
      return;
    }

    const now = new Date().toISOString();
    try {
      await onUpdatePlan({
        ...plan,
        operations: plan.operations.filter((item) => item.id !== operation.id),
        reviews: plan.reviews.map((review) =>
          review.operationIds?.includes(operation.id)
            ? { ...review, operationIds: review.operationIds.filter((operationId) => operationId !== operation.id), updatedAt: now }
            : review
        ),
        updatedAt: now
      });
      setEditingEventId(null);
      onNotify("操作记录已删除。", "success");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "删除操作失败，请重试。", "error");
    }
  };

  const deleteReview = async (review: PlanReview) => {
    if (!window.confirm("确认删除这条复盘记录吗？")) {
      return;
    }

    const now = new Date().toISOString();
    try {
      await onUpdatePlan({
        ...plan,
        reviews: plan.reviews.filter((item) => item.id !== review.id),
        updatedAt: now
      });
      setEditingEventId(null);
      onNotify("复盘记录已删除。", "success");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "删除复盘失败，请重试。", "error");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-5">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-fit items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-muted-strong transition active:scale-[0.98]"
      >
        <ArrowLeft className="h-4 w-4" />
        返回计划列表
      </button>

      <section className="rounded-2xl border border-primary/30 bg-surface p-4 shadow-glow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">计划详情</p>
            <h2 className="mt-1 text-2xl font-bold text-foreground">{plan.title}</h2>
            <p className="mt-2 text-sm text-muted">
              {plan.assetName} · {plan.ticker} · {plan.market} · {plan.currency}
            </p>
          </div>
          <span className="rounded-lg border border-line bg-background px-2 py-1 text-xs font-bold text-muted-strong">
            {plan.status === "active" ? "进行中" : "已关闭"}
          </span>
        </div>

        <div className="mt-4 rounded-xl border-l-2 border-primary bg-background p-3">
          <p className="text-sm leading-6 text-muted-strong">{plan.thesis}</p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <DetailMetric label="操作" value={`${plan.operations.length} 次`} />
          <DetailMetric label="复盘" value={`${plan.reviews.length} 次`} />
          <DetailMetric label="状态" value={plan.status === "active" ? "进行中" : "已关闭"} />
        </div>

        <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
          <button type="button" onClick={startEditingPlan} className="h-10 rounded-xl border border-line bg-background text-xs font-bold text-muted-strong transition active:scale-[0.98]">
            编辑计划
          </button>
          <button type="button" onClick={() => void toggleStatus()} disabled={isMutating} className="h-10 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98] disabled:opacity-60">
            {plan.status === "active" ? "关闭计划" : "重新打开"}
          </button>
          <button type="button" onClick={() => void confirmDelete()} disabled={isMutating} className="flex h-10 w-12 items-center justify-center rounded-xl border border-sell/40 bg-sell/10 text-risk transition active:scale-[0.98] disabled:opacity-60" aria-label={`删除 ${plan.title}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </section>

      {isEditingPlan ? (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">编辑计划</h3>
            <span className="text-xs font-semibold text-muted">基础信息</span>
          </div>
          <label className="space-y-2">
            <span className="rt-label">计划名称</span>
            <input className="rt-input" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="rt-label">标的</span>
              <input className="rt-input" value={editAssetName} onChange={(event) => setEditAssetName(event.target.value)} />
            </label>
            <label className="space-y-2">
              <span className="rt-label">代码</span>
              <input className="rt-input" value={editTicker} onChange={(event) => setEditTicker(event.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="rt-label">市场</span>
              <input className="rt-input" value={editMarket} onChange={(event) => setEditMarket(event.target.value)} />
            </label>
            <label className="space-y-2">
              <span className="rt-label">币种</span>
              <select className="rt-input" value={editCurrency} onChange={(event) => setEditCurrency(event.target.value as CurrencyCode)}>
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-2">
            <span className="rt-label">计划假设</span>
            <textarea className="rt-input min-h-24 resize-none leading-6" value={editThesis} onChange={(event) => setEditThesis(event.target.value)} />
          </label>
          {planEditError ? <p className="text-xs font-semibold text-risk">{planEditError}</p> : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setIsEditingPlan(false)} className="h-11 rounded-xl border border-line bg-background text-xs font-bold text-muted-strong transition active:scale-[0.98]">
              取消
            </button>
            <button type="button" onClick={() => void savePlanEdits()} disabled={isMutating} className="h-11 rounded-xl bg-buy text-xs font-bold text-white transition active:scale-[0.98] disabled:opacity-60">
              {isMutating ? "正在保存…" : "保存计划"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">添加记录</h3>
          <span className="text-xs font-semibold text-muted">写入当前计划</span>
        </div>
        <SegmentedControl
          value={entryMode}
          onChange={setEntryMode}
          options={[
            { value: "operation", label: "添加操作" },
            { value: "review", label: "添加复盘" }
          ]}
        />
        {entryMode === "operation" ? (
          <PlanOperationForm plan={plan} onSave={onAddOperation} />
        ) : (
          <PlanReviewForm plan={plan} onSave={onAddReview} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-foreground">计划时间线</h3>
          <span className="text-xs font-semibold text-muted">{timeline.length} 条</span>
        </div>

        {timeline.length > 0 ? (
          timeline.map((event) =>
            event.type === "operation" ? (
              <div key={event.item.id} className="rounded-2xl border border-line bg-surface p-4">
                {editingEventId === event.item.id ? (
                  <PlanOperationForm
                    plan={plan}
                    initialOperation={event.item}
                    onSave={updateOperation}
                    onCancel={() => setEditingEventId(null)}
                    submitLabel="保存操作修改"
                  />
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${getActionTone(event.item.action)}`}>
                        {getActionLabel(event.item.action)}
                      </span>
                      <span className="text-xs text-muted">{formatDateTime(event.item.tradeTime)}</span>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-foreground">{formatCurrency(event.item.price, event.item.currency)}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-strong">{event.item.decisionReason}</p>
                    {event.item.psychologyNote ? <p className="mt-2 text-xs leading-5 text-muted">{event.item.psychologyNote}</p> : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[...event.item.emotionTags, ...event.item.strategyTags].map((tag) => (
                        <span key={tag} className="rounded-full border border-line bg-surface-soft px-2 py-1 text-xs text-muted-strong">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <button type="button" onClick={() => setEditingEventId(event.item.id)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-background text-xs font-bold text-muted-strong transition active:scale-[0.98]">
                        <Pencil className="h-4 w-4" />
                        编辑操作
                      </button>
                      <button type="button" onClick={() => void deleteOperation(event.item)} disabled={isMutating} className="flex h-10 w-12 items-center justify-center rounded-xl border border-sell/40 bg-sell/10 text-risk transition active:scale-[0.98] disabled:opacity-60" aria-label="删除操作">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div key={event.item.id} className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                {editingEventId === event.item.id ? (
                  <PlanReviewForm
                    plan={plan}
                    initialReview={event.item}
                    onSave={updateReview}
                    onCancel={() => setEditingEventId(null)}
                    submitLabel="保存复盘修改"
                  />
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-primary-soft">独立复盘 · {getRealizedResultLabel(event.item.realizedResult)}</span>
                      <span className="text-xs text-muted">{formatDateTime(event.item.reviewTime)}</span>
                    </div>
                    <p className="text-sm leading-6 text-muted-strong">{event.item.reviewNote}</p>
                    {typeof event.item.profitLoss === "number" ? (
                      <p className="mt-2 text-sm font-bold tabular-nums text-foreground">{formatCurrency(event.item.profitLoss, plan.currency)}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[...event.item.violatedRules, ...event.item.emotionTags].map((tag) => (
                        <span key={tag} className="rounded-full border border-line bg-surface-soft px-2 py-1 text-xs text-muted-strong">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                      <button type="button" onClick={() => setEditingEventId(event.item.id)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-background text-xs font-bold text-primary-soft transition active:scale-[0.98]">
                        <Pencil className="h-4 w-4" />
                        编辑复盘
                      </button>
                      <button type="button" onClick={() => void deleteReview(event.item)} disabled={isMutating} className="flex h-10 w-12 items-center justify-center rounded-xl border border-sell/40 bg-sell/10 text-risk transition active:scale-[0.98] disabled:opacity-60" aria-label="删除复盘">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          )
        ) : (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">这个计划还没有操作或复盘。</p>
        )}
      </section>
    </main>
  );
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-background p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

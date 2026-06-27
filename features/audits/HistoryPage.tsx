"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Download, FileSearch, Search, Trash2, Upload } from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { EmptyState } from "@/components/EmptyState";
import { PlanOperationForm } from "@/features/trades/PlanOperationForm";
import { PlanReviewForm } from "@/features/trades/PlanReviewForm";
import { buildRollingAuditReport } from "@/lib/audit-summary";
import { formatCurrency, formatDateTime, getActionLabel, getActionTone, getRealizedResultLabel } from "@/lib/format";
import { currencyOptions, sampleAuditReports } from "@/lib/sample-data";
import { buildTradeDataFile, parseTradeDataFile } from "@/lib/trade-data-file";
import type { CurrencyCode, PlanReview, TradeOperation, TradePlan } from "@/lib/types";
import { AuditSnapshotCard } from "./AuditSnapshotCard";

type HistoryPageProps = {
  plans: TradePlan[];
  highlightedPlanId: string | null;
  onUpdatePlan: (plan: TradePlan) => void;
  onDeletePlan: (planId: string) => void;
  onAddOperation: (operation: TradeOperation) => void;
  onAddReview: (review: PlanReview) => void;
  onReplacePlans: (plans: TradePlan[]) => void;
  onClearPlans: () => void;
  onRestoreSamples: () => void;
};

export function HistoryPage({
  plans,
  highlightedPlanId,
  onUpdatePlan,
  onDeletePlan,
  onAddOperation,
  onAddReview,
  onReplacePlans,
  onClearPlans,
  onRestoreSamples
}: HistoryPageProps) {
  const [query, setQuery] = useState("");
  const [dataMessage, setDataMessage] = useState("");
  const [selectedDetailPlanId, setSelectedDetailPlanId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, ...archivedAudits] = sampleAuditReports;
  const latestAudit = buildRollingAuditReport(plans);
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

  const confirmClearPlans = () => {
    if (plans.length === 0) {
      onClearPlans();
      return;
    }

    if (window.confirm("确认清空当前浏览器里的本地计划记录吗？")) {
      onClearPlans();
    }
  };

  const exportPlans = () => {
    const dataFile = buildTradeDataFile(plans);
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

  const importPlans = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const nextPlans = parseTradeDataFile(text);

      if (plans.length > 0 && !window.confirm(`导入会替换当前 ${plans.length} 个本地计划，确认继续吗？`)) {
        return;
      }

      onReplacePlans(nextPlans);
      setDataMessage(`已导入 ${nextPlans.length} 个计划。`);
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : "导入失败，请检查 JSON 文件。");
    }
  };

  if (selectedDetailPlan) {
    return (
      <PlanDetailView
        plan={selectedDetailPlan}
        onBack={() => setSelectedDetailPlanId(null)}
        onDeletePlan={(planId) => {
          onDeletePlan(planId);
          setSelectedDetailPlanId(null);
        }}
        onUpdatePlan={onUpdatePlan}
        onAddOperation={onAddOperation}
        onAddReview={onAddReview}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">近 30 天</p>
        <h2 className="mt-1 text-2xl font-bold text-white">计划与审计</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          计划承载操作和独立复盘，审计会聚合近期所有计划下的行为记录。
        </p>
      </div>

      <AuditSnapshotCard latest={latestAudit} archived={archivedAudits} />

      <section className="space-y-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">计划列表</h3>
            <span className="text-xs font-semibold text-muted">
              {filteredPlans.length}/{plans.length} 个
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={confirmClearPlans} className="h-10 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong transition active:scale-[0.98]">
              清空本地计划
            </button>
            <button type="button" onClick={onRestoreSamples} className="h-10 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98]">
              恢复示例数据
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={exportPlans} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong transition active:scale-[0.98]">
              <Download className="h-4 w-4" />
              导出 JSON
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98]">
              <Upload className="h-4 w-4" />
              导入 JSON
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={importPlans} />
          </div>

          {dataMessage ? <p className="rounded-xl border border-line bg-background px-3 py-2 text-xs font-semibold text-muted-strong">{dataMessage}</p> : null}

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
  onOpenDetail
}: {
  plan: TradePlan;
  isHighlighted: boolean;
  onDeletePlan: (planId: string) => void;
  onUpdatePlan: (plan: TradePlan) => void;
  onOpenDetail: (planId: string) => void;
}) {
  const confirmDelete = () => {
    if (window.confirm(`确认删除「${plan.title}」以及其中所有操作和复盘吗？`)) {
      onDeletePlan(plan.id);
    }
  };

  const toggleStatus = () => {
    const now = new Date().toISOString();
    onUpdatePlan({ ...plan, status: plan.status === "active" ? "closed" : "active", updatedAt: now });
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
            <h3 className="truncate text-base font-bold text-white">{plan.title}</h3>
            <span className="rounded-lg border border-line bg-background px-2 py-1 text-xs font-bold text-muted-strong">
              {plan.status === "active" ? "进行中" : "已关闭"}
            </span>
          </div>
          <p className="text-xs text-muted">
            {plan.assetName} · {plan.ticker} · {plan.currency}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-white">{plan.operations.length} 操作</p>
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
        <button type="button" onClick={toggleStatus} className="h-10 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98]">
          {plan.status === "active" ? "关闭计划" : "重新打开"}
        </button>
        <button type="button" onClick={confirmDelete} className="flex h-10 w-12 items-center justify-center rounded-xl border border-sell/40 bg-sell/10 text-risk transition active:scale-[0.98]" aria-label={`删除 ${plan.title}`}>
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
  onAddReview
}: {
  plan: TradePlan;
  onBack: () => void;
  onDeletePlan: (planId: string) => void;
  onUpdatePlan: (plan: TradePlan) => void;
  onAddOperation: (operation: TradeOperation) => void;
  onAddReview: (review: PlanReview) => void;
}) {
  const [entryMode, setEntryMode] = useState<"operation" | "review">("operation");
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

  const confirmDelete = () => {
    if (window.confirm(`确认删除「${plan.title}」以及其中所有操作和复盘吗？`)) {
      onDeletePlan(plan.id);
    }
  };

  const toggleStatus = () => {
    const now = new Date().toISOString();
    onUpdatePlan({ ...plan, status: plan.status === "active" ? "closed" : "active", updatedAt: now });
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

  const savePlanEdits = () => {
    if (!editTitle.trim() || !editAssetName.trim() || !editThesis.trim()) {
      setPlanEditError("请补全计划名称、标的和计划假设。");
      return;
    }

    onUpdatePlan({
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
            <h2 className="mt-1 text-2xl font-bold text-white">{plan.title}</h2>
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
          <button type="button" onClick={toggleStatus} className="h-10 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98]">
            {plan.status === "active" ? "关闭计划" : "重新打开"}
          </button>
          <button type="button" onClick={confirmDelete} className="flex h-10 w-12 items-center justify-center rounded-xl border border-sell/40 bg-sell/10 text-risk transition active:scale-[0.98]" aria-label={`删除 ${plan.title}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </section>

      {isEditingPlan ? (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">编辑计划</h3>
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
            <button type="button" onClick={savePlanEdits} className="h-11 rounded-xl bg-buy text-xs font-bold text-white transition active:scale-[0.98]">
              保存计划
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">添加记录</h3>
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
          <h3 className="text-xl font-bold text-white">计划时间线</h3>
          <span className="text-xs font-semibold text-muted">{timeline.length} 条</span>
        </div>

        {timeline.length > 0 ? (
          timeline.map((event) =>
            event.type === "operation" ? (
              <div key={event.item.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${getActionTone(event.item.action)}`}>
                    {getActionLabel(event.item.action)}
                  </span>
                  <span className="text-xs text-muted">{formatDateTime(event.item.tradeTime)}</span>
                </div>
                <p className="text-sm font-bold tabular-nums text-white">{formatCurrency(event.item.price, event.item.currency)}</p>
                <p className="mt-2 text-sm leading-6 text-muted-strong">{event.item.decisionReason}</p>
                {event.item.psychologyNote ? <p className="mt-2 text-xs leading-5 text-muted">{event.item.psychologyNote}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...event.item.emotionTags, ...event.item.strategyTags].map((tag) => (
                    <span key={tag} className="rounded-full border border-line bg-surface-soft px-2 py-1 text-xs text-muted-strong">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div key={event.item.id} className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-primary-soft">独立复盘 · {getRealizedResultLabel(event.item.realizedResult)}</span>
                  <span className="text-xs text-muted">{formatDateTime(event.item.reviewTime)}</span>
                </div>
                <p className="text-sm leading-6 text-muted-strong">{event.item.reviewNote}</p>
                {typeof event.item.profitLoss === "number" ? (
                  <p className="mt-2 text-sm font-bold tabular-nums text-white">{formatCurrency(event.item.profitLoss, plan.currency)}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {[...event.item.violatedRules, ...event.item.emotionTags].map((tag) => (
                    <span key={tag} className="rounded-full border border-line bg-surface-soft px-2 py-1 text-xs text-muted-strong">
                      {tag}
                    </span>
                  ))}
                </div>
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
      <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
    </div>
  );
}

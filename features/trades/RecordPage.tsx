"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { currencyOptions } from "@/lib/sample-data";
import type { CurrencyCode, PlanReview, TradeOperation, TradePlan } from "@/lib/types";
import { PlanOperationForm } from "./PlanOperationForm";
import { PlanReviewForm } from "./PlanReviewForm";

type RecordMode = "operation" | "review";

type RecordPageProps = {
  plans: TradePlan[];
  selectedPlanId: string | null;
  onSelectPlan: (planId: string) => void;
  onCreatePlan: (plan: TradePlan) => void;
  onAddOperation: (operation: TradeOperation) => void;
  onAddReview: (review: PlanReview) => void;
};

type PlanErrors = Partial<Record<"assetName" | "title" | "thesis", string>>;

export function RecordPage({
  plans,
  selectedPlanId,
  onSelectPlan,
  onCreatePlan,
  onAddOperation,
  onAddReview
}: RecordPageProps) {
  const [mode, setMode] = useState<RecordMode>("operation");
  const [showPlanForm, setShowPlanForm] = useState(plans.length === 0);
  const [title, setTitle] = useState("");
  const [assetName, setAssetName] = useState("");
  const [ticker, setTicker] = useState("");
  const [market, setMarket] = useState("HKG");
  const [currency, setCurrency] = useState<CurrencyCode>("HKD");
  const [thesis, setThesis] = useState("");
  const [errors, setErrors] = useState<PlanErrors>({});
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0],
    [plans, selectedPlanId]
  );

  const createPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: PlanErrors = {};

    if (!assetName.trim()) {
      nextErrors.assetName = "请填写计划标的。";
    }

    if (!title.trim()) {
      nextErrors.title = "请填写计划名称。";
    }

    if (!thesis.trim()) {
      nextErrors.thesis = "请写下计划假设。";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    const plan: TradePlan = {
      id: `plan-${Date.now()}`,
      title: title.trim(),
      assetName: assetName.trim(),
      ticker: ticker.trim() || assetName.trim(),
      market: market.trim() || "自选",
      currency,
      status: "active",
      thesis: thesis.trim(),
      operations: [],
      reviews: [],
      createdAt: now,
      updatedAt: now
    };

    onCreatePlan(plan);
    setTitle("");
    setAssetName("");
    setTicker("");
    setMarket("HKG");
    setCurrency("HKD");
    setThesis("");
    setErrors({});
    setShowPlanForm(false);
  };

  const fieldClassName = (field: keyof PlanErrors) =>
    `rt-input ${errors[field] ? "border-risk bg-sell/15 ring-2 ring-risk/60" : ""}`;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Phase 1</p>
        <h2 className="mt-1 text-2xl font-bold text-white">计划内记录</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          先建立一个标的计划，再把观察、买卖操作和独立复盘挂到这个计划里。
        </p>
      </div>

      <section className="rt-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="rt-label">当前计划</p>
            <p className="mt-1 text-sm font-bold text-white">{selectedPlan?.title ?? "暂无计划"}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanForm((current) => !current)}
            className="flex h-10 items-center gap-1 rounded-xl border border-primary/40 bg-primary/10 px-3 text-xs font-bold text-primary-soft"
          >
            <Plus className="h-4 w-4" />
            新计划
          </button>
        </div>

        {plans.length > 0 ? (
          <select
            className="rt-input"
            value={selectedPlan?.id ?? ""}
            onChange={(event) => onSelectPlan(event.target.value)}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title} · {plan.assetName}
              </option>
            ))}
          </select>
        ) : null}

        {showPlanForm ? (
          <form className="space-y-3 rounded-2xl border border-line bg-background p-3" onSubmit={createPlan}>
            <label className="space-y-2">
              <span className="rt-label">计划名称</span>
              <input className={fieldClassName("title")} value={title} onChange={(event) => setTitle(event.target.value)} />
              {errors.title ? <p className="text-xs font-semibold text-risk">{errors.title}</p> : null}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className="rt-label">标的</span>
                <input className={fieldClassName("assetName")} value={assetName} onChange={(event) => setAssetName(event.target.value)} />
                {errors.assetName ? <p className="text-xs font-semibold text-risk">{errors.assetName}</p> : null}
              </label>
              <label className="space-y-2">
                <span className="rt-label">代码</span>
                <input className="rt-input" value={ticker} onChange={(event) => setTicker(event.target.value)} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className="rt-label">市场</span>
                <input className="rt-input" value={market} onChange={(event) => setMarket(event.target.value)} />
              </label>
              <label className="space-y-2">
                <span className="rt-label">币种</span>
                <select className="rt-input" value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>
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
              <textarea className={`${fieldClassName("thesis")} min-h-24 resize-none leading-6`} value={thesis} onChange={(event) => setThesis(event.target.value)} />
              {errors.thesis ? <p className="text-xs font-semibold text-risk">{errors.thesis}</p> : null}
            </label>
            <button type="submit" className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-white">
              创建计划
            </button>
          </form>
        ) : null}
      </section>

      {selectedPlan ? (
        <>
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: "operation", label: "添加操作" },
              { value: "review", label: "添加复盘" }
            ]}
          />
          {mode === "operation" ? (
            <PlanOperationForm plan={selectedPlan} onSave={onAddOperation} />
          ) : (
            <PlanReviewForm plan={selectedPlan} onSave={onAddReview} />
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-muted-strong">
          先创建一个计划，再记录操作或复盘。
        </div>
      )}
    </main>
  );
}

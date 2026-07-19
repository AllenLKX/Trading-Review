"use client";

import { type FormEvent, useState } from "react";
import { Check, X } from "lucide-react";
import { ChipGroup } from "@/components/ChipGroup";
import { SegmentedControl } from "@/components/SegmentedControl";
import { emotionOptions } from "@/lib/sample-data";
import type { PlanReview, RealizedResult, TradePlan } from "@/lib/types";

const violatedRuleOptions = ["未按计划", "追高", "止损拖延", "仓位过重", "消息驱动", "过早离场"];

type PlanReviewFormProps = {
  plan: TradePlan;
  onSave: (review: PlanReview) => Promise<void>;
  initialReview?: PlanReview;
  submitLabel?: string;
  onCancel?: () => void;
};

const toDateTimeLocalValue = (isoValue?: string) => {
  if (!isoValue) {
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return localNow.toISOString().slice(0, 16);
  }

  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return isoValue.slice(0, 16);
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const toFieldValue = (value?: number) => (typeof value === "number" ? String(value) : "");

export function PlanReviewForm({
  plan,
  onSave,
  initialReview,
  submitLabel = "保存独立复盘",
  onCancel
}: PlanReviewFormProps) {
  const isEditing = Boolean(initialReview);
  const [reviewTime, setReviewTime] = useState(toDateTimeLocalValue(initialReview?.reviewTime));
  const [realizedResult, setRealizedResult] = useState<RealizedResult>(initialReview?.realizedResult ?? "met");
  const [profitLoss, setProfitLoss] = useState(toFieldValue(initialReview?.profitLoss));
  const [violatedRules, setViolatedRules] = useState<string[]>(initialReview?.violatedRules ?? []);
  const [reviewNote, setReviewNote] = useState(initialReview?.reviewNote ?? "");
  const [emotions, setEmotions] = useState<string[]>(initialReview?.emotionTags ?? ["冷静"]);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!reviewNote.trim()) {
      setError("请填写复盘备注。");
      return;
    }

    const now = new Date().toISOString();
    const numericProfitLoss = profitLoss.trim() === "" ? undefined : Number(profitLoss);

    setIsSaving(true);
    setSaveError("");
    try {
      await onSave({
        id: initialReview?.id ?? `review-${Date.now()}`,
        planId: plan.id,
        reviewTime: new Date(reviewTime).toISOString(),
        operationIds: initialReview?.operationIds,
        realizedResult,
        profitLoss: Number.isFinite(numericProfitLoss) ? numericProfitLoss : undefined,
        violatedRules,
        reviewNote: reviewNote.trim(),
        emotionTags: emotions,
        createdAt: initialReview?.createdAt ?? now,
        updatedAt: now
      });

      setError("");
      if (isEditing) onCancel?.();
      else {
        setReviewTime(toDateTimeLocalValue());
        setRealizedResult("met");
        setProfitLoss("");
        setViolatedRules([]);
        setReviewNote("");
        setEmotions(["冷静"]);
      }
    } catch (saveFailure) {
      setSaveError(saveFailure instanceof Error ? saveFailure.message : "保存失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rt-card space-y-5 p-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
          <p className="text-sm font-bold text-primary-soft">独立复盘 · {plan.title}</p>
          <p className="mt-1 text-xs text-muted">可以不关联任何操作，直接记录阶段性判断。</p>
        </div>

        <label className="space-y-2">
          <span className="rt-label">复盘时间</span>
          <input className="rt-input" type="datetime-local" value={reviewTime} onChange={(event) => setReviewTime(event.target.value)} />
        </label>

        <div className="space-y-2">
          <span className="rt-label">实际结果</span>
          <SegmentedControl
            value={realizedResult}
            onChange={setRealizedResult}
            options={[
              { value: "met", label: "符合预期" },
              { value: "partial", label: "部分符合" },
              { value: "missed", label: "不符合预期" }
            ]}
          />
        </div>

        <label className="space-y-2">
          <span className="rt-label">实际盈亏 · {plan.currency}</span>
          <input className="rt-input text-right tabular-nums" inputMode="decimal" value={profitLoss} onChange={(event) => setProfitLoss(event.target.value)} />
        </label>

        <div className="space-y-2">
          <span className="rt-label">是否违反计划</span>
          <ChipGroup options={violatedRuleOptions} selected={violatedRules} onToggle={(value) => toggle(value, violatedRules, setViolatedRules)} />
        </div>

        <label className="space-y-2">
          <span className="rt-label">复盘备注</span>
          <textarea
            aria-invalid={Boolean(error)}
            className={`rt-input min-h-28 resize-none leading-6 ${error ? "border-risk bg-sell/15 ring-2 ring-risk/60" : ""}`}
            value={reviewNote}
            onChange={(event) => {
              setReviewNote(event.target.value);
              setError("");
            }}
          />
          {error ? <p className="text-xs font-semibold text-risk">{error}</p> : null}
        </label>

        <div className="space-y-2">
          <span className="rt-label">复盘情绪</span>
          <ChipGroup options={emotionOptions} selected={emotions} onToggle={(value) => toggle(value, emotions, setEmotions)} />
        </div>
      </div>

      {saveError ? <p className="rounded-xl border border-sell/50 bg-sell/10 px-3 py-2 text-xs font-semibold text-risk">{saveError} 已填写内容仍保留。</p> : null}

      <div className={onCancel ? "grid grid-cols-[1fr_1.3fr] gap-2" : ""}>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={isSaving} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-background text-sm font-bold text-muted-strong transition active:scale-[0.99] disabled:opacity-60">
            <X className="h-5 w-5" />
            取消
          </button>
        ) : null}
        <button type="submit" disabled={isSaving} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/20 transition active:scale-[0.99] disabled:opacity-60">
          <Check className="h-5 w-5" />
          {isSaving ? "正在保存…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

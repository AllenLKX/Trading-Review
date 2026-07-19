"use client";

import { type FormEvent, useState } from "react";
import { Save, X } from "lucide-react";
import { ChipGroup } from "@/components/ChipGroup";
import { SegmentedControl } from "@/components/SegmentedControl";
import { emotionOptions, strategyOptions } from "@/lib/sample-data";
import { formatCurrency } from "@/lib/format";
import type { QuantityUnit, TradeAction, TradeOperation, TradePlan } from "@/lib/types";
import { TradeActionToggle } from "./TradeActionToggle";

type PlanOperationFormProps = {
  plan: TradePlan;
  onSave: (operation: TradeOperation) => Promise<void>;
  initialOperation?: TradeOperation;
  submitLabel?: string;
  onCancel?: () => void;
};

type FieldErrors = Partial<Record<"price" | "positionSize" | "decisionReason" | "emotions", string>>;

const toDateTimeLocalValue = (isoValue?: string) => {
  if (!isoValue) {
    return "2026-06-07T10:30";
  }

  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return isoValue.slice(0, 16);
  }

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const toFieldValue = (value?: number) => (typeof value === "number" ? String(value) : "");

export function PlanOperationForm({
  plan,
  onSave,
  initialOperation,
  submitLabel = "保存到当前计划",
  onCancel
}: PlanOperationFormProps) {
  const isEditing = Boolean(initialOperation);
  const [action, setAction] = useState<TradeAction>(initialOperation?.action ?? "observe");
  const [tradeTime, setTradeTime] = useState(toDateTimeLocalValue(initialOperation?.tradeTime));
  const [price, setPrice] = useState(toFieldValue(initialOperation?.price));
  const [positionSize, setPositionSize] = useState(toFieldValue(initialOperation?.quantity));
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>(initialOperation?.quantityUnit ?? "shares");
  const [takeProfitPrice, setTakeProfitPrice] = useState(toFieldValue(initialOperation?.takeProfitPrice));
  const [stopLossPrice, setStopLossPrice] = useState(toFieldValue(initialOperation?.stopLossPrice));
  const [decisionReason, setDecisionReason] = useState(initialOperation?.decisionReason ?? "");
  const [psychologyNote, setPsychologyNote] = useState(initialOperation?.psychologyNote ?? "");
  const [emotions, setEmotions] = useState<string[]>(initialOperation?.emotionTags ?? ["冷静"]);
  const [strategies, setStrategies] = useState<string[]>(initialOperation?.strategyTags ?? ["右侧交易"]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const numericPrice = Number(price);
  const numericPositionSize = Number(positionSize);
  const totalAmount =
    action === "observe"
      ? undefined
      : quantityUnit === "shares"
        ? numericPrice > 0 && numericPositionSize > 0
          ? numericPrice * numericPositionSize
          : undefined
        : numericPositionSize > 0
          ? numericPositionSize
          : undefined;

  const toggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const resetForm = () => {
    setPrice("");
    setPositionSize("");
    setTakeProfitPrice("");
    setStopLossPrice("");
    setDecisionReason("");
    setPsychologyNote("");
    setEmotions(["冷静"]);
    setStrategies(["右侧交易"]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const now = new Date().toISOString();

    setIsSaving(true);
    setSaveError("");
    try {
      await onSave({
        id: initialOperation?.id ?? `operation-${Date.now()}`,
        planId: plan.id,
        action,
        tradeTime: new Date(tradeTime).toISOString(),
        currency: plan.currency,
        price: numericPrice || undefined,
        quantity: action === "observe" ? undefined : numericPositionSize || undefined,
        quantityUnit: action === "observe" ? undefined : quantityUnit,
        totalAmount,
        takeProfitPrice: Number(takeProfitPrice) || undefined,
        stopLossPrice: Number(stopLossPrice) || undefined,
        decisionReason: decisionReason.trim(),
        psychologyNote: psychologyNote.trim() || undefined,
        emotionTags: emotions,
        strategyTags: strategies,
        source: initialOperation?.source ?? "manual",
        createdAt: initialOperation?.createdAt ?? now,
        updatedAt: now
      });

      setErrors({});
      if (isEditing) onCancel?.();
      else resetForm();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  };

  const validateForm = () => {
    const nextErrors: FieldErrors = {};

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      nextErrors.price = action === "observe" ? "请填写观察价格。" : "请填写有效价格。";
    }

    if (action !== "observe" && (!Number.isFinite(numericPositionSize) || numericPositionSize <= 0)) {
      nextErrors.positionSize = quantityUnit === "shares" ? "请填写股数。" : "请填写份额金额。";
    }

    if (!decisionReason.trim()) {
      nextErrors.decisionReason = "请填写一句话操作理由。";
    }

    if (emotions.length === 0) {
      nextErrors.emotions = "请至少选择一个情绪标签。";
    }

    return nextErrors;
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const fieldClassName = (field: keyof FieldErrors, extra = "") =>
    `rt-input ${errors[field] ? "border-risk bg-sell/15 ring-2 ring-risk/60" : ""} ${extra}`.trim();

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rt-card space-y-5 p-4">
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
          <p className="text-sm font-bold text-primary-soft">{plan.title}</p>
          <p className="mt-1 text-xs text-muted">
            {plan.assetName} · {plan.ticker} · {plan.currency}
          </p>
        </div>

        <div className="space-y-2">
          <label className="rt-label">操作方向</label>
          <TradeActionToggle
            value={action}
            onChange={(nextAction) => {
              setAction(nextAction);
              if (nextAction === "observe") {
                setPositionSize("");
              }
            }}
          />
        </div>

        <label className="space-y-2">
          <span className="rt-label">操作时间</span>
          <input className="rt-input" type="datetime-local" value={tradeTime} onChange={(event) => setTradeTime(event.target.value)} />
        </label>

        {action !== "observe" ? (
          <div className="space-y-2">
            <span className="rt-label">数量单位</span>
            <SegmentedControl
              value={quantityUnit}
              onChange={(nextUnit) => {
                setQuantityUnit(nextUnit);
                setPositionSize("");
              }}
              options={[
                { value: "shares", label: "股数" },
                { value: "units", label: "份额" }
              ]}
            />
          </div>
        ) : null}

        <div className={action === "observe" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
          <label className="space-y-2">
            <span className="rt-label">{action === "sell" ? "卖出价格" : action === "buy" ? "买入价格" : "观察价格"}</span>
            <input
              aria-invalid={Boolean(errors.price)}
              className={fieldClassName("price", "text-right tabular-nums")}
              inputMode="decimal"
              placeholder={`${plan.currency} 0.00`}
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                clearFieldError("price");
              }}
            />
            {errors.price ? <p className="text-xs font-semibold text-risk">{errors.price}</p> : null}
          </label>

          {action !== "observe" ? (
            <label className="space-y-2">
              <span className="rt-label">{quantityUnit === "shares" ? "股数" : "份额"}</span>
              <input
                aria-invalid={Boolean(errors.positionSize)}
                className={fieldClassName("positionSize", "text-right tabular-nums")}
                inputMode="decimal"
                placeholder={quantityUnit === "shares" ? "0" : `${plan.currency} 0.00`}
                value={positionSize}
                onChange={(event) => {
                  setPositionSize(event.target.value);
                  clearFieldError("positionSize");
                }}
              />
              {errors.positionSize ? <p className="text-xs font-semibold text-risk">{errors.positionSize}</p> : null}
            </label>
          ) : null}
        </div>

        {action !== "observe" ? (
          <div className="rounded-2xl border border-line bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="rt-label">总金额</span>
              <span className="text-lg font-bold tabular-nums text-white">{formatCurrency(totalAmount, plan.currency)}</span>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2">
            <span className="rt-label">预期止盈 · {plan.currency}</span>
            <input className="rt-input text-right tabular-nums" inputMode="decimal" value={takeProfitPrice} onChange={(event) => setTakeProfitPrice(event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="rt-label">预期止损 · {plan.currency}</span>
            <input className="rt-input text-right tabular-nums" inputMode="decimal" value={stopLossPrice} onChange={(event) => setStopLossPrice(event.target.value)} />
          </label>
        </div>

        <label className="space-y-2">
          <span className="rt-label">一句话操作理由</span>
          <textarea
            aria-invalid={Boolean(errors.decisionReason)}
            className={fieldClassName("decisionReason", "min-h-24 resize-none leading-6")}
            value={decisionReason}
            onChange={(event) => {
              setDecisionReason(event.target.value);
              clearFieldError("decisionReason");
            }}
          />
          {errors.decisionReason ? <p className="text-xs font-semibold text-risk">{errors.decisionReason}</p> : null}
        </label>

        <label className="space-y-2">
          <span className="rt-label">心理活动补充</span>
          <textarea className="rt-input min-h-20 resize-none leading-6" value={psychologyNote} onChange={(event) => setPsychologyNote(event.target.value)} />
        </label>

        <div className={`space-y-2 rounded-2xl ${errors.emotions ? "border border-risk bg-sell/15 p-3 ring-2 ring-risk/40" : ""}`}>
          <span className="rt-label">情绪标签</span>
          <ChipGroup options={emotionOptions} selected={emotions} onToggle={(value) => toggle(value, emotions, setEmotions)} />
          {errors.emotions ? <p className="text-xs font-semibold text-risk">{errors.emotions}</p> : null}
        </div>

        <div className="space-y-2">
          <span className="rt-label">策略标签</span>
          <ChipGroup options={strategyOptions} selected={strategies} onToggle={(value) => toggle(value, strategies, setStrategies)} />
        </div>
      </div>

      {Object.keys(errors).length > 0 ? (
        <div className="rounded-2xl border border-sell/40 bg-sell/10 p-4">
          <p className="text-sm font-bold text-risk">保存前请补充信息</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-200">
            {Object.values(errors).map((error) => (
              <li key={error}>· {error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {saveError ? <p className="rounded-xl border border-sell/50 bg-sell/10 px-3 py-2 text-xs font-semibold text-risk">{saveError} 已填写内容仍保留。</p> : null}

      <div className={onCancel ? "grid grid-cols-[1fr_1.3fr] gap-2" : ""}>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={isSaving} className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-background text-sm font-bold text-muted-strong transition active:scale-[0.99] disabled:opacity-60">
            <X className="h-5 w-5" />
            取消
          </button>
        ) : null}
        <button type="submit" disabled={isSaving} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-buy text-sm font-bold text-white shadow-lg shadow-buy/20 transition active:scale-[0.99] disabled:opacity-60">
          <Save className="h-5 w-5" />
          {isSaving ? "正在保存…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

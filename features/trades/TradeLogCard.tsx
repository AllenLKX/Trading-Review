"use client";

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Pencil, Sparkles, X } from "lucide-react";
import { ChipGroup } from "@/components/ChipGroup";
import { SegmentedControl } from "@/components/SegmentedControl";
import { getActionLabel, getActionTone, formatCurrency, formatDateTime, getQuantityUnitLabel } from "@/lib/format";
import { emotionOptions, strategyOptions } from "@/lib/sample-data";
import type { QuantityUnit, TradeDecision } from "@/lib/types";

type TradeLogCardProps = {
  trade: TradeDecision;
  isHighlighted?: boolean;
  onUpdate: (trade: TradeDecision) => void;
};

type EditState = {
  assetName: string;
  ticker: string;
  price: string;
  quantity: string;
  quantityUnit: QuantityUnit;
  takeProfitPrice: string;
  stopLossPrice: string;
  decisionReason: string;
  psychologyNote: string;
  emotionTags: string[];
  strategyTags: string[];
};

type EditErrors = Partial<Record<"assetName" | "price" | "quantity" | "decisionReason" | "emotionTags", string>>;

export function TradeLogCard({ trade, isHighlighted = false, onUpdate }: TradeLogCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>(() => buildEditState(trade));
  const [errors, setErrors] = useState<EditErrors>({});
  const sourceLabel = trade.source === "manual" ? "手动记录" : trade.source === "ai_screenshot" ? "截图确认" : "示例数据";
  const numericPrice = Number(editState.price);
  const numericQuantity = Number(editState.quantity);
  const editedTotalAmount =
    trade.action === "observe"
      ? undefined
      : editState.quantityUnit === "shares"
      ? numericPrice > 0 && numericQuantity > 0
        ? numericPrice * numericQuantity
        : undefined
      : numericQuantity > 0
        ? numericQuantity
        : undefined;

  const updateEditState = (patch: Partial<EditState>) => {
    setEditState((current) => ({ ...current, ...patch }));
  };

  const clearError = (field: keyof EditErrors) => {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const toggleTag = (tag: string, field: "emotionTags" | "strategyTags") => {
    const currentTags = editState[field];
    updateEditState({
      [field]: currentTags.includes(tag) ? currentTags.filter((item) => item !== tag) : [...currentTags, tag]
    });

    if (field === "emotionTags") {
      clearError("emotionTags");
    }
  };

  const startEditing = () => {
    setEditState(buildEditState(trade));
    setErrors({});
    setIsExpanded(true);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setEditState(buildEditState(trade));
    setErrors({});
    setIsEditing(false);
  };

  const saveEditing = () => {
    const nextErrors = validateEditState(editState, trade.action);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const now = new Date().toISOString();
    onUpdate({
      ...trade,
      assetName: editState.assetName.trim(),
      ticker: editState.ticker.trim() || editState.assetName.trim(),
      price: Number(editState.price),
      quantity: trade.action === "observe" ? undefined : Number(editState.quantity),
      quantityUnit: trade.action === "observe" ? undefined : editState.quantityUnit,
      totalAmount: editedTotalAmount,
      takeProfitPrice: Number(editState.takeProfitPrice) || undefined,
      stopLossPrice: Number(editState.stopLossPrice) || undefined,
      decisionReason: editState.decisionReason.trim(),
      psychologyNote: editState.psychologyNote.trim() || undefined,
      emotionTags: editState.emotionTags,
      strategyTags: editState.strategyTags,
      updatedAt: now
    });
    setIsEditing(false);
    setErrors({});
  };

  const fieldClassName = (field: keyof EditErrors, extra = "") =>
    `rt-input ${errors[field] ? "border-risk bg-sell/15 ring-2 ring-risk/60" : ""} ${extra}`.trim();
  const errorMessages = Object.values(errors).filter(Boolean);

  return (
    <article
      className={`rounded-2xl border bg-surface p-4 transition ${
        isHighlighted ? "border-primary shadow-glow" : "border-line"
      }`}
    >
      {isHighlighted ? (
        <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary-soft">
          刚刚新增或修改
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-white">{trade.assetName}</h3>
            <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${getActionTone(trade.action)}`}>
              {getActionLabel(trade.action)}
            </span>
          </div>
          <p className="text-xs text-muted">
            {trade.market}: {trade.ticker}
            {trade.quantity && trade.quantityUnit ? ` · ${trade.quantity} ${getQuantityUnitLabel(trade.quantityUnit)}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-white">{formatCurrency(trade.price, trade.currency)}</p>
          <p className="mt-1 text-xs text-muted">{formatDateTime(trade.tradeTime)}</p>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-4 space-y-4 rounded-2xl border border-primary/30 bg-background p-4">
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-2">
              <span className="rt-label">标的名称</span>
              <input
                aria-invalid={Boolean(errors.assetName)}
                className={fieldClassName("assetName")}
                value={editState.assetName}
                onChange={(event) => {
                  updateEditState({ assetName: event.target.value });
                  clearError("assetName");
                }}
              />
              {errors.assetName ? <p className="text-xs font-semibold text-risk">{errors.assetName}</p> : null}
            </label>

            <label className="space-y-2">
              <span className="rt-label">代码</span>
              <input
                className="rt-input"
                value={editState.ticker}
                onChange={(event) => updateEditState({ ticker: event.target.value })}
              />
            </label>
          </div>

          {trade.action !== "observe" ? (
            <div className="space-y-2">
              <span className="rt-label">数量单位</span>
              <SegmentedControl
                value={editState.quantityUnit}
                onChange={(nextUnit) => {
                  updateEditState({ quantityUnit: nextUnit, quantity: "" });
                  clearError("quantity");
                }}
                options={[
                  { value: "shares", label: "股数" },
                  { value: "units", label: "份额" }
                ]}
              />
            </div>
          ) : null}

          <div className={trade.action === "observe" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
            <label className="space-y-2">
              <span className="rt-label">{trade.action === "observe" ? "观察价格" : "成交价格"} · {trade.currency}</span>
              <input
                aria-invalid={Boolean(errors.price)}
                className={fieldClassName("price", "text-right tabular-nums")}
                inputMode="decimal"
                value={editState.price}
                onChange={(event) => {
                  updateEditState({ price: event.target.value });
                  clearError("price");
                }}
              />
              {errors.price ? <p className="text-xs font-semibold text-risk">{errors.price}</p> : null}
            </label>
            {trade.action !== "observe" ? (
              <label className="space-y-2">
                <span className="rt-label">{editState.quantityUnit === "shares" ? "股数" : "份额"}</span>
                <input
                  aria-invalid={Boolean(errors.quantity)}
                  className={fieldClassName("quantity", "text-right tabular-nums")}
                  inputMode="decimal"
                  value={editState.quantity}
                  onChange={(event) => {
                    updateEditState({ quantity: event.target.value });
                    clearError("quantity");
                  }}
                />
                {errors.quantity ? <p className="text-xs font-semibold text-risk">{errors.quantity}</p> : null}
              </label>
            ) : null}
          </div>

          {trade.action !== "observe" ? (
            <div className="rounded-xl border border-line bg-surface-soft p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="rt-label">总金额</span>
                <span className="font-bold tabular-nums text-white">{formatCurrency(editedTotalAmount, trade.currency)}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">
                {editState.quantityUnit === "shares" ? "股数按价格乘以数量计算。" : "份额金额直接作为总金额保存。"}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2">
              <span className="rt-label">预期止盈 · {trade.currency}</span>
              <input
                className="rt-input text-right tabular-nums"
                inputMode="decimal"
                value={editState.takeProfitPrice}
                onChange={(event) => updateEditState({ takeProfitPrice: event.target.value })}
              />
            </label>
            <label className="space-y-2">
              <span className="rt-label">预期止损 · {trade.currency}</span>
              <input
                className="rt-input text-right tabular-nums"
                inputMode="decimal"
                value={editState.stopLossPrice}
                onChange={(event) => updateEditState({ stopLossPrice: event.target.value })}
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="rt-label">一句话决策理由</span>
            <textarea
              aria-invalid={Boolean(errors.decisionReason)}
              className={fieldClassName("decisionReason", "min-h-24 resize-none leading-6")}
              value={editState.decisionReason}
              onChange={(event) => {
                updateEditState({ decisionReason: event.target.value });
                clearError("decisionReason");
              }}
            />
            {errors.decisionReason ? <p className="text-xs font-semibold text-risk">{errors.decisionReason}</p> : null}
          </label>

          <label className="space-y-2">
            <span className="rt-label">心理活动补充</span>
            <textarea
              className="rt-input min-h-20 resize-none leading-6"
              value={editState.psychologyNote}
              onChange={(event) => updateEditState({ psychologyNote: event.target.value })}
            />
          </label>

          <div className={`space-y-2 rounded-2xl ${errors.emotionTags ? "border border-risk bg-sell/15 p-3 ring-2 ring-risk/40" : ""}`}>
            <span className="rt-label">情绪标签</span>
            <ChipGroup options={emotionOptions} selected={editState.emotionTags} onToggle={(tag) => toggleTag(tag, "emotionTags")} />
            {errors.emotionTags ? <p className="text-xs font-semibold text-risk">{errors.emotionTags}</p> : null}
          </div>

          <div className="space-y-2">
            <span className="rt-label">策略标签</span>
            <ChipGroup options={strategyOptions} selected={editState.strategyTags} onToggle={(tag) => toggleTag(tag, "strategyTags")} />
          </div>

          {errorMessages.length > 0 ? (
            <div
              className="rounded-2xl border border-risk bg-sell/15 p-4 ring-2 ring-risk/30"
              role="alert"
              aria-live="polite"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-risk">还有 {errorMessages.length} 项需要修改后才能保存</p>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-100">
                    {errorMessages.map((error) => (
                      <li key={error}>· {error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong transition active:scale-[0.98]"
            >
              <X className="h-4 w-4" />
              取消
            </button>
            <button
              type="button"
              onClick={saveEditing}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-buy text-xs font-bold text-white transition active:scale-[0.98]"
            >
              <Check className="h-4 w-4" />
              保存修改
            </button>
          </div>
        </div>
      ) : (
        <>
          {trade.action !== "observe" ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-line bg-background p-3">
                <p className="text-[11px] font-semibold text-muted">
                  {trade.quantityUnit ? getQuantityUnitLabel(trade.quantityUnit) : "数量"}
                </p>
                <p className="mt-1 text-sm font-bold tabular-nums text-white">{trade.quantity ?? "--"}</p>
              </div>
              <div className="rounded-xl border border-line bg-background p-3">
                <p className="text-[11px] font-semibold text-muted">总金额</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-white">
                  {formatCurrency(trade.totalAmount, trade.currency)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border-l-2 border-primary bg-background p-3">
            <p className="text-sm leading-6 text-muted-strong">{trade.decisionReason}</p>
            {trade.psychologyNote ? <p className="mt-2 text-xs leading-5 text-muted">{trade.psychologyNote}</p> : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {[...trade.emotionTags, ...trade.strategyTags].map((tag) => (
              <span key={tag} className="rounded-full border border-line bg-surface-soft px-2 py-1 text-xs text-muted-strong">
                {tag}
              </span>
            ))}
          </div>
        </>
      )}

      {isExpanded ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="grid grid-cols-2 gap-2">
            <DetailMetric label="预期止盈" value={formatCurrency(trade.takeProfitPrice, trade.currency)} />
            <DetailMetric label="预期止损" value={formatCurrency(trade.stopLossPrice, trade.currency)} />
            <DetailMetric label="记录来源" value={sourceLabel} />
            <DetailMetric label="复盘状态" value={trade.reviewStatus === "archived" ? "已归档" : "待确认"} />
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary-soft" />
              <p className="text-sm font-bold text-primary-soft">AI 单笔复盘占位</p>
            </div>
            <p className="text-sm leading-6 text-muted-strong">
              后续这里会总结你的原始理由、情绪状态和可能的执行偏差。当前仅作为行为复盘入口，不提供任何买卖建议。
            </p>
            <div className="mt-3 space-y-2 text-xs leading-5 text-muted">
              <p>· 这次操作是否和预先计划一致？</p>
              <p>· 触发操作的是价格条件、消息刺激，还是情绪压力？</p>
              <p>· 止盈止损是否来自你自己填写的计划？</p>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setIsExpanded((current) => !current)}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-background text-xs font-bold text-muted-strong transition active:scale-[0.98]"
      >
        {isExpanded ? "收起复盘详情" : "展开复盘详情"}
        <ChevronDown className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : ""}`} />
      </button>
      {!isEditing ? (
        <button
          type="button"
          onClick={startEditing}
          className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98]"
        >
          <Pencil className="h-4 w-4" />
          编辑这条记录
        </button>
      ) : null}
    </article>
  );
}

function buildEditState(trade: TradeDecision): EditState {
  return {
    assetName: trade.assetName,
    ticker: trade.ticker,
    price: trade.price ? String(trade.price) : "",
    quantity: trade.quantity ? String(trade.quantity) : "",
    quantityUnit: trade.quantityUnit ?? "shares",
    takeProfitPrice: trade.takeProfitPrice ? String(trade.takeProfitPrice) : "",
    stopLossPrice: trade.stopLossPrice ? String(trade.stopLossPrice) : "",
    decisionReason: trade.decisionReason,
    psychologyNote: trade.psychologyNote ?? "",
    emotionTags: trade.emotionTags,
    strategyTags: trade.strategyTags
  };
}

function validateEditState(editState: EditState, action: TradeDecision["action"]) {
  const nextErrors: EditErrors = {};
  const price = Number(editState.price);
  const quantity = Number(editState.quantity);

  if (!editState.assetName.trim()) {
    nextErrors.assetName = "请填写标的名称。";
  }

  if (!Number.isFinite(price) || price <= 0) {
    nextErrors.price = action === "observe" ? "请填写观察价格。" : "请填写有效价格。";
  }

  if (action !== "observe" && (!Number.isFinite(quantity) || quantity <= 0)) {
    nextErrors.quantity = editState.quantityUnit === "shares" ? "请填写股数。" : "请填写份额金额。";
  }

  if (!editState.decisionReason.trim()) {
    nextErrors.decisionReason = "请填写一句话决策理由。";
  }

  if (editState.emotionTags.length === 0) {
    nextErrors.emotionTags = "请至少选择一个情绪标签。";
  }

  return nextErrors;
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-background p-3">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

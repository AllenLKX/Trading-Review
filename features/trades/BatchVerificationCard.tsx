"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { useState } from "react";
import { ChipGroup } from "@/components/ChipGroup";
import { emotionOptions } from "@/lib/sample-data";
import { formatCurrency, formatDateTime, getActionLabel, getActionTone } from "@/lib/format";
import type { BatchRecognitionItem, QuantityUnit } from "@/lib/types";

type BatchVerificationCardProps = {
  item: BatchRecognitionItem;
  defaultOpen?: boolean;
  onChange: (item: BatchRecognitionItem) => void;
  onRemove: (id: string) => void;
};

export function BatchVerificationCard({ item, defaultOpen = false, onChange, onRemove }: BatchVerificationCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  const updateItem = (patch: Partial<BatchRecognitionItem>) => {
    const nextItem = { ...item, ...patch };

    if (patch.price !== undefined || patch.quantity !== undefined || patch.quantityUnit !== undefined) {
      nextItem.totalAmount =
        nextItem.action === "observe"
          ? undefined
          : nextItem.quantityUnit === "units"
            ? nextItem.quantity
            : typeof nextItem.price === "number" && typeof nextItem.quantity === "number"
          ? nextItem.price * nextItem.quantity
          : undefined;
    }

    onChange(nextItem);
  };

  const localDateTime = (() => {
    const date = new Date(item.tradeTime);

    if (Number.isNaN(date.getTime())) {
      return item.tradeTime.slice(0, 16);
    }

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localDate.toISOString().slice(0, 16);
  })();
  const getFieldClassName = (isInvalid: boolean, extra = "") =>
    `rt-input ${isInvalid ? "border-risk bg-sell/15 ring-2 ring-risk/60" : ""} ${extra}`.trim();
  const isAssetNameInvalid = !item.assetName.trim();
  const isTickerInvalid = !item.ticker.trim();
  const isPriceInvalid = item.price <= 0;
  const isQuantityInvalid = item.action !== "observe" && (!item.quantity || item.quantity <= 0);

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left active:bg-surface-raised"
      >
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-lg border px-2 py-1 text-xs font-bold ${getActionTone(item.action)}`}>
              {getActionLabel(item.action)}
            </span>
            <span className="text-xs text-muted">{Math.round(item.confidence * 100)}% 识别可信度</span>
          </div>
          <h3 className="truncate text-base font-bold text-foreground">{item.assetName}</h3>
          <p className="text-xs text-muted">
            {item.market}: {item.ticker} · {item.sourceImageName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums text-foreground">{formatCurrency(item.price, item.currency)}</p>
          <p className="mt-1 text-xs text-muted">{formatDateTime(item.tradeTime)}</p>
          <ChevronDown className={`ml-auto mt-2 h-4 w-4 text-muted transition ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line bg-surface-soft p-4">
          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-2">
              <span className="rt-label">标的名称</span>
              <input
                aria-invalid={isAssetNameInvalid}
                className={getFieldClassName(isAssetNameInvalid)}
                value={item.assetName}
                onChange={(event) => updateItem({ assetName: event.target.value })}
              />
              {isAssetNameInvalid ? <p className="text-xs font-semibold text-risk">请填写标的名称。</p> : null}
            </label>

            <label className="space-y-2">
              <span className="rt-label">代码</span>
              <input
                aria-invalid={isTickerInvalid}
                className={getFieldClassName(isTickerInvalid)}
                value={item.ticker}
                onChange={(event) => updateItem({ ticker: event.target.value })}
              />
              {isTickerInvalid ? <p className="text-xs font-semibold text-risk">请填写代码。</p> : null}
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-2">
              <span className="rt-label">交易时间</span>
              <input
                className="rt-input"
                type="datetime-local"
                value={localDateTime}
                onChange={(event) => updateItem({ tradeTime: new Date(event.target.value).toISOString() })}
              />
            </label>
          </div>

          {item.action !== "observe" ? (
            <label className="space-y-2">
              <span className="rt-label">数量单位</span>
              <select
                className="rt-input"
                value={item.quantityUnit ?? "shares"}
                onChange={(event) => updateItem({ quantityUnit: event.target.value as QuantityUnit, quantity: undefined, totalAmount: undefined })}
              >
                <option value="shares">股数</option>
                <option value="units">份额</option>
              </select>
            </label>
          ) : null}

          <div className={item.action === "observe" ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
            <label className="space-y-2">
              <span className="rt-label">价格 · {item.currency}</span>
              <input
                aria-invalid={isPriceInvalid}
                className={getFieldClassName(isPriceInvalid, "text-right tabular-nums")}
                inputMode="decimal"
                value={item.price}
                onChange={(event) => updateItem({ price: Number(event.target.value) || 0 })}
              />
              {isPriceInvalid ? <p className="text-xs font-semibold text-risk">请填写有效价格。</p> : null}
            </label>

            {item.action !== "observe" ? (
              <label className="space-y-2">
                <span className="rt-label">{item.quantityUnit === "units" ? "份额" : "股数"}</span>
                <input
                  aria-invalid={isQuantityInvalid}
                  className={getFieldClassName(isQuantityInvalid, "text-right tabular-nums")}
                  inputMode="decimal"
                  placeholder={item.quantityUnit === "units" ? `${item.currency} 0.00` : "0"}
                  value={item.quantity ?? ""}
                  onChange={(event) => updateItem({ quantity: Number(event.target.value) || undefined })}
                />
                {isQuantityInvalid ? <p className="text-xs font-semibold text-risk">{item.quantityUnit === "units" ? "请填写份额金额。" : "请填写股数。"}</p> : null}
              </label>
            ) : null}
          </div>

          {item.action !== "observe" ? (
            <div className="rounded-xl border border-line bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="rt-label">归档金额</span>
                <span className="font-bold tabular-nums text-foreground">{formatCurrency(item.totalAmount, item.currency)}</span>
              </div>
            </div>
          ) : null}

          <label className="space-y-2">
            <span className="rt-label">心理活动补充</span>
            <textarea
              className="rt-input min-h-24 resize-none leading-6"
              value={item.psychologyNote}
              onChange={(event) => updateItem({ psychologyNote: event.target.value })}
            />
          </label>

          <div className="space-y-2">
            <span className="rt-label">确认情绪</span>
            <ChipGroup
              options={emotionOptions}
              selected={item.emotionTags}
              onToggle={(value) => {
                const nextEmotionTags = item.emotionTags.includes(value)
                  ? item.emotionTags.filter((itemValue) => itemValue !== value)
                  : [...item.emotionTags, value];

                updateItem({ emotionTags: nextEmotionTags });
              }}
            />
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex items-center gap-1 text-sm font-semibold text-risk"
            >
              <Trash2 className="h-4 w-4" />
              移除本条
            </button>
            <span className="text-xs text-muted">确认后才会归档</span>
          </div>
        </div>
      ) : null}
    </article>
  );
}

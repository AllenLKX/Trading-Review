"use client";

import { type FormEvent, useState } from "react";
import { Save } from "lucide-react";
import { ChipGroup } from "@/components/ChipGroup";
import { SegmentedControl } from "@/components/SegmentedControl";
import { currencyOptions, emotionOptions, strategyOptions } from "@/lib/sample-data";
import { formatCurrency } from "@/lib/format";
import type { CurrencyCode, QuantityUnit, TradeAction, TradeDecision } from "@/lib/types";
import { TradeActionToggle } from "./TradeActionToggle";

type TradeDecisionFormProps = {
  onSave: (trade: TradeDecision) => void;
};

type FieldErrors = Partial<Record<"assetName" | "price" | "positionSize" | "decisionReason" | "emotions", string>>;

export function TradeDecisionForm({ onSave }: TradeDecisionFormProps) {
  const [action, setAction] = useState<TradeAction>("observe");
  const [assetName, setAssetName] = useState("");
  const [tradeTime, setTradeTime] = useState("2026-06-07T10:30");
  const [currency, setCurrency] = useState<CurrencyCode>("HKD");
  const [price, setPrice] = useState("");
  const [positionSize, setPositionSize] = useState("");
  const [quantityUnit, setQuantityUnit] = useState<QuantityUnit>("shares");
  const [takeProfitPrice, setTakeProfitPrice] = useState("");
  const [stopLossPrice, setStopLossPrice] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [emotions, setEmotions] = useState<string[]>(["冷静"]);
  const [strategies, setStrategies] = useState<string[]>(["右侧交易"]);
  const [savedMessage, setSavedMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

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
    setAssetName("");
    setPrice("");
    setPositionSize("");
    setTakeProfitPrice("");
    setStopLossPrice("");
    setDecisionReason("");
    setEmotions(["冷静"]);
    setStrategies(["右侧交易"]);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setSavedMessage("");
      return;
    }

    const now = new Date().toISOString();
    const normalizedAssetName = assetName.trim() || "未命名标的";
    const normalizedTradeTime = new Date(tradeTime).toISOString();

    onSave({
      id: `trade-${Date.now()}`,
      action,
      assetName: normalizedAssetName,
      ticker: normalizedAssetName,
      market: "手动记录",
      tradeTime: normalizedTradeTime,
      currency,
      price: numericPrice || undefined,
      quantity: action === "observe" ? undefined : numericPositionSize || undefined,
      quantityUnit: action === "observe" ? undefined : quantityUnit,
      totalAmount,
      takeProfitPrice: Number(takeProfitPrice) || undefined,
      stopLossPrice: Number(stopLossPrice) || undefined,
      decisionReason: decisionReason.trim() || "已记录本次决策，待后续补充复盘理由。",
      psychologyNote: "来自手动记录，后续可补充更完整的心理活动。",
      emotionTags: emotions,
      strategyTags: strategies,
      source: "manual",
      reviewStatus: "archived",
      errorTags: [],
      realizedResult: "unknown",
      violatedRules: [],
      createdAt: now,
      updatedAt: now
    });

    setErrors({});
    setSavedMessage("已保存到历史流水");
    resetForm();
  };

  const validateForm = () => {
    const nextErrors: FieldErrors = {};

    if (!assetName.trim()) {
      nextErrors.assetName = "请填写标的名称。";
    }

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      nextErrors.price = action === "observe" ? "请填写观察价格。" : "请填写有效价格。";
    }

    if (action !== "observe" && (!Number.isFinite(numericPositionSize) || numericPositionSize <= 0)) {
      nextErrors.positionSize = quantityUnit === "shares" ? "请填写股数。" : "请填写份额金额。";
    }

    if (!decisionReason.trim()) {
      nextErrors.decisionReason = "请填写一句话决策理由。";
    }

    if (emotions.length === 0) {
      nextErrors.emotions = "请至少选择一个情绪标签。";
    }

    return nextErrors;
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const fieldClassName = (field: keyof FieldErrors, extra = "") =>
    `rt-input ${errors[field] ? "border-risk bg-sell/15 ring-2 ring-risk/60" : ""} ${extra}`.trim();

  const renderFieldError = (field: keyof FieldErrors) =>
    errors[field] ? <p className="text-xs font-semibold text-risk">{errors[field]}</p> : null;

  const handleQuantityUnitChange = (nextUnit: QuantityUnit) => {
    setQuantityUnit(nextUnit);
    setPositionSize("");
  };

  const handleActionChange = (nextAction: TradeAction) => {
    setAction(nextAction);
    if (nextAction === "observe") {
      setPositionSize("");
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rt-card space-y-5 p-4">
        <div className="space-y-2">
          <label className="rt-label">操作方向</label>
          <TradeActionToggle value={action} onChange={handleActionChange} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2">
            <span className="rt-label">标的名称</span>
            <input
              aria-invalid={Boolean(errors.assetName)}
              className={fieldClassName("assetName")}
              placeholder="例如：腾讯控股 / 0700.HK"
              value={assetName}
              onChange={(event) => {
                setAssetName(event.target.value);
                clearFieldError("assetName");
              }}
            />
            {renderFieldError("assetName")}
          </label>

          <label className="space-y-2">
            <span className="rt-label">交易时间</span>
            <input
              className="rt-input"
              type="datetime-local"
              value={tradeTime}
              onChange={(event) => setTradeTime(event.target.value)}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <label className="space-y-2">
            <span className="rt-label">交易币种</span>
            <select
              className="rt-input appearance-none"
              value={currency}
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {action !== "observe" ? (
          <div className="space-y-2">
            <span className="rt-label">数量单位</span>
            <SegmentedControl
              value={quantityUnit}
              onChange={handleQuantityUnitChange}
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
              placeholder={`${currency} 0.00`}
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
                clearFieldError("price");
              }}
            />
            {renderFieldError("price")}
          </label>
          {action !== "observe" ? (
            <label className="space-y-2">
              <span className="rt-label">{quantityUnit === "shares" ? "股数" : "份额"}</span>
              <input
                aria-invalid={Boolean(errors.positionSize)}
                className={fieldClassName("positionSize", "text-right tabular-nums")}
                inputMode="decimal"
                placeholder={quantityUnit === "shares" ? "0" : `${currency} 0.00`}
                value={positionSize}
                onChange={(event) => {
                  setPositionSize(event.target.value);
                  clearFieldError("positionSize");
                }}
              />
              {renderFieldError("positionSize")}
            </label>
          ) : null}
        </div>

        {action !== "observe" ? (
          <div className="rounded-2xl border border-line bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="rt-label">总金额</span>
              <span className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(totalAmount, currency)}</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              {quantityUnit === "shares"
                ? "选择股数时，总金额按价格乘以股数计算。"
                : "选择份额时，份额金额即为总金额，不再乘以价格。"}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-2">
            <span className="rt-label">预期止盈价 · {currency}</span>
            <input
              className="rt-input text-right tabular-nums"
              inputMode="decimal"
              placeholder={`${currency} 0.00`}
              value={takeProfitPrice}
              onChange={(event) => setTakeProfitPrice(event.target.value)}
            />
          </label>
          <label className="space-y-2">
            <span className="rt-label">预期止损价 · {currency}</span>
            <input
              className="rt-input text-right tabular-nums"
              inputMode="decimal"
              placeholder={`${currency} 0.00`}
              value={stopLossPrice}
              onChange={(event) => setStopLossPrice(event.target.value)}
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="rt-label">一句话决策理由</span>
          <textarea
            aria-invalid={Boolean(errors.decisionReason)}
            className={fieldClassName("decisionReason", "min-h-28 resize-none leading-6")}
            placeholder="记录当时的真实理由：计划、触发条件、情绪影响、犹豫点。"
            value={decisionReason}
            onChange={(event) => {
              setDecisionReason(event.target.value);
              clearFieldError("decisionReason");
            }}
          />
          {renderFieldError("decisionReason")}
        </label>

        <div className={`space-y-2 rounded-2xl ${errors.emotions ? "border border-risk bg-sell/15 p-3 ring-2 ring-risk/40" : ""}`}>
          <span className="rt-label">情绪标签</span>
          <ChipGroup
            options={emotionOptions}
            selected={emotions}
            onToggle={(value) => {
              toggle(value, emotions, setEmotions);
              clearFieldError("emotions");
            }}
          />
          {renderFieldError("emotions")}
        </div>

        <div className="space-y-2">
          <span className="rt-label">策略标签</span>
          <ChipGroup
            options={strategyOptions}
            selected={strategies}
            onToggle={(value) => toggle(value, strategies, setStrategies)}
          />
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

      <button
        type="submit"
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-buy text-sm font-bold text-white shadow-lg shadow-buy/20 transition active:scale-[0.99]"
      >
        <Save className="h-5 w-5" />
        保存当前决策
      </button>
      {savedMessage ? <p className="text-center text-xs font-semibold text-buy">{savedMessage}</p> : null}
    </form>
  );
}

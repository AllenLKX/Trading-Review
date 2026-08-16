"use client";

import { clsx } from "clsx";
import type { TradeAction } from "@/lib/types";

type TradeActionToggleProps = {
  value: TradeAction;
  onChange: (action: TradeAction) => void;
};

const actions: Array<{ value: TradeAction; label: string; className: string }> = [
  { value: "buy", label: "买入", className: "data-[selected=true]:bg-buy data-[selected=true]:text-white" },
  { value: "sell", label: "卖出", className: "data-[selected=true]:bg-sell data-[selected=true]:text-white" },
  {
    value: "observe",
    label: "观察",
    className: "data-[selected=true]:bg-surface-raised data-[selected=true]:text-foreground"
  }
];

export function TradeActionToggle({ value, onChange }: TradeActionToggleProps) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-line bg-background p-1">
      {actions.map((action) => (
        <button
          key={action.value}
          type="button"
          data-selected={value === action.value}
          onClick={() => onChange(action.value)}
          className={clsx(
            "h-11 rounded-xl text-sm font-bold text-muted transition active:scale-95",
            action.className
          )}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

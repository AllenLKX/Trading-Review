"use client";

import { clsx } from "clsx";

type ChipGroupProps = {
  options: string[];
  selected: string[];
  onToggle?: (value: string) => void;
};

export function ChipGroup({ options, selected, onToggle }: ChipGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selected.includes(option);

        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle?.(option)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95",
              isSelected
                ? "border-primary/50 bg-primary/20 text-primary-soft"
                : "border-line bg-surface-soft text-muted-strong"
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { clsx } from "clsx";

type Option<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: SegmentedControlProps<T>) {
  return (
    <div className="flex rounded-2xl border border-line bg-background p-1">
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              "min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold transition active:scale-[0.98]",
              isSelected ? "bg-surface-raised text-foreground shadow-sm" : "text-muted hover:text-muted-strong"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

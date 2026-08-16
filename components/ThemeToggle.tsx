"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { clsx } from "clsx";

type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "rationaltrade.theme.v1";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function selectTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The active page still switches theme when browser storage is unavailable.
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", nextTheme === "light" ? "#f3f6f8" : "#051425");
  }

  return (
    <div>
      <p className="rt-label">显示模式</p>
      <div className="mt-2 flex rounded-xl border border-line bg-background p-1" role="group" aria-label="显示模式">
        <ThemeButton label="日间" icon={Sun} selected={theme === "light"} onClick={() => selectTheme("light")} />
        <ThemeButton label="黑夜" icon={Moon} selected={theme === "dark"} onClick={() => selectTheme("dark")} />
      </div>
    </div>
  );
}

function ThemeButton({
  label,
  icon: Icon,
  selected,
  onClick
}: {
  label: string;
  icon: typeof Sun;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={clsx(
        "flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition active:scale-[0.98]",
        selected ? "bg-surface-raised text-foreground shadow-sm" : "text-muted hover:text-muted-strong"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

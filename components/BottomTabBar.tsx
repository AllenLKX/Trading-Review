"use client";

import { History, PenSquare } from "lucide-react";
import { clsx } from "clsx";

export type AppTab = "record" | "history";

type BottomTabBarProps = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
};

const tabs = [
  { id: "record" as const, label: "记录", icon: PenSquare },
  { id: "history" as const, label: "历史", icon: History }
];

export function BottomTabBar({ activeTab, onTabChange }: BottomTabBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto flex max-w-md gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                "flex h-14 flex-1 flex-col items-center justify-center rounded-2xl text-xs font-semibold transition active:scale-95",
                isActive ? "bg-primary text-white" : "text-muted hover:bg-surface-raised"
              )}
            >
              <Icon className="mb-1 h-5 w-5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

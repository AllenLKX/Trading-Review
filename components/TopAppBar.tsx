"use client";

import { LogOut, UserRound } from "lucide-react";

export function TopAppBar() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/92 px-4 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface-raised text-primary-soft">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-normal text-primary-soft">RationalTrade</h1>
            <p className="text-xs text-muted">交易决策记录与行为复盘</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="退出登录"
          title="退出登录"
          onClick={logout}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-strong transition active:scale-95 active:bg-surface-raised"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

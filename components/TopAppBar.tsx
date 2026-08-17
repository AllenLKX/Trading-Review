"use client";

import { useState } from "react";
import Image from "next/image";
import { LoaderCircle, LogOut, Mail, Settings, X } from "lucide-react";
import { AppGuideDialog } from "@/components/AppGuideDialog";
import { SupportAuthorDialog } from "@/components/SupportAuthorDialog";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TopAppBar({ onReplayOnboarding }: { onReplayOnboarding: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function openSettings() {
    setIsOpen(true);
    setError("");
    if (email || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      const result = (await response.json()) as { user?: { email?: string }; error?: string };
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!response.ok || !result.user?.email) {
        setError("暂时无法读取账号信息，请稍后重试。");
        return;
      }
      setEmail(result.user.email);
    } catch {
      setError("网络连接失败，请稍后重试。");
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    setError("");
    setIsLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setError("退出失败，请稍后重试。");
        return;
      }
      window.location.assign("/login");
    } catch {
      setError("网络连接失败，请稍后重试。");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/92 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur">
      <div className="relative mx-auto flex max-w-md items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/brand-logo-v2.png" alt="交易笔记本" width={44} height={44} priority className="h-11 w-11 shrink-0 object-contain" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-normal text-primary-soft">交易笔记本</h1>
            <p className="truncate text-xs text-muted">交易决策记录与行为复盘</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <AppGuideDialog onReplayOnboarding={onReplayOnboarding} />
          <button
            type="button"
            aria-label="设置"
            title="设置"
            aria-expanded={isOpen}
            aria-controls="account-settings-panel"
            onClick={() => (isOpen ? setIsOpen(false) : void openSettings())}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-strong transition active:scale-95 active:bg-surface-raised"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {isOpen ? (
          <>
            <button
              type="button"
              aria-label="关闭设置"
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 cursor-default bg-black/20"
            />
            <section
              id="account-settings-panel"
              role="dialog"
              aria-label="设置"
              className="absolute right-0 top-14 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-line bg-surface p-4 shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-foreground">设置</h2>
                <button
                  type="button"
                  aria-label="关闭账号设置"
                  title="关闭"
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition active:bg-surface-raised"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 border-y border-line py-4">
                <p className="rt-label">当前邮箱</p>
                <div className="mt-2 flex min-h-10 items-center gap-2 text-sm text-muted-strong">
                  {isLoading ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-primary-soft" /> : <Mail className="h-4 w-4 shrink-0 text-primary-soft" />}
                  <span className="min-w-0 break-all">{isLoading ? "正在读取" : email || "未能读取"}</span>
                </div>
              </div>

              <div className="border-b border-line py-4">
                <ThemeToggle />
              </div>

              <div className="border-b border-line py-3">
                <SupportAuthorDialog />
              </div>

              {error ? <p className="mt-3 rounded-lg border border-sell/60 bg-danger-surface px-3 py-2 text-sm text-danger-foreground">{error}</p> : null}

              <button
                type="button"
                onClick={logout}
                disabled={isLoggingOut}
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-background px-4 text-sm font-bold text-muted-strong transition active:scale-[0.99] disabled:opacity-60"
              >
                {isLoggingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                {isLoggingOut ? "正在退出" : "退出登录"}
              </button>
            </section>
          </>
        ) : null}
      </div>
    </header>
  );
}

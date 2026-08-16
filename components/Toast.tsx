"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastMessage = {
  id: number;
  text: string;
  tone: "success" | "error" | "info";
};

type ToastProps = {
  message: ToastMessage | null;
  onDismiss: () => void;
};

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(onDismiss, 3600);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  const Icon = message.tone === "success" ? CheckCircle2 : message.tone === "error" ? AlertCircle : Info;
  const toneClass =
    message.tone === "success"
      ? "border-buy/50 bg-success-surface text-success-foreground"
      : message.tone === "error"
        ? "border-sell/60 bg-danger-surface text-danger-foreground"
        : "border-primary/50 bg-surface-raised text-foreground";

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm justify-center" aria-live="polite">
      <div className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl ${toneClass}`} role="status">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="min-w-0 flex-1 text-sm font-semibold leading-5">{message.text}</p>
        <button type="button" onClick={onDismiss} aria-label="关闭提示" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

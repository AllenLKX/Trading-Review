"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function NetworkStatusBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const syncStatus = () => setIsOffline(!window.navigator.onLine);
    syncStatus();
    window.addEventListener("online", syncStatus);
    window.addEventListener("offline", syncStatus);
    return () => {
      window.removeEventListener("online", syncStatus);
      window.removeEventListener("offline", syncStatus);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 top-[calc(0.5rem+env(safe-area-inset-top))] z-[70] mx-auto flex max-w-sm justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full items-center gap-2 rounded-xl border border-sell/60 bg-danger-surface px-4 py-3 text-sm font-semibold text-danger-foreground shadow-2xl">
        <WifiOff className="h-4 w-4 shrink-0" />
        当前处于离线状态，填写内容会保留，请联网后再保存。
      </div>
    </div>
  );
}

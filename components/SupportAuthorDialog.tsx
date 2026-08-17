"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Coffee, X } from "lucide-react";

export function SupportAuthorDialog() {
  const [isOpen, setIsOpen] = useState(false);

  function openDialog() {
    setIsOpen(true);
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName: "support_qr_opened" }),
      keepalive: true
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 text-left text-sm font-bold text-muted-strong transition active:bg-surface-raised"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-soft">
          <Coffee className="h-5 w-5" />
        </span>
        请作者喝咖啡
      </button>

      {isOpen ? createPortal(
        <div className="fixed inset-0 z-[120] flex items-end bg-black/65 sm:items-center sm:justify-center sm:p-5">
          <button type="button" aria-label="关闭赞赏二维码" onClick={() => setIsOpen(false)} className="absolute inset-0 cursor-default" />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="请作者喝咖啡"
            className="relative z-10 max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full overflow-y-auto rounded-t-xl border border-line bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-sm sm:rounded-xl sm:pb-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">请作者喝咖啡</h2>
                <p className="mt-1 text-sm leading-6 text-muted">感谢你对交易笔记本的支持。</p>
              </div>
              <button
                type="button"
                aria-label="关闭"
                title="关闭"
                onClick={() => setIsOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted active:bg-surface-raised"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex justify-center overflow-hidden rounded-lg bg-white p-2">
              {/* Keep a direct image URL so mobile browsers can expose their native long-press save menu. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/support/wechat-coffee.jpg"
                alt="微信支付赞赏二维码，长按可保存到本地"
                width="1242"
                height="1692"
                draggable
                style={{ WebkitTouchCallout: "default" }}
                className="max-h-[58dvh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="mt-4 rounded-lg border border-line bg-background px-4 py-3">
              <p className="text-sm font-bold text-foreground">手机操作方式</p>
              <p className="mt-2 text-sm leading-6 text-muted-strong">
                长按二维码保存到本地 → 打开微信 → 扫一扫 → 点击右下角，从本地图片识别。
              </p>
            </div>
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}

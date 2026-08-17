"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, ClipboardCheck, Eye, ListTodo, Sparkles, X, Zap } from "lucide-react";

const guideSteps = [
  { icon: ListTodo, title: "先建计划", detail: "围绕一个标的写下判断、依据和计划假设。" },
  { icon: Zap, title: "记录操作", detail: "把买入、卖出和当时的情绪挂到对应计划。" },
  { icon: Eye, title: "保留观察", detail: "没有交易也可以记录价格、信号和市场变化。" },
  { icon: ClipboardCheck, title: "独立复盘", detail: "即使没有发生操作，也能总结结果与偏差。" },
  { icon: Sparkles, title: "周期分析", detail: "让 AI 基于近期计划、操作和复盘提炼行为模式。" }
] as const;

export function AppGuideDialog() {
  const [isOpen, setIsOpen] = useState(false);

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
        aria-label="使用教程"
        title="使用教程"
        aria-expanded={isOpen}
        aria-controls="app-guide-dialog"
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-strong transition active:scale-95 active:bg-surface-raised"
      >
        <BookOpen className="h-5 w-5" />
      </button>

      {isOpen ? createPortal(
        <div className="fixed inset-0 z-[110] flex items-end bg-black/60 sm:items-center sm:justify-center sm:p-5">
          <button type="button" aria-label="关闭使用教程" onClick={() => setIsOpen(false)} className="absolute inset-0 cursor-default" />
          <section
            id="app-guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="交易笔记本使用教程"
            className="relative z-10 max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] w-full overflow-y-auto rounded-t-xl border border-line bg-surface px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:max-w-md sm:rounded-xl sm:pb-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-soft">使用教程</p>
                <h2 className="mt-1 text-xl font-bold text-foreground">把每次判断留在计划里</h2>
                <p className="mt-2 text-sm leading-6 text-muted">交易笔记本帮助你保留决策依据，再从一段时间的记录中看见反复出现的行为。</p>
              </div>
              <button type="button" aria-label="关闭" title="关闭" onClick={() => setIsOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted active:bg-surface-raised">
                <X className="h-5 w-5" />
              </button>
            </div>

            <ol className="mt-5 divide-y divide-line border-y border-line">
              {guideSteps.map(({ icon: Icon, title, detail }, index) => (
                <li key={title} className="flex gap-3 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary-soft">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{index + 1}. {title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-5 rounded-lg bg-background px-4 py-3 text-sm leading-6 text-muted-strong">
              重点不是补齐每个字段，而是先把当时为什么这样判断写下来。记录越连续，复盘越有价值。
            </p>
          </section>
        </div>,
        document.body
      ) : null}
    </>
  );
}

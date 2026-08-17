"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MousePointerClick } from "lucide-react";

import type { OnboardingStep } from "@/lib/onboarding";

const slides = [
  { src: "/onboarding/01.jpg", alt: "为什么要记录：把情绪和临场反应转化为可回顾的交易依据" },
  { src: "/onboarding/02.jpg", alt: "围绕一条计划记录操作、观察和复盘" },
  { src: "/onboarding/03.jpg", alt: "通过长期记录沉淀更稳定的交易方法" }
] as const;

type OnboardingExperienceProps = {
  step: OnboardingStep | null;
  onAdvance: (step: OnboardingStep) => Promise<void>;
  onPersistCompletion: () => Promise<void>;
  onDismissSpotlight: () => void;
};

export function OnboardingExperience({ step, onAdvance, onPersistCompletion, onDismissSpotlight }: OnboardingExperienceProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const completionStarted = useRef(false);

  useEffect(() => {
    if (step === 4) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [step]);

  useEffect(() => {
    if (step === null || step >= 2) return;
    const nextImage = new window.Image();
    nextImage.src = slides[step + 1].src;
  }, [step]);

  useEffect(() => {
    if (step !== 3 || completionStarted.current) return;
    document.querySelector('[data-onboarding-target="new-plan"]')?.scrollIntoView({ block: "center" });
    completionStarted.current = true;
    void onPersistCompletion().catch(() => {
      completionStarted.current = false;
      setError("教程完成状态暂未同步，稍后登录会继续提示。");
    });
  }, [onPersistCompletion, step]);

  if (step === 4) return null;

  if (step === null) {
    return (
      <div className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-[#020b20] px-6 text-white">
        <div className="flex flex-col items-center gap-4">
          <Image src="/brand-logo.png" alt="交易笔记本" width={64} height={64} priority className="h-16 w-16 object-contain" />
          <LoaderCircle className="h-5 w-5 animate-spin text-[#77d9ff]" />
          <p className="text-sm text-[#b7c8e8]">正在准备你的交易笔记本</p>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return <PlanSpotlight error={error} onDismiss={onDismissSpotlight} />;
  }

  const slide = slides[step];
  const nextStep = (step + 1) as OnboardingStep;

  async function advance() {
    setError("");
    setIsSaving(true);
    try {
      await onAdvance(nextStep);
    } catch {
      setError("暂时无法保存进度，请检查网络后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section
      aria-label={`新手引导，第 ${step + 1} 页，共 3 页`}
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto bg-[#020b20] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] text-white"
    >
      <div className="flex w-full max-w-[440px] flex-col items-center gap-3">
        <div className="relative aspect-[900/1124] w-full overflow-hidden rounded-xl bg-[#020b20]">
          <Image src={slide.src} alt={slide.alt} fill priority sizes="(max-width: 480px) calc(100vw - 24px), 440px" className="object-contain" />
        </div>

        <div className="flex h-5 items-center justify-center gap-2" aria-label={`进度 ${step + 1} / 3`}>
          {slides.map((item, index) => (
            <span key={item.src} className={`h-2 rounded-full transition-all ${index === step ? "w-6 bg-[#7ee7ff]" : "w-2 bg-[#415278]"}`} />
          ))}
        </div>

        {error ? <p className="text-center text-xs font-semibold text-[#ff9aa9]">{error}</p> : null}
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void advance()}
          className="flex h-12 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
        >
          {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
          {step === 2 ? "开始沉淀你的交易系统" : "继续"}
        </button>
      </div>
    </section>
  );
}

function PlanSpotlight({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/75" aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="创建第一条计划"
        className="fixed inset-x-4 top-[min(64dvh,34rem)] z-[100] mx-auto max-w-sm rounded-lg border border-primary/60 bg-surface px-4 py-4 text-foreground shadow-2xl"
      >
        <div className="flex gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-soft">
            <MousePointerClick className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold">从第一条计划开始</h2>
            <p className="mt-1 text-sm leading-6 text-muted">点击上方高亮的“新计划”，先写下标的、判断和计划假设。</p>
          </div>
        </div>
        {error ? <p className="mt-3 text-xs font-semibold text-risk">{error}</p> : null}
        <button type="button" onClick={onDismiss} className="mt-3 h-10 w-full rounded-lg border border-line bg-background text-sm font-bold text-muted-strong">
          稍后创建
        </button>
      </section>
    </>
  );
}

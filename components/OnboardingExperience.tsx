"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, MousePointerClick } from "lucide-react";

import type { OnboardingStep } from "@/lib/onboarding";

const slides = [
  { src: "/onboarding/01.webp", alt: "为什么要记录：保留交易判断、情绪和计划变化" },
  { src: "/onboarding/02.webp", alt: "围绕计划记录操作、观察和复盘" },
  { src: "/onboarding/03.webp", alt: "从长期记录中沉淀自己的交易系统" }
] as const;

type SlideIndex = 0 | 1 | 2;

type OnboardingExperienceProps = {
  step: OnboardingStep | null;
  onAdvance: (step: OnboardingStep) => Promise<void>;
  onPersistCompletion: () => Promise<void>;
  onDismissSpotlight: () => void;
};

export function OnboardingExperience({ step, onAdvance, onPersistCompletion, onDismissSpotlight }: OnboardingExperienceProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [visibleSlide, setVisibleSlide] = useState<SlideIndex>(0);
  const [loadedSlides, setLoadedSlides] = useState<string[]>([]);
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
    if (step !== null && step <= 2) setVisibleSlide(step as SlideIndex);
  }, [step]);

  useEffect(() => {
    const candidates = step === null
      ? [slides[0]]
      : step <= 2
        ? slides.filter((_, index) => Math.abs(index - visibleSlide) <= 1)
        : [];
    let active = true;

    for (const candidate of candidates) {
      const preload = new window.Image();
      preload.decoding = "async";
      preload.src = candidate.src;
      void preload.decode().then(() => {
        if (!active) return;
        setLoadedSlides((current) => current.includes(candidate.src) ? current : [...current, candidate.src]);
      }).catch(() => undefined);
    }

    return () => {
      active = false;
    };
  }, [step, visibleSlide]);

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
          <Image src="/brand-logo-v2.png" alt="交易笔记本" width={64} height={64} priority className="h-16 w-16 object-contain" />
          <LoaderCircle className="h-5 w-5 animate-spin text-[#77d9ff]" />
          <p className="text-sm text-[#b7c8e8]">正在准备你的交易笔记本</p>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return <PlanSpotlight error={error} onDismiss={onDismissSpotlight} />;
  }

  const slide = slides[visibleSlide];
  const isSlideLoaded = loadedSlides.includes(slide.src);

  async function showNextSlide() {
    setError("");
    setIsSaving(true);
    try {
      if (visibleSlide < 2) {
        const nextSlide = (visibleSlide + 1) as SlideIndex;
        await onAdvance(nextSlide);
        setVisibleSlide(nextSlide);
      } else {
        await onAdvance(3);
      }
    } catch {
      setError("暂时无法保存进度，请检查网络后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  function showPreviousSlide() {
    setError("");
    setVisibleSlide((current) => Math.max(0, current - 1) as SlideIndex);
  }

  return (
    <section
      aria-label={`新手引导，第 ${visibleSlide + 1} 页，共 3 页`}
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-hidden bg-[#020b20] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))] text-white"
    >
      <div className="relative aspect-[941/1672] w-full max-w-[430px] overflow-hidden bg-[#020b20]">
        {!isSlideLoaded ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#020b20]">
            <LoaderCircle className="h-6 w-6 animate-spin text-[#77d9ff]" />
            <p className="text-xs text-[#9fb0d1]">正在载入完整图片</p>
          </div>
        ) : null}
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          unoptimized
          priority
          sizes="(max-width: 446px) calc(100vw - 16px), 430px"
          onLoad={() => setLoadedSlides((current) => current.includes(slide.src) ? current : [...current, slide.src])}
          className={`object-contain transition-opacity duration-200 ${isSlideLoaded ? "opacity-100" : "opacity-0"}`}
        />

        <div className="absolute inset-x-3 bottom-2 z-20">
          <div className="mb-2 flex h-4 items-center justify-center gap-2" aria-label={`进度 ${visibleSlide + 1} / 3`}>
            {slides.map((item, index) => (
              <span key={item.src} className={`h-2 rounded-full transition-all ${index === visibleSlide ? "w-6 bg-[#7ee7ff]" : "w-2 bg-[#415278]"}`} />
            ))}
          </div>

          {error ? <p className="mb-2 text-center text-xs font-semibold text-[#ff9aa9]">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={visibleSlide === 0 || isSaving}
              onClick={showPreviousSlide}
              className="flex h-11 w-24 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#50648f] bg-[#09162e]/95 text-xs font-bold text-[#dce7ff] disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
              前一张
            </button>
            <button
              type="button"
              disabled={isSaving || !isSlideLoaded}
              onClick={() => void showNextSlide()}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 text-xs font-bold text-white transition active:scale-[0.99] disabled:opacity-60 min-[360px]:text-sm"
            >
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {visibleSlide === 2 ? "开始沉淀你的交易系统" : "后一张"}
              {!isSaving && visibleSlide < 2 ? <ChevronRight className="h-4 w-4" /> : null}
            </button>
          </div>
        </div>
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

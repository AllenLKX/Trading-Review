"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import type { TradeDecision } from "@/lib/types";
import { ScreenshotUploadPanel } from "./ScreenshotUploadPanel";
import { TradeDecisionForm } from "./TradeDecisionForm";

type RecordMode = "manual" | "screenshot";

type RecordPageProps = {
  onSaveTrade: (trade: TradeDecision) => void;
  onArchiveBatch: (trades: TradeDecision[]) => void;
};

export function RecordPage({ onSaveTrade, onArchiveBatch }: RecordPageProps) {
  const [mode, setMode] = useState<RecordMode>("manual");
  const [showRecognized, setShowRecognized] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Phase 1</p>
        <h2 className="mt-1 text-2xl font-bold text-white">记录决策</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          留下交易发生时的理由、情绪和计划，后续审计只围绕你的行为记录展开。
        </p>
      </div>

      <SegmentedControl
        value={mode}
        onChange={setMode}
        options={[
          { value: "manual", label: "闪念手动输入" },
          { value: "screenshot", label: "AI 截图识图补账" }
        ]}
      />

      {mode === "manual" ? (
        <TradeDecisionForm onSave={onSaveTrade} />
      ) : (
        <ScreenshotUploadPanel
          showRecognized={showRecognized}
          onShowRecognized={() => setShowRecognized(true)}
          onReset={() => setShowRecognized(false)}
          onArchive={onArchiveBatch}
        />
      )}
    </main>
  );
}

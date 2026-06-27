"use client";

import { useState } from "react";
import { Archive, ImagePlus, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { sampleBatchItems } from "@/lib/sample-data";
import type { BatchRecognitionItem, TradeDecision } from "@/lib/types";
import { BatchVerificationCard } from "./BatchVerificationCard";

type ScreenshotUploadPanelProps = {
  showRecognized: boolean;
  onShowRecognized: () => void;
  onReset: () => void;
  onArchive: (trades: TradeDecision[]) => void;
};

export function ScreenshotUploadPanel({
  showRecognized,
  onShowRecognized,
  onReset,
  onArchive
}: ScreenshotUploadPanelProps) {
  const [recognizedItems, setRecognizedItems] = useState<BatchRecognitionItem[]>(sampleBatchItems);
  const [archiveError, setArchiveError] = useState("");

  const resetRecognition = () => {
    setRecognizedItems(sampleBatchItems);
    setArchiveError("");
    onReset();
  };

  const updateRecognizedItem = (nextItem: BatchRecognitionItem) => {
    setArchiveError("");
    setRecognizedItems((currentItems) =>
      currentItems.map((item) => (item.id === nextItem.id ? nextItem : item))
    );
  };

  const removeRecognizedItem = (id: string) => {
    setArchiveError("");
    setRecognizedItems((currentItems) => currentItems.filter((item) => item.id !== id));
  };

  const archiveBatch = () => {
    const invalidItem = recognizedItems.find(
      (item) =>
        !item.assetName.trim() ||
        !item.ticker.trim() ||
        item.price <= 0 ||
        (item.action !== "observe" && (!item.quantity || item.quantity <= 0))
    );

    if (invalidItem) {
      setArchiveError("请先补全每条识别结果的标的、代码、价格和数量，再批量归档。");
      return;
    }

    const now = new Date().toISOString();
    const archiveId = Date.now();

    onArchive(
      recognizedItems.map((item) => ({
        id: `trade-${item.id}-${archiveId}`,
        action: item.action,
        assetName: item.assetName,
        ticker: item.ticker,
        market: item.market,
        tradeTime: item.tradeTime,
        currency: item.currency,
        price: item.price,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        totalAmount: item.totalAmount,
        decisionReason: "来自截图识别结果，用户已确认并归档。",
        psychologyNote: item.psychologyNote,
        emotionTags: item.emotionTags,
        strategyTags: ["截图补账"],
        source: "ai_screenshot",
        reviewStatus: "archived",
        errorTags: [],
        realizedResult: "unknown",
        violatedRules: [],
        createdAt: now,
        updatedAt: now
      }))
    );

    resetRecognition();
  };

  if (!showRecognized) {
    return (
      <button type="button" onClick={onShowRecognized} className="block w-full text-left">
        <EmptyState
          icon={ImagePlus}
          title="点击上传交易截图"
          description="本轮使用示例识别结果，重点验证逐笔确认和批量归档流程。"
        />
      </button>
    );
  }

  return (
    <section className="space-y-4 pb-24">
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-sm font-bold text-primary-soft">识别到 {recognizedItems.length} 笔交易</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          请逐笔确认时间、标的、价格，并补写当时心理活动。未经确认的数据不会进入历史记录。
        </p>
      </div>

      {recognizedItems.length > 0 ? (
        recognizedItems.map((item, index) => (
          <BatchVerificationCard
            key={item.id}
            item={item}
            defaultOpen={index === 0}
            onChange={updateRecognizedItem}
            onRemove={removeRecognizedItem}
          />
        ))
      ) : (
        <EmptyState icon={ImagePlus} title="识别结果已清空" description="你已移除全部识别项，可以重传截图重新开始。" />
      )}

      {archiveError ? (
        <div className="rounded-2xl border border-sell/40 bg-sell/10 p-4 text-sm font-semibold text-risk">
          {archiveError}
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-[4.5rem] z-40 border-t border-line bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-md gap-3">
          <button
            type="button"
            onClick={resetRecognition}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-bold text-muted-strong active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            重传
          </button>
          <button
            type="button"
            onClick={archiveBatch}
            disabled={recognizedItems.length === 0}
            className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Archive className="h-4 w-4" />
            批量归档
          </button>
        </div>
      </div>
    </section>
  );
}

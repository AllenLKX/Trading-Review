"use client";

import { useRef, useState } from "react";
import { Archive, ImagePlus, LoaderCircle, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Toast, type ToastMessage } from "@/components/Toast";
import type { BatchRecognitionItem, ScreenshotArchiveBatch, TradeOperation, TradePlan } from "@/lib/types";
import { BatchVerificationCard } from "./BatchVerificationCard";

type ScreenshotUploadPanelProps = {
  plans: TradePlan[];
  showRecognized: boolean;
  onShowRecognized: () => void;
  onReset: () => void;
  onArchive: (batch: ScreenshotArchiveBatch) => Promise<number>;
};

export function ScreenshotUploadPanel({
  plans,
  showRecognized,
  onShowRecognized,
  onReset,
  onArchive
}: ScreenshotUploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [recognizedItems, setRecognizedItems] = useState<BatchRecognitionItem[]>([]);
  const [recognitionError, setRecognitionError] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const resetRecognition = (askConfirmation = true) => {
    if (
      askConfirmation &&
      recognizedItems.length > 0 &&
      !window.confirm("确认重传截图吗？当前尚未归档的识别结果会被清空。")
    ) {
      return;
    }

    setRecognizedItems([]);
    setRecognitionError("");
    setArchiveError("");
    onReset();
  };

  const recognizeScreenshot = async (image: File) => {
    setRecognitionError("");
    setArchiveError("");
    setIsRecognizing(true);
    const body = new FormData();
    body.set("image", image);

    try {
      const response = await fetch("/api/recognitions", { method: "POST", body });
      const result = (await response.json()) as { items?: BatchRecognitionItem[]; error?: string };
      if (!response.ok || !Array.isArray(result.items) || result.items.length === 0) {
        setRecognitionError(result.error ?? "没有识别出可确认的交易，请换一张更清晰的截图。");
        return;
      }
      setRecognizedItems(result.items);
      onShowRecognized();
    } catch {
      setRecognitionError("截图上传或识别失败，请检查网络后重试。");
    } finally {
      setIsRecognizing(false);
    }
  };

  const updateRecognizedItem = (nextItem: BatchRecognitionItem) => {
    setArchiveError("");
    setRecognizedItems((currentItems) =>
      currentItems.map((item) => (item.id === nextItem.id ? nextItem : item))
    );
  };

  const removeRecognizedItem = (id: string) => {
    if (!window.confirm("确认移除这条识别结果吗？移除后不会归档。")) {
      return;
    }

    setArchiveError("");
    setRecognizedItems((currentItems) => currentItems.filter((item) => item.id !== id));
  };

  const findMatchingPlan = (item: BatchRecognitionItem, nextPlans: TradePlan[]) =>
    nextPlans.find(
      (plan) =>
        plan.ticker.trim().toLowerCase() === item.ticker.trim().toLowerCase() ||
        plan.assetName.trim().toLowerCase() === item.assetName.trim().toLowerCase()
    );

  const createPlanFromItem = (item: BatchRecognitionItem) => {
    const now = new Date().toISOString();

    return {
      id: `plan-${item.id}`,
      title: `${item.assetName} 截图补账计划`,
      assetName: item.assetName.trim(),
      ticker: item.ticker.trim() || item.assetName.trim(),
      market: item.market.trim() || "自选",
      currency: item.currency,
      status: "active" as const,
      thesis: "由截图识别补账自动建立，后续可在计划详情中补充完整计划假设。",
      operations: [],
      reviews: [],
      createdAt: now,
      updatedAt: now
    };
  };

  const archiveBatch = async () => {
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
    const nextPlans = [...plans];
    const createdPlans: TradePlan[] = [];
    const operations: TradeOperation[] = recognizedItems.map((item) => {
      let matchedPlan = findMatchingPlan(item, nextPlans);

      if (!matchedPlan) {
        matchedPlan = createPlanFromItem(item);
        nextPlans.push(matchedPlan);
        createdPlans.push(matchedPlan);
      }

      return {
        id: `operation-${item.id}`,
        planId: matchedPlan.id,
        action: item.action,
        tradeTime: item.tradeTime,
        currency: item.currency,
        price: item.price,
        quantity: item.quantity,
        quantityUnit: item.quantityUnit,
        totalAmount: item.totalAmount,
        decisionReason: "截图识别补账，用户已逐笔确认。",
        psychologyNote: item.psychologyNote,
        emotionTags: item.emotionTags,
        strategyTags: ["截图补账"],
        source: "ai_screenshot",
        createdAt: now,
        updatedAt: now
      };
    });

    setIsArchiving(true);
    try {
      const archivedOperationCount = await onArchive({ newPlans: createdPlans, operations });
      setToast({ id: Date.now(), text: `已归档 ${archivedOperationCount} 笔交易。`, tone: "success" });
      resetRecognition(false);
    } catch (error) {
      setArchiveError(error instanceof Error ? error.message : "批量归档失败，数据不会部分保存，请重试。");
    } finally {
      setIsArchiving(false);
    }
  };

  if (!showRecognized) {
    return (
      <section className="space-y-3">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/png,image/jpeg,image/bmp"
          onChange={(event) => {
            const image = event.target.files?.[0];
            event.target.value = "";
            if (image) void recognizeScreenshot(image);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isRecognizing}
          className="block w-full text-left disabled:cursor-wait disabled:opacity-70"
        >
          <EmptyState
            icon={isRecognizing ? LoaderCircle : ImagePlus}
            title={isRecognizing ? "正在识别交易截图" : "上传交易截图"}
            description={
              isRecognizing
                ? "Kimi 正在读取图片，随后由 DeepSeek 整理交易明细。"
                : "支持 PNG、JPG 和 BMP；识别后逐笔确认，确认前不会写入记录。"
            }
          />
        </button>
        {recognitionError ? (
          <div className="rounded-2xl border border-sell/40 bg-sell/10 p-4 text-sm font-semibold text-risk">
            {recognitionError}
          </div>
        ) : null}
        {isRecognizing ? (
          <p className="px-1 text-xs font-semibold leading-5 text-primary-soft">
            处理顺序：Kimi K3 读取图片 → DeepSeek 整理交易；全部完成后一次展示结果。
          </p>
        ) : null}
        <p className="px-1 text-xs leading-5 text-muted">图片由 Kimi K3 识别，转写文字由 DeepSeek 整理；原图不会保存到交易记录。</p>
        <Toast message={toast} onDismiss={() => setToast(null)} />
      </section>
    );
  }

  return (
    <section className="space-y-4 pb-24">
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
        <p className="text-sm font-bold text-primary-soft">识别到 {recognizedItems.length} 笔交易</p>
        <p className="mt-1 text-xs leading-5 text-muted">
          请逐笔确认时间、标的、价格，并补写当时心理活动。归档时会挂到同标的计划；没有匹配计划时会自动创建截图计划。
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
            onClick={() => resetRecognition()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-bold text-muted-strong active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            重传
          </button>
          <button
            type="button"
            onClick={() => void archiveBatch()}
            disabled={recognizedItems.length === 0 || isArchiving}
            className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/25 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Archive className="h-4 w-4" />
            {isArchiving ? "正在归档…" : "批量归档"}
          </button>
        </div>
      </div>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}

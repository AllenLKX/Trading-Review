"use client";

import { EmptyState } from "@/components/EmptyState";
import { buildRollingAuditReport } from "@/lib/audit-summary";
import { sampleAuditReports } from "@/lib/sample-data";
import { buildTradeDataFile, parseTradeDataFile } from "@/lib/trade-data-file";
import type { TradeAction, TradeDecision } from "@/lib/types";
import { AuditSnapshotCard } from "./AuditSnapshotCard";
import { TradeLogCard } from "@/features/trades/TradeLogCard";
import { Download, FileSearch, Search, Upload } from "lucide-react";
import { type ChangeEvent, useMemo, useRef, useState } from "react";

type HistoryPageProps = {
  trades: TradeDecision[];
  highlightedTradeId: string | null;
  onUpdateTrade: (trade: TradeDecision) => void;
  onDeleteTrade: (tradeId: string) => void;
  onReplaceTrades: (trades: TradeDecision[]) => void;
  onClearTrades: () => void;
  onRestoreSamples: () => void;
};

type HistoryActionFilter = "all" | TradeAction;

export function HistoryPage({
  trades,
  highlightedTradeId,
  onUpdateTrade,
  onDeleteTrade,
  onReplaceTrades,
  onClearTrades,
  onRestoreSamples
}: HistoryPageProps) {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<HistoryActionFilter>("all");
  const [dataMessage, setDataMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, ...archivedAudits] = sampleAuditReports;
  const latestAudit = buildRollingAuditReport(trades);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTrades = useMemo(
    () =>
      trades.filter((trade) => {
        const matchesAction = actionFilter === "all" || trade.action === actionFilter;
        const searchableText = [
          trade.assetName,
          trade.ticker,
          trade.market,
          trade.decisionReason,
          trade.psychologyNote,
          trade.reviewNote,
          ...trade.emotionTags,
          ...trade.strategyTags,
          ...trade.violatedRules
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

        return matchesAction && matchesQuery;
      }),
    [actionFilter, normalizedQuery, trades]
  );

  const confirmClearTrades = () => {
    if (trades.length === 0) {
      onClearTrades();
      return;
    }

    if (window.confirm("确认清空当前浏览器里的本地历史记录吗？")) {
      onClearTrades();
    }
  };

  const exportTrades = () => {
    const dataFile = buildTradeDataFile(trades);
    const blob = new Blob([JSON.stringify(dataFile, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rationaltrade-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    setDataMessage(`已导出 ${trades.length} 笔历史记录。`);
  };

  const importTrades = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const nextTrades = parseTradeDataFile(text);

      if (trades.length > 0 && !window.confirm(`导入会替换当前 ${trades.length} 笔本地历史，确认继续吗？`)) {
        return;
      }

      onReplaceTrades(nextTrades);
      setDataMessage(`已导入 ${nextTrades.length} 笔历史记录。`);
    } catch (error) {
      setDataMessage(error instanceof Error ? error.message : "导入失败，请检查 JSON 文件。");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-28 pt-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">近 30 天</p>
        <h2 className="mt-1 text-2xl font-bold text-white">历史与审计</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          聚合审计用于复盘交易行为和执行偏差，不构成任何投资建议。
        </p>
      </div>

      {latestAudit ? <AuditSnapshotCard latest={latestAudit} archived={archivedAudits} /> : null}

      <section className="space-y-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">历史流水 Feed</h3>
            <span className="text-xs font-semibold text-muted">
              {filteredTrades.length}/{trades.length} 笔
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={confirmClearTrades}
              className="h-10 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong transition active:scale-[0.98]"
            >
              清空本地历史
            </button>
            <button
              type="button"
              onClick={onRestoreSamples}
              className="h-10 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98]"
            >
              恢复示例数据
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={exportTrades}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-xs font-bold text-muted-strong transition active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              导出 JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-xs font-bold text-primary-soft transition active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              导入 JSON
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json,.json" onChange={importTrades} />
          </div>
          {dataMessage ? (
            <p className="rounded-xl border border-line bg-background px-3 py-2 text-xs font-semibold text-muted-strong">
              {dataMessage}
            </p>
          ) : null}

          <div className="space-y-3 rounded-2xl border border-line bg-surface p-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="rt-input pl-9"
                placeholder="搜索标的、代码、理由、标签"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "all", label: "全部" },
                { value: "buy", label: "买入" },
                { value: "sell", label: "卖出" },
                { value: "observe", label: "观察" }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActionFilter(option.value as HistoryActionFilter)}
                  className={`h-10 rounded-xl border text-xs font-bold transition active:scale-[0.98] ${
                    actionFilter === option.value
                      ? "border-primary bg-primary/20 text-primary-soft"
                      : "border-line bg-background text-muted-strong"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredTrades.length > 0 ? (
          filteredTrades.map((trade) => (
            <TradeLogCard
              key={trade.id}
              trade={trade}
              isHighlighted={trade.id === highlightedTradeId}
              onUpdate={onUpdateTrade}
              onDelete={onDeleteTrade}
            />
          ))
        ) : trades.length > 0 ? (
          <EmptyState icon={FileSearch} title="没有匹配记录" description="换一个关键词，或切回全部方向查看历史流水。" />
        ) : (
          <EmptyState icon={FileSearch} title="暂无历史记录" description="保存第一条决策后，这里会开始沉淀你的交易行为轨迹。" />
        )}
      </section>
    </main>
  );
}

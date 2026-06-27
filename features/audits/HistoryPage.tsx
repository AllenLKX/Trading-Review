"use client";

import { EmptyState } from "@/components/EmptyState";
import { buildRollingAuditReport } from "@/lib/audit-summary";
import { sampleAuditReports } from "@/lib/sample-data";
import type { TradeDecision } from "@/lib/types";
import { AuditSnapshotCard } from "./AuditSnapshotCard";
import { TradeLogCard } from "@/features/trades/TradeLogCard";
import { FileSearch } from "lucide-react";

type HistoryPageProps = {
  trades: TradeDecision[];
  highlightedTradeId: string | null;
  onUpdateTrade: (trade: TradeDecision) => void;
  onClearTrades: () => void;
  onRestoreSamples: () => void;
};

export function HistoryPage({
  trades,
  highlightedTradeId,
  onUpdateTrade,
  onClearTrades,
  onRestoreSamples
}: HistoryPageProps) {
  const [, ...archivedAudits] = sampleAuditReports;
  const latestAudit = buildRollingAuditReport(trades);

  const confirmClearTrades = () => {
    if (trades.length === 0) {
      onClearTrades();
      return;
    }

    if (window.confirm("确认清空当前浏览器里的本地历史记录吗？")) {
      onClearTrades();
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
            <span className="text-xs font-semibold text-muted">{trades.length} 笔已确认</span>
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
        </div>

        {trades.length > 0 ? (
          trades.map((trade) => (
            <TradeLogCard
              key={trade.id}
              trade={trade}
              isHighlighted={trade.id === highlightedTradeId}
              onUpdate={onUpdateTrade}
            />
          ))
        ) : (
          <EmptyState icon={FileSearch} title="暂无历史记录" description="保存第一条决策后，这里会开始沉淀你的交易行为轨迹。" />
        )}
      </section>
    </main>
  );
}

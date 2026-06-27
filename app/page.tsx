"use client";

import { useState } from "react";
import { BottomTabBar, type AppTab } from "@/components/BottomTabBar";
import { TopAppBar } from "@/components/TopAppBar";
import { HistoryPage } from "@/features/audits/HistoryPage";
import { RecordPage } from "@/features/trades/RecordPage";
import { useTradeDecisions } from "@/lib/use-trade-decisions";
import type { TradeDecision } from "@/lib/types";

export default function Home() {
  const [activeTab, setActiveTab] = useState<AppTab>("record");
  const { trades, highlightedTradeId, saveTrade, archiveBatch, updateTrade, clearTrades, restoreSampleTrades } =
    useTradeDecisions();

  const handleSaveTrade = (trade: TradeDecision) => {
    saveTrade(trade);
    setActiveTab("history");
  };

  const handleArchiveBatch = (nextTrades: TradeDecision[]) => {
    archiveBatch(nextTrades);
    setActiveTab("history");
  };

  return (
    <div className="min-h-dvh bg-background text-muted-strong">
      <TopAppBar />
      {activeTab === "record" ? (
        <RecordPage onSaveTrade={handleSaveTrade} onArchiveBatch={handleArchiveBatch} />
      ) : (
        <HistoryPage
          trades={trades}
          highlightedTradeId={highlightedTradeId}
          onUpdateTrade={updateTrade}
          onClearTrades={clearTrades}
          onRestoreSamples={restoreSampleTrades}
        />
      )}
      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

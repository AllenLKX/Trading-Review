"use client";

import { useEffect, useMemo, useState } from "react";
import { sampleTrades } from "@/lib/sample-data";
import { localTradeRepository } from "@/lib/trade-repository";
import type { TradeDecision } from "@/lib/types";

type TradeDecisionStore = {
  trades: TradeDecision[];
  highlightedTradeId: string | null;
  saveTrade: (trade: TradeDecision) => void;
  archiveBatch: (nextTrades: TradeDecision[]) => void;
  updateTrade: (trade: TradeDecision) => void;
  deleteTrade: (tradeId: string) => void;
  clearTrades: () => void;
  restoreSampleTrades: () => void;
};

export function useTradeDecisions(): TradeDecisionStore {
  const [trades, setTrades] = useState<TradeDecision[]>(sampleTrades);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      setTrades(localTradeRepository.load());
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    localTradeRepository.persist(trades);
  }, [isHydrated, trades]);

  return useMemo(
    () => ({
      trades,
      highlightedTradeId,
      saveTrade: (trade: TradeDecision) => {
        setTrades((current) => [trade, ...current]);
        setHighlightedTradeId(trade.id);
      },
      archiveBatch: (nextTrades: TradeDecision[]) => {
        setTrades((current) => [...nextTrades, ...current]);
        setHighlightedTradeId(nextTrades[0]?.id ?? null);
      },
      updateTrade: (trade: TradeDecision) => {
        setTrades((current) => current.map((item) => (item.id === trade.id ? trade : item)));
        setHighlightedTradeId(trade.id);
      },
      deleteTrade: (tradeId: string) => {
        setTrades((current) => current.filter((item) => item.id !== tradeId));
        setHighlightedTradeId((current) => (current === tradeId ? null : current));
      },
      clearTrades: () => {
        setTrades([]);
        setHighlightedTradeId(null);
      },
      restoreSampleTrades: () => {
        setTrades(sampleTrades);
        setHighlightedTradeId(sampleTrades[0]?.id ?? null);
      }
    }),
    [highlightedTradeId, trades]
  );
}

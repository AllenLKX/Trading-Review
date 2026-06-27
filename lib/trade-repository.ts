import { sampleTrades } from "@/lib/sample-data";
import type { TradeDecision } from "@/lib/types";

const TRADE_STORAGE_KEY = "rationaltrade.tradeDecisions.v1";

export type TradeRepository = {
  load: () => TradeDecision[];
  persist: (trades: TradeDecision[]) => void;
};

export const localTradeRepository: TradeRepository = {
  load: () => {
    try {
      const storedTrades = window.localStorage.getItem(TRADE_STORAGE_KEY);

      if (!storedTrades) {
        return sampleTrades;
      }

      const parsedTrades = JSON.parse(storedTrades) as unknown;

      if (!Array.isArray(parsedTrades)) {
        return sampleTrades;
      }

      return parsedTrades as TradeDecision[];
    } catch {
      return sampleTrades;
    }
  },
  persist: (trades) => {
    window.localStorage.setItem(TRADE_STORAGE_KEY, JSON.stringify(trades));
  }
};

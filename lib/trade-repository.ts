import { samplePlans, sampleTrades } from "@/lib/sample-data";
import { migrateTradesToPlans } from "@/lib/plan-migration";
import type { TradeDecision, TradePlan } from "@/lib/types";

const TRADE_STORAGE_KEY = "rationaltrade.tradeDecisions.v1";
const PLAN_STORAGE_KEY = "rationaltrade.tradePlans.v2";

export type TradeRepository = {
  load: () => TradePlan[];
  persist: (plans: TradePlan[]) => void;
};

export const localTradeRepository: TradeRepository = {
  load: () => {
    try {
      const storedPlans = window.localStorage.getItem(PLAN_STORAGE_KEY);

      if (storedPlans) {
        const parsedPlans = JSON.parse(storedPlans) as unknown;
        if (Array.isArray(parsedPlans)) {
          return parsedPlans as TradePlan[];
        }
      }

      const storedTrades = window.localStorage.getItem(TRADE_STORAGE_KEY);

      if (!storedTrades) {
        return samplePlans;
      }

      const parsedTrades = JSON.parse(storedTrades) as unknown;

      if (!Array.isArray(parsedTrades)) {
        return samplePlans;
      }

      return migrateTradesToPlans(parsedTrades as TradeDecision[]);
    } catch {
      return samplePlans;
    }
  },
  persist: (plans) => {
    window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
  }
};

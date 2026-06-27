import type { AuditReport, BatchRecognitionItem, TradeDecision } from "@/lib/types";

export const emotionOptions = ["冷静", "焦虑", "兴奋", "犹豫", "纠结", "不甘心", "观望"];

export const strategyOptions = ["突破", "回调", "右侧交易", "财报", "消息刺激", "仓位调整"];

export const currencyOptions = [
  { code: "HKD", label: "HKD 港币", symbol: "HK$" },
  { code: "USD", label: "USD 美元", symbol: "$" },
  { code: "CNY", label: "CNY 人民币", symbol: "¥" },
  { code: "EUR", label: "EUR 欧元", symbol: "€" },
  { code: "JPY", label: "JPY 日元", symbol: "¥" },
  { code: "GBP", label: "GBP 英镑", symbol: "£" }
] as const;

export const sampleTrades: TradeDecision[] = [
  {
    id: "trade-001",
    action: "buy",
    assetName: "Tencent Holdings",
    ticker: "0700.HK",
    market: "HKG",
    tradeTime: "2026-06-07T10:30:00+08:00",
    currency: "HKD",
    price: 382.4,
    quantity: 1000,
    quantityUnit: "shares",
    totalAmount: 382400,
    takeProfitPrice: 420,
    stopLossPrice: 365,
    decisionReason: "突破底部震荡区间，量能放大，想验证右侧交易计划。",
    psychologyNote: "开盘后有追进去的冲动，但仍按预设价格等待确认。",
    emotionTags: ["冷静", "兴奋"],
    strategyTags: ["突破", "右侧交易"],
    source: "sample",
    reviewStatus: "archived",
    errorTags: [],
    realizedResult: "unknown",
    violatedRules: [],
    createdAt: "2026-06-07T10:32:00+08:00",
    updatedAt: "2026-06-07T10:32:00+08:00"
  },
  {
    id: "trade-002",
    action: "sell",
    assetName: "Meituan",
    ticker: "3690.HK",
    market: "HKG",
    tradeTime: "2026-06-06T14:15:00+08:00",
    currency: "HKD",
    price: 115.8,
    quantity: 500,
    quantityUnit: "shares",
    totalAmount: 57900,
    takeProfitPrice: 132,
    stopLossPrice: 118,
    decisionReason: "盘中触及预设止损区间，担心继续扩大亏损。",
    psychologyNote: "卖出时明显焦虑，没有等到收盘确认，后续需要复盘执行偏差。",
    emotionTags: ["焦虑", "犹豫"],
    strategyTags: ["仓位调整"],
    source: "sample",
    reviewStatus: "archived",
    errorTags: ["止损执行偏差"],
    realizedResult: "unknown",
    violatedRules: [],
    createdAt: "2026-06-06T14:18:00+08:00",
    updatedAt: "2026-06-06T14:18:00+08:00"
  },
  {
    id: "trade-003",
    action: "observe",
    assetName: "BYD Company",
    ticker: "1211.HK",
    market: "HKG",
    tradeTime: "2026-06-04T09:45:00+08:00",
    currency: "HKD",
    price: 218.2,
    quantity: 200,
    quantityUnit: "shares",
    totalAmount: 43640,
    decisionReason: "价格接近观察区间，但成交量不足，先记录理由不立即操作。",
    psychologyNote: "看到快速拉升时有错过感，但计划内条件还没有满足。",
    emotionTags: ["观望", "不甘心"],
    strategyTags: ["回调"],
    source: "sample",
    reviewStatus: "archived",
    errorTags: [],
    realizedResult: "unknown",
    violatedRules: [],
    createdAt: "2026-06-04T09:47:00+08:00",
    updatedAt: "2026-06-04T09:47:00+08:00"
  }
];

export const sampleBatchItems: BatchRecognitionItem[] = [
  {
    id: "batch-001",
    action: "buy",
    assetName: "Tencent Holdings",
    ticker: "0700.HK",
    market: "HKG",
    tradeTime: "2026-06-07T10:15:00+08:00",
    currency: "HKD",
    price: 381.6,
    quantity: 600,
    quantityUnit: "shares",
    totalAmount: 228960,
    sourceImageName: "settlement_0607.png",
    confidence: 0.92,
    psychologyNote: "回踩均线后买入，想确认自己是不是被盘中拉升影响。",
    emotionTags: ["兴奋"]
  },
  {
    id: "batch-002",
    action: "sell",
    assetName: "Meituan",
    ticker: "3690.HK",
    market: "HKG",
    tradeTime: "2026-06-06T14:12:00+08:00",
    currency: "HKD",
    price: 116.2,
    quantity: 300,
    quantityUnit: "shares",
    totalAmount: 34860,
    sourceImageName: "settlement_0607.png",
    confidence: 0.88,
    psychologyNote: "担心跌破计划区间后继续扩大亏损，卖出前有明显犹豫。",
    emotionTags: ["焦虑", "犹豫"]
  }
];

export const sampleAuditReports: AuditReport[] = [
  {
    id: "audit-001",
    periodStart: "2026-05-08",
    periodEnd: "2026-06-07",
    title: "近 30 天系统智能审计",
    summary:
      "近期记录显示，止损执行环节的犹豫感较明显。多笔记录在计划条件接近触发时出现重新解释理由的倾向，建议在复盘中重点检查原计划与实际动作是否一致。",
    signalLabel: "执行偏差预警",
    signalLevel: "risk",
    metrics: {
      emotionHeat: 65,
      delayedExitRate: 14.2,
      recordCount: 12
    },
    findings: ["焦虑标签集中出现在卖出前后", "消息刺激类记录的理由较短", "观察记录能减少临时操作"],
    createdAt: "2026-06-07T18:00:00+08:00"
  },
  {
    id: "audit-002",
    periodStart: "2026-04-08",
    periodEnd: "2026-05-07",
    title: "历史审计快照",
    summary: "该周期记录密度稳定，冲动交易标签减少，但仍存在止盈目标填写不完整的问题。",
    signalLabel: "常规波动",
    signalLevel: "watch",
    metrics: {
      emotionHeat: 42,
      delayedExitRate: 6.8,
      recordCount: 9
    },
    findings: ["记录频率稳定", "止盈止损字段需要更完整"],
    createdAt: "2026-05-07T18:00:00+08:00"
  }
];

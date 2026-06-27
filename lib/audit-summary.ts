import type { AuditReport, TradeDecision } from "@/lib/types";

const EMOTION_PRESSURE: Record<string, number> = {
  焦虑: 1,
  不甘心: 0.9,
  犹豫: 0.65,
  纠结: 0.65,
  兴奋: 0.45
};

const EMOTION_COOLING: Record<string, number> = {
  冷静: 0.45,
  观望: 0.35
};

export function buildRollingAuditReport(trades: TradeDecision[]): AuditReport {
  const now = new Date();
  const periodEnd = formatDate(now);
  const periodStartDate = new Date(now);
  periodStartDate.setDate(periodStartDate.getDate() - 30);
  const periodStart = formatDate(periodStartDate);

  const recentTrades = trades.filter((trade) => {
    const tradeTime = new Date(trade.tradeTime);
    return tradeTime >= periodStartDate && tradeTime <= now;
  });

  const emotionPressure = recentTrades.reduce((total, trade) => {
    const pressure = trade.emotionTags.reduce((sum, tag) => sum + (EMOTION_PRESSURE[tag] ?? 0), 0);
    const cooling = trade.emotionTags.reduce((sum, tag) => sum + (EMOTION_COOLING[tag] ?? 0), 0);
    return total + Math.max(0, pressure - cooling);
  }, 0);
  const emotionDenominator = Math.max(recentTrades.length, 6);
  const emotionHeat = recentTrades.length > 0 ? Math.round((emotionPressure / emotionDenominator) * 100) : 0;
  const delayedExitCount = recentTrades.filter(
    (trade) =>
      trade.errorTags.includes("止损执行偏差") ||
      trade.emotionTags.includes("犹豫") ||
      trade.emotionTags.includes("纠结") ||
      trade.decisionReason.includes("犹豫") ||
      trade.decisionReason.includes("纠结")
  ).length;
  const delayedExitRate =
    recentTrades.length > 0 ? Number(((delayedExitCount / recentTrades.length) * 100).toFixed(1)) : 0;

  const signalLevel = emotionHeat >= 60 || delayedExitRate >= 40 ? "risk" : emotionHeat >= 30 ? "watch" : "stable";
  const signalLabel =
    signalLevel === "risk" ? "执行偏差预警" : signalLevel === "watch" ? "情绪波动观察" : "记录状态稳定";

  return {
    id: "audit-dynamic-rolling-30",
    periodStart,
    periodEnd,
    title: "近 30 天系统智能审计",
    summary: buildSummary(recentTrades.length, emotionHeat, delayedExitRate),
    signalLabel,
    signalLevel,
    metrics: {
      emotionHeat,
      delayedExitRate,
      recordCount: recentTrades.length
    },
    findings: buildFindings(recentTrades, emotionPressure, delayedExitRate),
    createdAt: now.toISOString()
  };
}

function buildSummary(recordCount: number, emotionHeat: number, delayedExitRate: number) {
  if (recordCount === 0) {
    return "近 30 天还没有可审计记录。先沉淀几笔决策，系统才能开始观察行为和情绪模式。";
  }

  if (emotionHeat >= 60) {
    return `近 30 天共有 ${recordCount} 笔记录，情绪热度偏高。建议复盘这些记录中，哪些操作来自原计划，哪些来自临场压力或错过感。`;
  }

  if (delayedExitRate >= 40) {
    return `近 30 天共有 ${recordCount} 笔记录，犹豫或止损执行偏差出现较集中。建议重点回看原计划与实际动作之间的差异。`;
  }

  return `近 30 天共有 ${recordCount} 笔记录，目前情绪标签分布相对平稳。可以继续保持记录密度，等待更完整的周期样本。`;
}

function buildFindings(trades: TradeDecision[], emotionPressure: number, delayedExitRate: number) {
  if (trades.length === 0) {
    return ["暂无近 30 天记录", "保存手动记录或归档截图识别结果后，这里会自动更新", "审计仅用于行为复盘"];
  }

  const sourceCounts = trades.reduce(
    (counts, trade) => {
      counts[trade.source] = (counts[trade.source] ?? 0) + 1;
      return counts;
    },
    {} as Record<TradeDecision["source"], number>
  );

  return [
    `近 30 天已确认 ${trades.length} 笔记录`,
    `净情绪压力分 ${Number(emotionPressure.toFixed(1))}`,
    `犹豫或止损执行偏差占比 ${delayedExitRate}%`,
    `记录来源：手动 ${sourceCounts.manual ?? 0} 笔，截图 ${sourceCounts.ai_screenshot ?? 0} 笔`
  ];
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

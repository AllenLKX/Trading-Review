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
  const reviewedTrades = recentTrades.filter(
    (trade) =>
      trade.realizedResult !== undefined ||
      typeof trade.profitLoss === "number" ||
      trade.violatedRules.length > 0 ||
      Boolean(trade.reviewNote)
  );
  const violationCount = recentTrades.filter((trade) => trade.violatedRules.length > 0).length;
  const lossCount = recentTrades.filter((trade) => trade.realizedResult === "loss" || (trade.profitLoss ?? 0) < 0).length;
  const reviewCoverageRate =
    recentTrades.length > 0 ? Number(((reviewedTrades.length / recentTrades.length) * 100).toFixed(1)) : 0;
  const violationRate = recentTrades.length > 0 ? Number(((violationCount / recentTrades.length) * 100).toFixed(1)) : 0;

  const signalLevel =
    emotionHeat >= 60 || delayedExitRate >= 40 || violationRate >= 35 || lossCount >= 3
      ? "risk"
      : emotionHeat >= 30 || violationRate >= 15 || reviewCoverageRate < 50
        ? "watch"
        : "stable";
  const signalLabel =
    signalLevel === "risk" ? "执行偏差预警" : signalLevel === "watch" ? "复盘完整度观察" : "记录状态稳定";

  return {
    id: "audit-dynamic-rolling-30",
    periodStart,
    periodEnd,
    title: "近 30 天系统智能审计",
    summary: buildSummary(recentTrades.length, emotionHeat, delayedExitRate, reviewCoverageRate, violationRate, lossCount),
    signalLabel,
    signalLevel,
    metrics: {
      emotionHeat,
      delayedExitRate,
      recordCount: recentTrades.length,
      reviewCoverageRate,
      violationRate
    },
    findings: buildFindings(recentTrades, emotionPressure, delayedExitRate, reviewCoverageRate, violationRate, lossCount),
    createdAt: now.toISOString()
  };
}

function buildSummary(
  recordCount: number,
  emotionHeat: number,
  delayedExitRate: number,
  reviewCoverageRate: number,
  violationRate: number,
  lossCount: number
) {
  if (recordCount === 0) {
    return "近 30 天还没有可审计记录。先沉淀几笔决策，系统才能开始观察行为和情绪模式。";
  }

  if (violationRate >= 35) {
    return `近 30 天共有 ${recordCount} 笔记录，违反计划占比达到 ${violationRate}%。建议优先回看这些记录，区分计划问题和执行问题。`;
  }

  if (lossCount >= 3) {
    return `近 30 天共有 ${recordCount} 笔记录，其中 ${lossCount} 笔复盘结果偏亏损。建议对照当时理由，检查是否存在重复触发的行为模式。`;
  }

  if (emotionHeat >= 60) {
    return `近 30 天共有 ${recordCount} 笔记录，情绪热度偏高。建议复盘这些记录中，哪些操作来自原计划，哪些来自临场压力或错过感。`;
  }

  if (delayedExitRate >= 40) {
    return `近 30 天共有 ${recordCount} 笔记录，犹豫或止损执行偏差出现较集中。建议重点回看原计划与实际动作之间的差异。`;
  }

  if (reviewCoverageRate < 50) {
    return `近 30 天共有 ${recordCount} 笔记录，事后复盘覆盖率为 ${reviewCoverageRate}%。建议先补齐实际结果和执行偏差，再判断行为趋势。`;
  }

  return `近 30 天共有 ${recordCount} 笔记录，目前情绪标签分布相对平稳。可以继续保持记录密度，等待更完整的周期样本。`;
}

function buildFindings(
  trades: TradeDecision[],
  emotionPressure: number,
  delayedExitRate: number,
  reviewCoverageRate: number,
  violationRate: number,
  lossCount: number
) {
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
  const violatedRuleCounts = trades.flatMap((trade) => trade.violatedRules).reduce(
    (counts, rule) => {
      counts[rule] = (counts[rule] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );
  const topViolatedRule = Object.entries(violatedRuleCounts).sort((left, right) => right[1] - left[1])[0];

  const findings = [
    `近 30 天已确认 ${trades.length} 笔记录`,
    `净情绪压力分 ${Number(emotionPressure.toFixed(1))}`,
    `犹豫或止损执行偏差占比 ${delayedExitRate}%`,
    `事后复盘覆盖率 ${reviewCoverageRate}%`,
    `违反计划占比 ${violationRate}%`,
    `记录来源：手动 ${sourceCounts.manual ?? 0} 笔，截图 ${sourceCounts.ai_screenshot ?? 0} 笔`
  ];

  if (lossCount > 0) {
    findings.splice(3, 0, `已复盘亏损记录 ${lossCount} 笔`);
  }

  if (topViolatedRule) {
    findings.splice(4, 0, `最常见违反计划标签：${topViolatedRule[0]} ${topViolatedRule[1]} 次`);
  }

  return findings;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

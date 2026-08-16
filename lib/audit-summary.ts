import type { AuditReport, PlanReview, TradeOperation, TradePlan } from "@/lib/types";

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

export function buildRollingAuditReport(plans: TradePlan[]): AuditReport {
  const now = new Date();
  const periodEnd = formatDate(now);
  const periodStartDate = new Date(now);
  periodStartDate.setDate(periodStartDate.getDate() - 30);
  const periodStart = formatDate(periodStartDate);

  const operations = plans.flatMap((plan) => plan.operations);
  const reviews = plans.flatMap((plan) => plan.reviews);
  const recentOperations = operations.filter((operation) => {
    const operationTime = new Date(operation.tradeTime);
    return operationTime >= periodStartDate && operationTime <= now;
  });
  const recentReviews = reviews.filter((review) => {
    const reviewTime = new Date(review.reviewTime);
    return reviewTime >= periodStartDate && reviewTime <= now;
  });
  const emotionEvents = [...recentOperations, ...recentReviews];

  const emotionPressure = emotionEvents.reduce((total, event) => {
    const pressure = event.emotionTags.reduce((sum, tag) => sum + (EMOTION_PRESSURE[tag] ?? 0), 0);
    const cooling = event.emotionTags.reduce((sum, tag) => sum + (EMOTION_COOLING[tag] ?? 0), 0);
    return total + Math.max(0, pressure - cooling);
  }, 0);
  const emotionDenominator = Math.max(emotionEvents.length, 6);
  const emotionHeat = emotionEvents.length > 0 ? Math.round((emotionPressure / emotionDenominator) * 100) : 0;
  const delayedExitCount = recentOperations.filter(
    (operation) =>
      operation.emotionTags.includes("犹豫") ||
      operation.emotionTags.includes("纠结") ||
      operation.decisionReason.includes("犹豫") ||
      operation.decisionReason.includes("纠结")
  ).length;
  const delayedExitRate =
    recentOperations.length > 0 ? Number(((delayedExitCount / recentOperations.length) * 100).toFixed(1)) : 0;
  const violationCount = recentReviews.filter((review) => review.violatedRules.length > 0).length;
  const missedExpectationCount = recentReviews.filter(
    (review) => review.realizedResult === "loss" || review.realizedResult === "missed" || (review.profitLoss ?? 0) < 0
  ).length;
  const reviewCoverageRate =
    recentOperations.length > 0 ? Number(((recentReviews.length / recentOperations.length) * 100).toFixed(1)) : 0;
  const violationRate = recentReviews.length > 0 ? Number(((violationCount / recentReviews.length) * 100).toFixed(1)) : 0;
  const sourceCounts = countBy(recentOperations, (operation) => operation.source);
  const topEmotions = topEntries(countTags(emotionEvents.flatMap((event) => event.emotionTags)), 3);
  const topStrategies = topEntries(countTags(recentOperations.flatMap((operation) => operation.strategyTags)), 3);
  const topViolations = topEntries(countTags(recentReviews.flatMap((review) => review.violatedRules)), 3);

  const signalLevel =
    emotionHeat >= 60 || delayedExitRate >= 40 || violationRate >= 35 || missedExpectationCount >= 3
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
    summary: buildSummary(
      recentOperations.length,
      recentReviews.length,
      emotionHeat,
      delayedExitRate,
      reviewCoverageRate,
      violationRate,
      missedExpectationCount
    ),
    signalLabel,
    signalLevel,
    metrics: {
      emotionHeat,
      delayedExitRate,
      recordCount: recentOperations.length + recentReviews.length,
      reviewCoverageRate,
      violationRate
    },
    aiInputDigest: buildAiInputDigest({
      plans,
      operations: recentOperations,
      reviews: recentReviews,
      sourceCounts,
      topEmotions,
      topStrategies,
      topViolations,
      periodStart,
      periodEnd
    }),
    findings: buildFindings(
      plans,
      recentOperations,
      recentReviews,
      emotionPressure,
      delayedExitRate,
      reviewCoverageRate,
      violationRate,
      missedExpectationCount,
      sourceCounts,
      topViolations
    ),
    reviewQuestions: buildReviewQuestions({
      recentOperations,
      recentReviews,
      emotionHeat,
      delayedExitRate,
      reviewCoverageRate,
      violationRate,
      topEmotions,
      topStrategies,
      topViolations
    }),
    generation: {
      source: "local-rules",
      provider: "local",
      promptVersion: "local-rules-v1",
      status: "local"
    },
    createdAt: now.toISOString()
  };
}

function buildSummary(
  operationCount: number,
  reviewCount: number,
  emotionHeat: number,
  delayedExitRate: number,
  reviewCoverageRate: number,
  violationRate: number,
  missedExpectationCount: number
) {
  if (operationCount === 0 && reviewCount === 0) {
    return "近 30 天还没有可审计记录。先沉淀几笔操作或复盘，系统才能开始观察行为和情绪模式。";
  }

  if (violationRate >= 35) {
    return `近 30 天共有 ${operationCount} 次操作和 ${reviewCount} 次复盘，违反计划占比达到 ${violationRate}%。建议优先回看这些记录，区分计划问题和执行问题。`;
  }

  if (missedExpectationCount >= 3) {
    return `近 30 天共有 ${reviewCount} 次复盘，其中 ${missedExpectationCount} 次结果未达预期。建议对照当时理由，检查是否存在重复触发的行为模式。`;
  }

  if (emotionHeat >= 60) {
    return `近 30 天共有 ${operationCount} 次操作和 ${reviewCount} 次复盘，情绪热度偏高。建议复盘哪些动作来自原计划，哪些来自临场压力或错过感。`;
  }

  if (delayedExitRate >= 40) {
    return `近 30 天共有 ${operationCount} 次操作，犹豫或止损执行偏差出现较集中。建议重点回看原计划与实际动作之间的差异。`;
  }

  if (operationCount > 0 && reviewCoverageRate < 50) {
    return `近 30 天共有 ${operationCount} 次操作，独立复盘覆盖率为 ${reviewCoverageRate}%。建议先补齐实际结果和执行偏差，再判断行为趋势。`;
  }

  return `近 30 天共有 ${operationCount} 次操作和 ${reviewCount} 次复盘，目前情绪标签分布相对平稳。可以继续保持记录密度，等待更完整的周期样本。`;
}

function buildFindings(
  plans: TradePlan[],
  operations: TradeOperation[],
  reviews: PlanReview[],
  emotionPressure: number,
  delayedExitRate: number,
  reviewCoverageRate: number,
  violationRate: number,
  missedExpectationCount: number,
  sourceCounts: Record<string, number>,
  topViolations: Array<[string, number]>
) {
  if (operations.length === 0 && reviews.length === 0) {
    return ["暂无近 30 天记录", "保存操作或独立复盘后，这里会自动更新", "审计仅用于行为复盘"];
  }

  const topViolatedRule = topViolations[0];
  const activePlanCount = plans.filter((plan) => plan.status === "active").length;

  const findings = [
    `当前共有 ${plans.length} 个计划，其中 ${activePlanCount} 个进行中`,
    `近 30 天新增 ${operations.length} 次操作、${reviews.length} 次复盘`,
    `净情绪压力分 ${Number(emotionPressure.toFixed(1))}`,
    `犹豫或止损执行偏差占比 ${delayedExitRate}%`,
    `独立复盘覆盖率 ${reviewCoverageRate}%`,
    `违反计划占比 ${violationRate}%`,
    `记录来源：手动 ${sourceCounts.manual ?? 0} 次，截图 ${sourceCounts.ai_screenshot ?? 0} 次`
  ];

  if (missedExpectationCount > 0) {
    findings.splice(4, 0, `已复盘未达预期结果 ${missedExpectationCount} 次`);
  }

  if (topViolatedRule) {
    findings.splice(5, 0, `最常见违反计划标签：${topViolatedRule[0]} ${topViolatedRule[1]} 次`);
  }

  return findings;
}

function buildAiInputDigest({
  plans,
  operations,
  reviews,
  sourceCounts,
  topEmotions,
  topStrategies,
  topViolations,
  periodStart,
  periodEnd
}: {
  plans: TradePlan[];
  operations: TradeOperation[];
  reviews: PlanReview[];
  sourceCounts: Record<string, number>;
  topEmotions: Array<[string, number]>;
  topStrategies: Array<[string, number]>;
  topViolations: Array<[string, number]>;
  periodStart: string;
  periodEnd: string;
}) {
  const recentEventLines = buildRecentEventLines(plans, operations, reviews);

  return [
    `审计周期：${periodStart} 至 ${periodEnd}`,
    `计划概况：共 ${plans.length} 个计划，进行中 ${plans.filter((plan) => plan.status === "active").length} 个`,
    `记录概况：${operations.length} 次操作，${reviews.length} 次复盘`,
    `来源概况：手动 ${sourceCounts.manual ?? 0} 次，截图 ${sourceCounts.ai_screenshot ?? 0} 次`,
    `高频情绪：${formatTopEntries(topEmotions)}`,
    `高频策略：${formatTopEntries(topStrategies)}`,
    `违反计划：${formatTopEntries(topViolations)}`,
    ...recentEventLines
  ];
}

function buildRecentEventLines(plans: TradePlan[], operations: TradeOperation[], reviews: PlanReview[]) {
  const planNameById = new Map(plans.map((plan) => [plan.id, plan.title]));
  const operationLines = operations.map((operation) => ({
    time: operation.tradeTime,
    line: `近期操作：${planNameById.get(operation.planId) ?? "未知计划"} / ${operation.action} / ${operation.decisionReason}`
  }));
  const reviewLines = reviews.map((review) => ({
    time: review.reviewTime,
    line: `近期复盘：${planNameById.get(review.planId) ?? "未知计划"} / ${review.realizedResult} / ${review.reviewNote}`
  }));

  return [...operationLines, ...reviewLines]
    .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime())
    .slice(0, 6)
    .map((event) => event.line);
}

function buildReviewQuestions({
  recentOperations,
  recentReviews,
  emotionHeat,
  delayedExitRate,
  reviewCoverageRate,
  violationRate,
  topEmotions,
  topStrategies,
  topViolations
}: {
  recentOperations: TradeOperation[];
  recentReviews: PlanReview[];
  emotionHeat: number;
  delayedExitRate: number;
  reviewCoverageRate: number;
  violationRate: number;
  topEmotions: Array<[string, number]>;
  topStrategies: Array<[string, number]>;
  topViolations: Array<[string, number]>;
}) {
  if (recentOperations.length === 0 && recentReviews.length === 0) {
    return ["先记录 3-5 次操作或复盘，再让 AI 判断是否存在重复模式。"];
  }

  const questions = [];

  if (reviewCoverageRate < 60) {
    questions.push("哪些操作还没有复盘实际结果？先补复盘，再判断策略是否有效。");
  }

  if (emotionHeat >= 50 || topEmotions.length > 0) {
    questions.push(`本周期最需要回看的情绪是 ${topEmotions[0]?.[0] ?? "情绪波动"}：它是否改变了原计划？`);
  }

  if (delayedExitRate >= 25) {
    questions.push("出现犹豫或纠结时，实际动作是按计划执行，还是临场重新解释？");
  }

  if (violationRate > 0 || topViolations.length > 0) {
    questions.push(`违反计划最常见标签是 ${topViolations[0]?.[0] ?? "未标记"}：它来自计划不清楚，还是执行偏差？`);
  }

  if (topStrategies.length > 0) {
    questions.push(`高频策略「${topStrategies[0][0]}」对应的复盘结果是否稳定，还是只是在记录理由里反复出现？`);
  }

  return questions.slice(0, 4);
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce(
    (counts, item) => {
      const key = getKey(item);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );
}

function countTags(tags: string[]) {
  return tags.reduce(
    (counts, tag) => {
      counts[tag] = (counts[tag] ?? 0) + 1;
      return counts;
    },
    {} as Record<string, number>
  );
}

function topEntries(counts: Record<string, number>, limit: number) {
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

function formatTopEntries(entries: Array<[string, number]>) {
  if (entries.length === 0) {
    return "暂无";
  }

  return entries.map(([label, count]) => `${label} ${count} 次`).join("、");
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const baseUrl = process.argv[2] ?? "http://localhost:3000";
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const auditId = `audit-contract-${runId}`;

let planId;
let operationId;
let reviewId;

try {
  const status = await request("/api/system/status?db=1");
  assert(status.integrations?.database?.ok, "Database connection is not ready.");
  assert(status.integrations?.database?.singleUserConfigured, "Single-user profile is not configured.");

  const createdPlan = await request("/api/plans", {
    method: "POST",
    body: {
      title: `API contract ${runId}`,
      assetName: "Synthetic Asset",
      ticker: "TEST",
      market: "LOCAL",
      currency: "USD",
      status: "active",
      thesis: "Synthetic database verification only."
    }
  });
  planId = createdPlan.plan.id;

  const updatedPlan = await request(`/api/plans/${planId}`, {
    method: "PATCH",
    body: {
      title: `API contract updated ${runId}`,
      assetName: "Synthetic Asset",
      ticker: "TEST",
      market: "LOCAL",
      currency: "USD",
      status: "active",
      thesis: "Updated synthetic database verification only."
    }
  });
  assert(updatedPlan.plan.title.includes("updated"), "Plan update was not returned.");

  const createdOperation = await request(`/api/plans/${planId}/operations`, {
    method: "POST",
    body: {
      action: "buy",
      tradeTime: new Date().toISOString(),
      currency: "USD",
      price: 10,
      quantity: 5,
      quantityUnit: "shares",
      totalAmount: 50,
      takeProfitPrice: 12,
      stopLossPrice: 9,
      decisionReason: "Synthetic operation.",
      emotionTags: ["calm"],
      strategyTags: ["contract-test"],
      source: "manual"
    }
  });
  operationId = createdOperation.operation.id;

  const updatedOperation = await request(`/api/plans/${planId}/operations/${operationId}`, {
    method: "PATCH",
    body: {
      action: "buy",
      tradeTime: createdOperation.operation.tradeTime,
      currency: "USD",
      price: 10,
      quantity: 5,
      quantityUnit: "shares",
      totalAmount: 50,
      takeProfitPrice: 12,
      stopLossPrice: 9,
      decisionReason: "Synthetic operation updated.",
      psychologyNote: "Contract test.",
      emotionTags: ["calm"],
      strategyTags: ["contract-test"],
      source: "manual"
    }
  });
  assert(updatedOperation.operation.decisionReason.includes("updated"), "Operation update was not returned.");

  const createdReview = await request(`/api/plans/${planId}/reviews`, {
    method: "POST",
    body: {
      reviewTime: new Date().toISOString(),
      operationIds: [operationId],
      realizedResult: "met",
      profitLoss: 5,
      violatedRules: [],
      reviewNote: "Synthetic review.",
      emotionTags: ["calm"]
    }
  });
  reviewId = createdReview.review.id;

  const updatedReview = await request(`/api/plans/${planId}/reviews/${reviewId}`, {
    method: "PATCH",
    body: {
      reviewTime: createdReview.review.reviewTime,
      operationIds: [operationId],
      realizedResult: "met",
      profitLoss: 5,
      violatedRules: [],
      reviewNote: "Synthetic review updated.",
      emotionTags: ["calm"]
    }
  });
  assert(updatedReview.review.reviewNote.includes("updated"), "Review update was not returned.");

  await request("/api/audit/archive", {
    method: "POST",
    body: {
      id: auditId,
      periodStart: "2026-06-19",
      periodEnd: "2026-07-19",
      title: "Synthetic cloud audit",
      summary: "Synthetic database verification only.",
      signalLabel: "Stable",
      signalLevel: "stable",
      metrics: {
        emotionHeat: 0,
        delayedExitRate: 0,
        recordCount: 2,
        reviewCoverageRate: 100,
        violationRate: 0
      },
      aiInputDigest: [],
      findings: ["Synthetic finding"],
      reviewQuestions: [],
      createdAt: new Date().toISOString()
    }
  });

  const plans = await request("/api/plans");
  const audits = await request("/api/audit/reports");
  const storedPlan = plans.plans.find((plan) => plan.id === planId);
  assert(storedPlan?.operations.length === 1, "Stored operation was not returned.");
  assert(storedPlan?.reviews.length === 1, "Stored review was not returned.");
  assert(audits.reports.some((report) => report.id === auditId), "Stored audit was not returned.");

  console.log("Database API create, read, and update verification passed.");
} finally {
  await safeDelete(reviewId && planId ? `/api/plans/${planId}/reviews/${reviewId}` : null);
  await safeDelete(operationId && planId ? `/api/plans/${planId}/operations/${operationId}` : null);
  await safeDelete(`/api/audit/reports/${auditId}`);
  await safeDelete(planId ? `/api/plans/${planId}` : null);
}

const remainingPlans = await request("/api/plans");
const remainingAudits = await request("/api/audit/reports");
assert(!remainingPlans.plans.some((plan) => plan.id === planId), "Synthetic plan cleanup failed.");
assert(!remainingAudits.reports.some((report) => report.id === auditId), "Synthetic audit cleanup failed.");
console.log("Database API delete verification passed; synthetic data cleaned up.");

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.meta?.message ?? result.errors?.[0] ?? `${options.method ?? "GET"} ${path} failed.`);
  }

  return result;
}

async function safeDelete(path) {
  if (!path) {
    return;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: { "X-Confirm-Delete": "true" }
  });
  if (!response.ok && response.status !== 404) {
    const result = await response.json();
    throw new Error(result.meta?.message ?? result.errors?.[0] ?? `DELETE ${path} failed.`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

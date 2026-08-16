const baseUrl = process.argv[2] ?? "http://localhost:3000";
const accessUsername = process.env.APP_ACCESS_USERNAME;
const accessPassword = process.env.APP_ACCESS_PASSWORD;
const authorization =
  accessUsername && accessPassword
    ? `Basic ${Buffer.from(`${accessUsername}:${accessPassword}`).toString("base64")}`
    : undefined;
let sessionCookie;
if (process.env.TEST_AUTH_EMAIL && process.env.TEST_AUTH_PASSWORD) {
  sessionCookie = await loginForVerification();
}
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const auditId = `audit-contract-${runId}`;
const clientPlanId = `plan-client-${runId}`;
const clientOperationId = `operation-client-${runId}`;
const clientReviewId = `review-client-${runId}`;
const screenshotPlanId = `plan-screenshot-${runId}`;
const screenshotExistingOperationId = `operation-screenshot-existing-${runId}`;
const screenshotNewOperationId = `operation-screenshot-new-${runId}`;
const screenshotRollbackPlanId = `plan-screenshot-rollback-${runId}`;

let planId;
let operationId;
let reviewId;
let bulkPlanId;

try {
  const status = await request("/api/system/status?db=1");
  assert(status.integrations?.database?.ok, "Database connection is not ready.");
  assert(status.integrations?.database?.singleUserConfigured, "Single-user profile is not configured.");

  const createdPlan = await request("/api/plans", {
    method: "POST",
    body: {
      id: clientPlanId,
      title: `API contract ${runId}`,
      assetName: "Synthetic Asset",
      ticker: "TEST",
      market: "LOCAL",
      currency: "USD",
      status: "active",
      thesis: "Synthetic database verification only.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
  planId = createdPlan.plan.id;
  assert(planId === clientPlanId, "Cloud plan create did not preserve the client id.");
  const retriedPlan = await request("/api/plans", {
    method: "POST",
    body: {
      ...createdPlan.plan,
      operations: undefined,
      reviews: undefined
    }
  });
  assert(retriedPlan.plan.id === clientPlanId, "Retrying cloud plan create changed the client id.");

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
      id: clientOperationId,
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
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
  operationId = createdOperation.operation.id;
  assert(operationId === clientOperationId, "Cloud operation create did not preserve the client id.");
  const retriedOperation = await request(`/api/plans/${planId}/operations`, {
    method: "POST",
    body: createdOperation.operation
  });
  assert(retriedOperation.operation.id === clientOperationId, "Retrying cloud operation create changed the client id.");

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
      id: clientReviewId,
      reviewTime: new Date().toISOString(),
      operationIds: [operationId],
      realizedResult: "met",
      profitLoss: 5,
      violatedRules: [],
      reviewNote: "Synthetic review.",
      emotionTags: ["calm"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });
  reviewId = createdReview.review.id;
  assert(reviewId === clientReviewId, "Cloud review create did not preserve the client id.");
  const retriedReview = await request(`/api/plans/${planId}/reviews`, {
    method: "POST",
    body: createdReview.review
  });
  assert(retriedReview.review.id === clientReviewId, "Retrying cloud review create changed the client id.");

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

  const snapshot = await request(`/api/plans/${planId}/snapshot`, {
    method: "PUT",
    body: {
      ...updatedPlan.plan,
      title: `Transactional snapshot ${runId}`,
      operations: [{ ...updatedOperation.operation, decisionReason: "Transactional operation update." }],
      reviews: [{ ...updatedReview.review, reviewNote: "Transactional review update." }],
      updatedAt: new Date().toISOString()
    }
  });
  assert(snapshot.plan.title.includes("Transactional snapshot"), "Plan snapshot title was not committed.");
  assert(snapshot.plan.operations[0]?.decisionReason.includes("Transactional"), "Snapshot operation was not committed.");
  assert(snapshot.plan.reviews[0]?.reviewNote.includes("Transactional"), "Snapshot review was not committed.");

  await expectRejectedSnapshot(planId, {
    ...snapshot.plan,
    title: `Must roll back ${runId}`,
    operations: [
      {
        ...snapshot.plan.operations[0],
        action: "buy",
        quantity: undefined,
        quantityUnit: undefined,
        totalAmount: undefined
      }
    ]
  });
  await expectRejectedSnapshot(planId, { id: planId });
  const plansAfterRejectedSnapshot = await request("/api/plans");
  assert(
    plansAfterRejectedSnapshot.plans.find((plan) => plan.id === planId)?.title === snapshot.plan.title,
    "Rejected snapshot changed persisted plan data."
  );

  const screenshotArchiveTime = new Date().toISOString();
  const screenshotBatch = {
    newPlans: [
      {
        id: screenshotPlanId,
        title: `Screenshot plan ${runId}`,
        assetName: "Synthetic Screenshot Asset",
        ticker: "SHOT",
        market: "LOCAL",
        currency: "USD",
        status: "active",
        thesis: "Synthetic screenshot archive verification only.",
        operations: [],
        reviews: [],
        createdAt: screenshotArchiveTime,
        updatedAt: screenshotArchiveTime
      }
    ],
    operations: [
      {
        id: screenshotExistingOperationId,
        planId,
        action: "buy",
        tradeTime: screenshotArchiveTime,
        currency: "USD",
        price: 20,
        quantity: 2,
        quantityUnit: "shares",
        totalAmount: 40,
        decisionReason: "Synthetic screenshot operation for an existing plan.",
        psychologyNote: "",
        emotionTags: [],
        strategyTags: ["截图补账"],
        source: "ai_screenshot",
        createdAt: screenshotArchiveTime,
        updatedAt: screenshotArchiveTime
      },
      {
        id: screenshotNewOperationId,
        planId: screenshotPlanId,
        action: "sell",
        tradeTime: screenshotArchiveTime,
        currency: "USD",
        price: 25,
        quantity: 2,
        quantityUnit: "shares",
        totalAmount: 50,
        decisionReason: "Synthetic screenshot operation for a new plan.",
        psychologyNote: "",
        emotionTags: [],
        strategyTags: ["截图补账"],
        source: "ai_screenshot",
        createdAt: screenshotArchiveTime,
        updatedAt: screenshotArchiveTime
      }
    ]
  };
  const screenshotArchive = await request("/api/recognitions/archive", {
    method: "POST",
    body: screenshotBatch
  });
  assert(screenshotArchive.archivedOperationCount === 2, "Screenshot archive did not report two operations.");
  assert(screenshotArchive.plans.length === 2, "Screenshot archive did not return both affected plans.");

  const retriedScreenshotArchive = await request("/api/recognitions/archive", {
    method: "POST",
    body: screenshotBatch
  });
  assert(retriedScreenshotArchive.archivedOperationCount === 2, "Screenshot archive retry changed its result.");
  const plansAfterScreenshotRetry = await request("/api/plans");
  assert(
    plansAfterScreenshotRetry.plans.flatMap((plan) => plan.operations).filter((item) => item.id === screenshotExistingOperationId).length === 1,
    "Screenshot archive retry duplicated the existing-plan operation."
  );
  assert(
    plansAfterScreenshotRetry.plans.flatMap((plan) => plan.operations).filter((item) => item.id === screenshotNewOperationId).length === 1,
    "Screenshot archive retry duplicated the new-plan operation."
  );

  await expectRejectedScreenshotArchive({
    newPlans: [
      {
        ...screenshotBatch.newPlans[0],
        id: screenshotRollbackPlanId,
        title: "Screenshot rollback plan"
      }
    ],
    operations: [
      {
        ...screenshotBatch.operations[1],
        id: `operation-screenshot-rollback-${runId}`,
        planId: screenshotRollbackPlanId
      },
      {
        ...screenshotBatch.operations[0],
        id: clientOperationId,
        planId: screenshotRollbackPlanId
      }
    ]
  });
  const plansAfterRejectedScreenshot = await request("/api/plans");
  assert(
    !plansAfterRejectedScreenshot.plans.some((plan) => plan.id === screenshotRollbackPlanId),
    "Rejected screenshot archive left a partial plan."
  );

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
  assert(storedPlan?.operations.some((operation) => operation.id === operationId), "Stored operation was not returned.");
  assert(storedPlan?.reviews.some((review) => review.id === reviewId), "Stored review was not returned.");
  assert(audits.reports.some((report) => report.id === auditId), "Stored audit was not returned.");

  bulkPlanId = `plan-bulk-${runId}`;
  const bulkOperationId = `operation-bulk-${runId}`;
  const now = new Date().toISOString();
  const bulkImport = await request("/api/sync/import-local", {
    method: "POST",
    body: {
      schemaVersion: 2,
      exportedAt: now,
      source: "rationaltrade-local",
      plans: [
        {
          id: bulkPlanId,
          title: "Legacy observe import",
          assetName: "Synthetic Asset",
          ticker: "TEST",
          market: "LOCAL",
          currency: "USD",
          status: "active",
          thesis: "Verify legacy observe normalization.",
          operations: [
            {
              id: bulkOperationId,
              planId: bulkPlanId,
              action: "observe",
              tradeTime: now,
              currency: "USD",
              price: 10,
              quantity: 5,
              quantityUnit: "shares",
              totalAmount: 50,
              decisionReason: "Legacy observe with obsolete quantity fields.",
              emotionTags: [],
              strategyTags: [],
              source: "manual",
              createdAt: now,
              updatedAt: now
            }
          ],
          reviews: [],
          createdAt: now,
          updatedAt: now
        }
      ],
      auditReports: []
    }
  });
  assert(bulkImport.imported.operations === 1, "Bulk import did not report the normalized operation.");

  const plansAfterBulkImport = await request("/api/plans");
  const importedObserve = plansAfterBulkImport.plans
    .find((plan) => plan.id === bulkPlanId)
    ?.operations.find((operation) => operation.id === bulkOperationId);
  assert(importedObserve, "Bulk-imported observe operation was not returned.");
  assert(
    importedObserve.quantity === undefined &&
      importedObserve.quantityUnit === undefined &&
      importedObserve.totalAmount === undefined,
    "Legacy observe quantity fields were not removed."
  );

  const rollbackPlanId = `plan-rollback-${runId}`;
  await expectRejectedImport(
    {
      schemaVersion: 2,
      exportedAt: now,
      source: "rationaltrade-local",
      plans: [
        {
          id: rollbackPlanId,
          title: "Invalid bulk plan",
          assetName: "Synthetic Asset",
          ticker: "TEST",
          market: "LOCAL",
          currency: "USD",
          status: "active",
          thesis: "Verify validation before transaction.",
          operations: [
            {
              id: `operation-invalid-${runId}`,
              planId: rollbackPlanId,
              action: "buy",
              tradeTime: now,
              currency: "USD",
              price: 10,
              decisionReason: "Missing required quantity fields.",
              emotionTags: [],
              strategyTags: [],
              source: "manual",
              createdAt: now,
              updatedAt: now
            }
          ],
          reviews: [],
          createdAt: now,
          updatedAt: now
        }
      ],
      auditReports: []
    },
    "买入或卖出必须填写数量和数量单位"
  );
  const plansAfterRejectedImport = await request("/api/plans");
  assert(!plansAfterRejectedImport.plans.some((plan) => plan.id === rollbackPlanId), "Rejected import wrote partial data.");

  console.log("Database API CRUD, screenshot transaction, and bulk import verification passed.");
} finally {
  await safeDelete(screenshotExistingOperationId && planId ? `/api/plans/${planId}/operations/${screenshotExistingOperationId}` : null);
  await safeDelete(`/api/plans/${screenshotPlanId}`);
  await safeDelete(reviewId && planId ? `/api/plans/${planId}/reviews/${reviewId}` : null);
  await safeDelete(operationId && planId ? `/api/plans/${planId}/operations/${operationId}` : null);
  await safeDelete(`/api/audit/reports/${auditId}`);
  await safeDelete(bulkPlanId ? `/api/plans/${bulkPlanId}` : null);
  await safeDelete(planId ? `/api/plans/${planId}` : null);
}

const remainingPlans = await request("/api/plans");
const remainingAudits = await request("/api/audit/reports");
assert(!remainingPlans.plans.some((plan) => plan.id === planId), "Synthetic plan cleanup failed.");
assert(!remainingPlans.plans.some((plan) => plan.id === bulkPlanId), "Synthetic bulk plan cleanup failed.");
assert(!remainingPlans.plans.some((plan) => plan.id === screenshotPlanId), "Synthetic screenshot plan cleanup failed.");
assert(!remainingPlans.plans.some((plan) => plan.id === screenshotRollbackPlanId), "Rejected screenshot plan cleanup failed.");
assert(!remainingAudits.reports.some((report) => report.id === auditId), "Synthetic audit cleanup failed.");
console.log("Database API delete verification passed; synthetic data cleaned up.");

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(authorization ? { authorization } : {}),
      ...(sessionCookie ? { cookie: sessionCookie } : {})
    },
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
    headers: {
      "X-Confirm-Delete": "true",
      ...(authorization ? { authorization } : {}),
      ...(sessionCookie ? { cookie: sessionCookie } : {})
    }
  });
  if (!response.ok && response.status !== 404) {
    const result = await response.json();
    throw new Error(result.meta?.message ?? result.errors?.[0] ?? `DELETE ${path} failed.`);
  }
}

async function expectRejectedImport(body, expectedMessage) {
  const response = await fetch(`${baseUrl}/api/sync/import-local`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
      ...(sessionCookie ? { cookie: sessionCookie } : {})
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  assert(response.status === 400, `Invalid bulk import returned ${response.status} instead of 400.`);
  assert(result.meta?.message?.includes(expectedMessage), "Invalid bulk import did not return a specific Chinese message.");
}

async function expectRejectedSnapshot(planId, body) {
  const response = await fetch(`${baseUrl}/api/plans/${planId}/snapshot`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
      ...(sessionCookie ? { cookie: sessionCookie } : {})
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  assert(response.status === 400, `Invalid snapshot returned ${response.status} instead of 400.`);
  assert(result.meta?.message, "Invalid snapshot did not return a validation message.");
}

async function expectRejectedScreenshotArchive(body) {
  const response = await fetch(`${baseUrl}/api/recognitions/archive`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
      ...(sessionCookie ? { cookie: sessionCookie } : {})
    },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  assert(response.status === 400, `Invalid screenshot archive returned ${response.status} instead of 400.`);
  assert(result.meta?.message?.includes("冲突"), "Invalid screenshot archive did not report the ID conflict.");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function loginForVerification() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_AUTH_EMAIL, password: process.env.TEST_AUTH_PASSWORD })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Verification login failed.");
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Verification login did not return a session cookie.");
  return cookie;
}

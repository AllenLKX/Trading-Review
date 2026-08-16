import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import pg from "pg";

const { Pool } = pg;
const argumentsWithoutSeparator = process.argv.slice(2).filter((argument) => argument !== "--");
const baseUrl = argumentsWithoutSeparator[0] ?? "http://127.0.0.1:3000";
const imagePath = argumentsWithoutSeparator[1];
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!imagePath) throw new Error("Usage: pnpm verify:ai-workflow -- <base-url> <image-path>");

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `ai-workflow-${runId}@rationaltrade.invalid`;
const password = `AiWorkflow-${runId}!`;
const anonymousId = `ai-workflow-anon-${runId}`;
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const timings = {};
let userId;

try {
  const registration = await timedFetch("registerMs", `${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, anonymousId })
  });
  const registrationBody = await registration.json();
  assert(registration.status === 201, registrationBody.error ?? "Registration failed.");
  userId = registrationBody.user?.id;
  const cookie = readCookie(registration);

  const image = await readFile(imagePath);
  const form = new FormData();
  form.set("image", new Blob([image], { type: readImageType(imagePath) }), basename(imagePath));
  const recognition = await timedFetch("recognitionMs", `${baseUrl}/api/recognitions`, {
    method: "POST",
    headers: { cookie },
    body: form
  });
  const recognitionBody = await recognition.json();
  assert(recognition.ok, recognitionBody.error ?? "Screenshot recognition failed.");
  assertRecognitionMatchesHumanReading(recognitionBody.items);

  const batch = buildArchiveBatch(recognitionBody.items);
  const archive = await timedFetch("archiveMs", `${baseUrl}/api/recognitions/archive`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(batch)
  });
  const archiveBody = await archive.json();
  assert(archive.ok, archiveBody.meta?.message ?? "Screenshot archive failed.");
  assert(archiveBody.archivedOperationCount === 3, "Expected three archived screenshot operations.");

  const audit = await timedFetch("auditMs", `${baseUrl}/api/audit`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ plans: archiveBody.plans })
  });
  const auditBody = await audit.json();
  assert(audit.ok, auditBody.error ?? "AI audit failed.");
  assert(auditBody.source === "deepseek", `Expected DeepSeek audit, received ${auditBody.source ?? "unknown"}.`);

  const auditArchive = await timedFetch("auditArchiveMs", `${baseUrl}/api/audit/archive`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(auditBody.report)
  });
  const auditArchiveBody = await auditArchive.json();
  assert(auditArchive.status === 201 && auditArchiveBody.ok, "AI audit archive failed.");

  const eventResult = await pool.query(
    `select event_name, metadata from app_events
     where user_id = $1 and event_name in (
       'ai_screenshot_recognized', 'screenshot_batch_archived', 'ai_audit_generated', 'audit_archived'
     )`,
    [userId]
  );
  const eventNames = new Set(eventResult.rows.map((row) => row.event_name));
  for (const expected of ["ai_screenshot_recognized", "screenshot_batch_archived", "ai_audit_generated", "audit_archived"]) {
    assert(eventNames.has(expected), `Missing ${expected} analytics event.`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        recognizedTrades: recognitionBody.items.map(({ assetName, action, price, quantity }) => ({
          assetName,
          action,
          price,
          quantity
        })),
        recognition: recognitionBody.meta,
        audit: { source: auditBody.source, model: auditBody.model, promptVersion: auditBody.report?.generation?.promptVersion },
        timings
      },
      null,
      2
    )
  );
} finally {
  if (!userId) {
    const profile = await pool.query("select id from profiles where email = $1", [email]);
    userId = profile.rows[0]?.id;
  }
  if (userId) {
    await pool.query("delete from app_events where user_id = $1", [userId]);
    await pool.query("delete from profiles where id = $1", [userId]);
  }
  await pool.end();
}

async function timedFetch(name, url, options) {
  const startedAt = performance.now();
  const response = await fetch(url, options);
  timings[name] = Math.round(performance.now() - startedAt);
  return response;
}

function buildArchiveBatch(items) {
  const now = new Date().toISOString();
  const plansByAsset = new Map();
  const operations = items.map((item, index) => {
    const key = `${item.ticker || item.assetName}-${item.currency}`.toLowerCase();
    let plan = plansByAsset.get(key);
    if (!plan) {
      plan = {
        id: `ai-workflow-plan-${runId}-${plansByAsset.size}`,
        title: `${item.assetName} 截图补账计划`,
        assetName: item.assetName,
        ticker: item.ticker || item.assetName,
        market: item.market || "自选",
        currency: item.currency,
        status: "active",
        thesis: "AI 全链路回归的临时计划。",
        operations: [],
        reviews: [],
        createdAt: now,
        updatedAt: now
      };
      plansByAsset.set(key, plan);
    }
    const quantityUnit = item.quantityUnit ?? "shares";
    return {
      id: `ai-workflow-operation-${runId}-${index}`,
      planId: plan.id,
      action: item.action,
      tradeTime: item.tradeTime,
      currency: item.currency,
      price: item.price,
      quantity: item.quantity,
      quantityUnit,
      totalAmount: quantityUnit === "units" ? item.quantity : item.totalAmount ?? item.price * item.quantity,
      decisionReason: "AI 全链路回归的截图确认记录。",
      psychologyNote: item.psychologyNote,
      emotionTags: item.emotionTags,
      strategyTags: ["截图补账"],
      source: "ai_screenshot",
      createdAt: now,
      updatedAt: now
    };
  });
  return { newPlans: [...plansByAsset.values()], operations };
}

function assertRecognitionMatchesHumanReading(items) {
  assert(Array.isArray(items) && items.length === 3, `Expected exactly three trades, received ${items?.length ?? 0}.`);
  const expected = [
    { assetName: "半导材料", action: "sell", price: 2.566, quantity: 19100 },
    { assetName: "科创50", action: "buy", price: 1.832, quantity: 16300 },
    { assetName: "华丰股份", action: "buy", price: 38.1, quantity: 500 }
  ];
  for (const trade of expected) {
    const match = items.find((item) => item.assetName.includes(trade.assetName));
    assert(match, `Missing ${trade.assetName} in recognized trades.`);
    assert(match.action === trade.action, `${trade.assetName} action mismatch.`);
    assert(nearlyEqual(match.price, trade.price), `${trade.assetName} price mismatch.`);
    assert(nearlyEqual(match.quantity, trade.quantity), `${trade.assetName} quantity mismatch.`);
  }
}

function nearlyEqual(left, right) {
  return Number.isFinite(left) && Math.abs(left - right) < 0.0001;
}

function readImageType(path) {
  return path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

function readCookie(response) {
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Session cookie was not returned.");
  return cookie;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

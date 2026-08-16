import { createHmac, randomUUID } from "node:crypto";

import pg from "pg";

const { Pool } = pg;
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const separator = argument.indexOf("=");
    return separator > 0 ? [argument.slice(0, separator), argument.slice(separator + 1)] : [argument, "true"];
  })
);
const email = args.get("--email")?.trim().toLowerCase();
const mode = args.has("--remove") ? "remove" : args.has("--apply") ? "apply" : "preview";
const databaseUrl = process.env.DATABASE_URL;
const sessionSecret = process.env.AUTH_SESSION_SECRET;
const baseUrl = args.get("--base-url") ?? "http://127.0.0.1:3000";
const prefix = "promo-longtrack-v1";

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!email) throw new Error("Usage: node scripts/seed-promo-history.mjs --email=user@example.com --apply");

const plans = buildPlans();
const pool = new Pool({ connectionString: databaseUrl, max: 2 });
let sessionId;

try {
  const profile = await pool.query("select id, email from profiles where lower(email) = lower($1)", [email]);
  if (profile.rowCount !== 1) throw new Error("Target account was not found or is ambiguous.");
  const user = profile.rows[0];

  if (mode === "preview") {
    const existing = await readSummary(pool, user.id);
    console.log(JSON.stringify({ mode, target: maskEmail(user.email), existing, proposed: summarizePlans(plans) }, null, 2));
  } else if (mode === "remove") {
    await removePromoData(pool, user.id);
    console.log(JSON.stringify({ ok: true, mode, target: maskEmail(user.email), remaining: await readSummary(pool, user.id) }, null, 2));
  } else {
    if (!sessionSecret || sessionSecret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters.");
    await writePromoData(pool, user.id, plans);

    const session = await createTemporarySession(pool, user.id, sessionSecret);
    sessionId = session.id;
    const accountPlans = await requestJson(`${baseUrl}/api/plans`, { headers: { cookie: session.cookie } });
    const audit = await requestJson(`${baseUrl}/api/audit`, {
      method: "POST",
      headers: { cookie: session.cookie, "content-type": "application/json" },
      body: JSON.stringify({ plans: accountPlans.plans })
    });
    if (audit.source !== "deepseek") throw new Error(`Expected a real DeepSeek audit, received ${audit.source ?? "unknown"}.`);

    const report = {
      ...audit.report,
      id: `${prefix}-audit`,
      title: "近 30 天长期跟踪审计",
      createdAt: new Date().toISOString()
    };
    await requestJson(`${baseUrl}/api/audit/archive`, {
      method: "POST",
      headers: { cookie: session.cookie, "content-type": "application/json" },
      body: JSON.stringify(report)
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode,
          target: maskEmail(user.email),
          inserted: summarizePlans(plans),
          account: await readSummary(pool, user.id),
          audit: {
            source: audit.source,
            model: audit.model,
            promptVersion: audit.report?.generation?.promptVersion,
            signalLabel: audit.report?.signalLabel
          }
        },
        null,
        2
      )
    );
  }
} finally {
  if (sessionId) await pool.query("update auth_sessions set revoked_at = now() where id = $1", [sessionId]);
  await pool.end();
}

async function writePromoData(pool, userId, planData) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const plan of planData) {
      await client.query(
        `insert into trade_plans (
           id, user_id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         on conflict (id) do update set
           title=excluded.title, asset_name=excluded.asset_name, ticker=excluded.ticker, market=excluded.market,
           currency=excluded.currency, status=excluded.status, thesis=excluded.thesis, updated_at=excluded.updated_at
         where trade_plans.user_id=excluded.user_id`,
        [
          plan.id,
          userId,
          plan.title,
          plan.assetName,
          plan.ticker,
          plan.market,
          plan.currency,
          plan.status,
          plan.thesis,
          plan.createdAt,
          plan.updatedAt
        ]
      );
      for (const operation of plan.operations) {
        await client.query(
          `insert into trade_operations (
             id,user_id,plan_id,action,trade_time,currency,price,quantity,quantity_unit,total_amount,
             take_profit_price,stop_loss_price,decision_reason,psychology_note,emotion_tags,strategy_tags,source,created_at,updated_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           on conflict (id) do update set
             action=excluded.action, trade_time=excluded.trade_time, price=excluded.price, quantity=excluded.quantity,
             quantity_unit=excluded.quantity_unit, total_amount=excluded.total_amount,
             take_profit_price=excluded.take_profit_price, stop_loss_price=excluded.stop_loss_price,
             decision_reason=excluded.decision_reason, psychology_note=excluded.psychology_note,
             emotion_tags=excluded.emotion_tags, strategy_tags=excluded.strategy_tags, updated_at=excluded.updated_at
           where trade_operations.user_id=excluded.user_id and trade_operations.plan_id=excluded.plan_id`,
          [
            operation.id,
            userId,
            plan.id,
            operation.action,
            operation.tradeTime,
            plan.currency,
            operation.price ?? null,
            operation.quantity ?? null,
            operation.quantityUnit ?? null,
            operation.totalAmount ?? null,
            operation.takeProfitPrice ?? null,
            operation.stopLossPrice ?? null,
            operation.decisionReason,
            operation.psychologyNote,
            operation.emotionTags,
            operation.strategyTags,
            "manual",
            operation.createdAt,
            operation.updatedAt
          ]
        );
      }
      for (const review of plan.reviews) {
        await client.query(
          `insert into plan_reviews (
             id,user_id,plan_id,review_time,operation_ids,realized_result,profit_loss,violated_rules,
             review_note,emotion_tags,created_at,updated_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           on conflict (id) do update set
             review_time=excluded.review_time, operation_ids=excluded.operation_ids,
             realized_result=excluded.realized_result, profit_loss=excluded.profit_loss,
             violated_rules=excluded.violated_rules, review_note=excluded.review_note,
             emotion_tags=excluded.emotion_tags, updated_at=excluded.updated_at
           where plan_reviews.user_id=excluded.user_id and plan_reviews.plan_id=excluded.plan_id`,
          [
            review.id,
            userId,
            plan.id,
            review.reviewTime,
            review.operationIds,
            review.realizedResult,
            review.profitLoss ?? null,
            review.violatedRules,
            review.reviewNote,
            review.emotionTags,
            review.createdAt,
            review.updatedAt
          ]
        );
      }
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function removePromoData(pool, userId) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from audit_reports where user_id=$1 and id=$2", [userId, `${prefix}-audit`]);
    await client.query("delete from trade_plans where user_id=$1 and id like $2", [userId, `${prefix}-%`]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function createTemporarySession(pool, userId, secret) {
  const id = randomUUID();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  await pool.query("insert into auth_sessions (id,user_id,expires_at) values ($1,$2,to_timestamp($3 / 1000.0))", [id, userId, expiresAt]);
  const encodedPayload = Buffer.from(JSON.stringify({ userId, sessionId: id, expiresAt })).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return { id, cookie: `rt_session=${encodedPayload}.${signature}` };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? body.meta?.message ?? body.errors?.[0] ?? `${url} returned ${response.status}.`);
  return body;
}

async function readSummary(pool, userId) {
  const result = await pool.query(
    `select
       (select count(*)::int from trade_plans where user_id=$1) as plans,
       (select count(*)::int from trade_operations where user_id=$1) as operations,
       (select count(*)::int from plan_reviews where user_id=$1) as reviews,
       (select count(*)::int from audit_reports where user_id=$1) as audits,
       (select min(trade_time)::date from trade_operations where user_id=$1) as first_operation,
       (select max(trade_time)::date from trade_operations where user_id=$1) as latest_operation`,
    [userId]
  );
  return result.rows[0];
}

function summarizePlans(planData) {
  return {
    plans: planData.length,
    operations: planData.reduce((sum, plan) => sum + plan.operations.length, 0),
    reviews: planData.reduce((sum, plan) => sum + plan.reviews.length, 0),
    period: [
      planData.flatMap((plan) => plan.operations).map((item) => item.tradeTime).sort()[0].slice(0, 10),
      planData.flatMap((plan) => plan.operations).map((item) => item.tradeTime).sort().at(-1).slice(0, 10)
    ]
  };
}

function maskEmail(value) {
  const [name, domain] = value.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function buildPlans() {
  const plan = (key, data) => ({ id: `${prefix}-${key}`, ...data });
  const operation = (planKey, index, data) => ({
    id: `${prefix}-${planKey}-operation-${index}`,
    createdAt: data.tradeTime,
    updatedAt: data.tradeTime,
    psychologyNote: "",
    emotionTags: [],
    strategyTags: [],
    ...data
  });
  const review = (planKey, index, data) => ({
    id: `${prefix}-${planKey}-review-${index}`,
    createdAt: data.reviewTime,
    updatedAt: data.reviewTime,
    operationIds: [],
    violatedRules: [],
    emotionTags: [],
    ...data
  });

  return [
    plan("tencent", {
      title: "腾讯控股：估值修复观察",
      assetName: "腾讯控股",
      ticker: "0700.HK",
      market: "HKG",
      currency: "HKD",
      status: "active",
      thesis: "演示数据：用季度维度跟踪盈利质量、回购节奏与估值变化，避免只因短期波动改变原计划。",
      createdAt: "2026-04-12T02:00:00.000Z",
      updatedAt: "2026-08-10T12:00:00.000Z",
      operations: [
        operation("tencent", 1, { action: "observe", tradeTime: "2026-05-03T03:15:00.000Z", price: 484, decisionReason: "财报前只建立观察基准，不因连续上涨追价。", psychologyNote: "看到板块走强有些兴奋，先记录而不行动。", emotionTags: ["兴奋", "观望"], strategyTags: ["财报"] }),
        operation("tencent", 2, { action: "buy", tradeTime: "2026-05-20T02:20:00.000Z", price: 471.8, quantity: 500, quantityUnit: "shares", totalAmount: 235900, takeProfitPrice: 540, stopLossPrice: 438, decisionReason: "财报验证主营趋势后按第一档计划建仓。", psychologyNote: "价格回落时仍有犹豫，按预先设定的第一档执行。", emotionTags: ["犹豫", "冷静"], strategyTags: ["财报", "回调"] }),
        operation("tencent", 3, { action: "observe", tradeTime: "2026-06-12T06:10:00.000Z", price: 505.5, decisionReason: "进入原计划中段，仅更新观察，不追加仓位。", psychologyNote: "浮盈后出现加速买入冲动，选择等待下一次验证。", emotionTags: ["兴奋", "观望"], strategyTags: ["仓位调整"] }),
        operation("tencent", 4, { action: "buy", tradeTime: "2026-07-22T02:45:00.000Z", price: 512.2, quantity: 300, quantityUnit: "shares", totalAmount: 153660, takeProfitPrice: 560, stopLossPrice: 476, decisionReason: "回购与盈利趋势仍符合假设，按第二档补足计划仓位。", psychologyNote: "这次先核对计划再下单，情绪比第一次稳定。", emotionTags: ["冷静"], strategyTags: ["回调", "仓位调整"] }),
        operation("tencent", 5, { action: "sell", tradeTime: "2026-08-08T03:05:00.000Z", price: 548.6, quantity: 200, quantityUnit: "shares", totalAmount: 109720, decisionReason: "价格进入计划减仓区间，先兑现一档并保留跟踪仓位。", psychologyNote: "上涨时不舍得卖，但按分档计划完成减仓。", emotionTags: ["纠结", "冷静"], strategyTags: ["仓位调整"] })
      ],
      reviews: [
        review("tencent", 1, { reviewTime: "2026-06-15T12:00:00.000Z", operationIds: [`${prefix}-tencent-operation-2`, `${prefix}-tencent-operation-3`], realizedResult: "partial", profitLoss: 16850, reviewNote: "核心假设仍在，但浮盈阶段出现了临时加仓冲动；好在只记录观察，没有破坏仓位上限。", emotionTags: ["兴奋", "冷静"] }),
        review("tencent", 2, { reviewTime: "2026-08-10T12:00:00.000Z", operationIds: [`${prefix}-tencent-operation-4`, `${prefix}-tencent-operation-5`], realizedResult: "met", profitLoss: 15380, reviewNote: "第二档买入和第一档减仓均按计划执行。需要继续观察自己在上涨阶段是否会推迟兑现。", emotionTags: ["冷静"] })
      ]
    }),
    plan("star50", {
      title: "科创50：分批执行实验",
      assetName: "科创50ETF",
      ticker: "588000.SH",
      market: "SHG",
      currency: "CNY",
      status: "active",
      thesis: "演示数据：只验证分批执行纪律，不预测指数方向；每次动作前先核对仓位和失效条件。",
      createdAt: "2026-06-01T02:00:00.000Z",
      updatedAt: "2026-08-13T12:00:00.000Z",
      operations: [
        operation("star50", 1, { action: "buy", tradeTime: "2026-06-03T02:00:00.000Z", price: 1.832, quantity: 16300, quantityUnit: "shares", totalAmount: 29861.6, takeProfitPrice: 2.05, stopLossPrice: 1.72, decisionReason: "达到第一档观察区，使用计划资金的三分之一。", psychologyNote: "担心错过反弹，但只执行第一档。", emotionTags: ["焦虑", "冷静"], strategyTags: ["右侧交易", "仓位调整"] }),
        operation("star50", 2, { action: "observe", tradeTime: "2026-06-24T06:20:00.000Z", price: 1.91, decisionReason: "反弹后尚未出现第二档确认条件，继续观察。", psychologyNote: "账户转正后想提前加仓，暂缓操作。", emotionTags: ["兴奋", "观望"], strategyTags: ["突破"] }),
        operation("star50", 3, { action: "buy", tradeTime: "2026-07-18T02:35:00.000Z", price: 1.876, quantity: 12000, quantityUnit: "shares", totalAmount: 22512, takeProfitPrice: 2.08, stopLossPrice: 1.74, decisionReason: "回踩后仍保持原结构，执行第二档而不一次性补满。", psychologyNote: "下跌当天有些不安，重新阅读计划后才操作。", emotionTags: ["焦虑", "冷静"], strategyTags: ["回调", "仓位调整"] }),
        operation("star50", 4, { action: "observe", tradeTime: "2026-08-12T06:30:00.000Z", price: 1.968, decisionReason: "价格接近评估区，先观察成交与计划条件。", psychologyNote: "没有因为连续上涨追第三档。", emotionTags: ["冷静", "观望"], strategyTags: ["突破"] })
      ],
      reviews: [
        review("star50", 1, { reviewTime: "2026-07-21T12:00:00.000Z", operationIds: [`${prefix}-star50-operation-3`], realizedResult: "partial", profitLoss: 1104, violatedRules: ["操作前临时下调了理想买入价"], reviewNote: "仓位控制符合计划，但下单前仍受当日波动影响，临时调整了预期价格。", emotionTags: ["焦虑"] }),
        review("star50", 2, { reviewTime: "2026-08-13T12:00:00.000Z", operationIds: [`${prefix}-star50-operation-4`], realizedResult: "met", profitLoss: 0, reviewNote: "本阶段最重要的进步是没有把观察信号变成追涨动作，继续保持分档纪律。", emotionTags: ["冷静"] })
      ]
    }),
    plan("huafeng", {
      title: "华丰股份：事件后跟踪",
      assetName: "华丰股份",
      ticker: "605100.SH",
      market: "SHG",
      currency: "CNY",
      status: "closed",
      thesis: "演示数据：把事件刺激后的动作与情绪分开记录，重点检查止损和退出是否按原计划执行。",
      createdAt: "2026-05-18T02:00:00.000Z",
      updatedAt: "2026-08-02T12:00:00.000Z",
      operations: [
        operation("huafeng", 1, { action: "observe", tradeTime: "2026-05-22T12:40:00.000Z", price: 36.2, decisionReason: "事件出现但信息仍不完整，先记录观察。", psychologyNote: "消息刺激带来明显兴奋，暂不买入。", emotionTags: ["兴奋", "观望"], strategyTags: ["消息刺激"] }),
        operation("huafeng", 2, { action: "buy", tradeTime: "2026-06-17T02:09:00.000Z", price: 38.1, quantity: 500, quantityUnit: "shares", totalAmount: 19050, takeProfitPrice: 43, stopLossPrice: 35.8, decisionReason: "等待价格确认后使用小仓位验证假设。", psychologyNote: "突破时仍有追高担忧，因此保持计划的小仓位。", emotionTags: ["焦虑", "冷静"], strategyTags: ["突破", "右侧交易"] }),
        operation("huafeng", 3, { action: "sell", tradeTime: "2026-07-09T02:18:00.000Z", price: 36.4, quantity: 500, quantityUnit: "shares", totalAmount: 18200, decisionReason: "假设弱化并接近失效条件，退出观察。", psychologyNote: "比原止损条件晚了一次确认，退出时有不甘心。", emotionTags: ["不甘心", "纠结"], strategyTags: ["仓位调整"] }),
        operation("huafeng", 4, { action: "observe", tradeTime: "2026-07-29T06:05:00.000Z", price: 37.3, decisionReason: "退出后只做复核观察，不因反弹立刻回补。", psychologyNote: "看到反弹仍有追回冲动，选择记录而不操作。", emotionTags: ["犹豫", "观望"], strategyTags: ["消息刺激"] })
      ],
      reviews: [
        review("huafeng", 1, { reviewTime: "2026-07-11T12:00:00.000Z", operationIds: [`${prefix}-huafeng-operation-2`, `${prefix}-huafeng-operation-3`], realizedResult: "missed", profitLoss: -850, violatedRules: ["退出确认晚于原计划"], reviewNote: "买入仓位受控，但退出时等待了额外确认，导致实际损失高于原计划。", emotionTags: ["不甘心", "纠结"] }),
        review("huafeng", 2, { reviewTime: "2026-08-02T12:00:00.000Z", operationIds: [`${prefix}-huafeng-operation-4`], realizedResult: "met", profitLoss: 0, reviewNote: "退出后的反弹没有触发报复性回补，说明观察记录能帮助把情绪和动作分开。", emotionTags: ["冷静", "观望"] })
      ]
    })
  ];
}

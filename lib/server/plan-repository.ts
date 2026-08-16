import type { PoolClient, QueryResultRow } from "pg";

import { getDatabasePool } from "@/lib/server/db";
import { getConfiguredUserId } from "@/lib/server/single-user";
import {
  parseCreateOperationInput,
  parseCreatePlanInput,
  parseCreateReviewInput,
  type CreateEntityIdentity,
  type CreateOperationInput,
  type CreatePlanInput,
  type CreateReviewInput
} from "@/lib/server/trade-validation";
import { parseAuditReportInput } from "@/lib/server/audit-validation";
import type {
  AuditReport,
  CurrencyCode,
  PlanReview,
  PlanStatus,
  QuantityUnit,
  RealizedResult,
  TradeAction,
  TradeOperation,
  TradePlan,
  TradeSource
} from "@/lib/types";

type PlanListResult = {
  plans: TradePlan[];
  storage: "postgres" | "not-configured" | "missing-user" | "error";
  message?: string;
};

type MutationResult<T> =
  | {
      ok: true;
      storage: "postgres";
      data: T;
    }
  | {
      ok: false;
      storage: "not-configured" | "missing-user" | "not-found" | "validation" | "error";
      message: string;
    };

type ImportLocalDataResult =
  | {
      ok: true;
      storage: "postgres";
      imported: {
        plans: number;
        operations: number;
        reviews: number;
        auditReports: number;
      };
    }
  | {
      ok: false;
      storage: "not-configured" | "missing-user" | "validation" | "error";
      message: string;
    };

type PlanRow = QueryResultRow & {
  id: string;
  title: string;
  asset_name: string;
  ticker: string;
  market: string;
  currency: CurrencyCode;
  status: PlanStatus;
  thesis: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type OperationRow = QueryResultRow & {
  id: string;
  plan_id: string;
  action: TradeAction;
  trade_time: Date | string;
  currency: CurrencyCode;
  price: string | number | null;
  quantity: string | number | null;
  quantity_unit: QuantityUnit | null;
  total_amount: string | number | null;
  take_profit_price: string | number | null;
  stop_loss_price: string | number | null;
  decision_reason: string;
  psychology_note: string | null;
  emotion_tags: string[];
  strategy_tags: string[];
  source: TradeSource;
  created_at: Date | string;
  updated_at: Date | string;
};

type ReviewRow = QueryResultRow & {
  id: string;
  plan_id: string;
  review_time: Date | string;
  operation_ids: string[];
  realized_result: RealizedResult;
  profit_loss: string | number | null;
  violated_rules: string[];
  review_note: string;
  emotion_tags: string[];
  created_at: Date | string;
  updated_at: Date | string;
};

export async function listServerTradePlans(): Promise<PlanListResult> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return {
      plans: [],
      storage: userResult.storage,
      message: userResult.message
    };
  }

  try {
    const pool = getDatabasePool();
    const [planResult, operationResult, reviewResult] = await Promise.all([
      pool.query<PlanRow>(
        `select id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at
         from trade_plans
         where user_id = $1
         order by updated_at desc`,
        [userResult.userId]
      ),
      pool.query<OperationRow>(
        `select id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
                total_amount, take_profit_price, stop_loss_price, decision_reason,
                psychology_note, emotion_tags, strategy_tags, source, created_at, updated_at
         from trade_operations
         where user_id = $1
         order by trade_time desc`,
        [userResult.userId]
      ),
      pool.query<ReviewRow>(
        `select id, plan_id, review_time, operation_ids, realized_result, profit_loss,
                violated_rules, review_note, emotion_tags, created_at, updated_at
         from plan_reviews
         where user_id = $1
         order by review_time desc`,
        [userResult.userId]
      )
    ]);

    const operationsByPlan = groupByPlanId(operationResult.rows.map(mapOperationRow));
    const reviewsByPlan = groupByPlanId(reviewResult.rows.map(mapReviewRow));

    return {
      plans: planResult.rows.map((row) => mapPlanRow(row, operationsByPlan.get(row.id) ?? [], reviewsByPlan.get(row.id) ?? [])),
      storage: "postgres"
    };
  } catch {
    return {
      plans: [],
      storage: "error",
      message: "Failed to load plans from PostgreSQL."
    };
  }
}

export async function createServerTradePlan(
  input: CreatePlanInput,
  identity: CreateEntityIdentity = {}
): Promise<MutationResult<TradePlan>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<PlanRow>(
      `insert into trade_plans (id, user_id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at)
       values (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, now()), coalesce($11, now()))
       on conflict (id) do update set
         title = excluded.title,
         asset_name = excluded.asset_name,
         ticker = excluded.ticker,
         market = excluded.market,
         currency = excluded.currency,
         status = excluded.status,
         thesis = excluded.thesis,
         updated_at = excluded.updated_at
       where trade_plans.user_id = excluded.user_id
       returning id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at`,
      [
        identity.id,
        userResult.userId,
        input.title,
        input.assetName,
        input.ticker,
        input.market,
        input.currency,
        input.status,
        input.thesis,
        identity.createdAt,
        identity.updatedAt
      ]
    );

    return {
      ok: true,
      storage: "postgres",
      data: mapPlanRow(result.rows[0], [], [])
    };
  } catch {
    return {
      ok: false,
      storage: "error",
      message: "Failed to create plan in PostgreSQL."
    };
  }
}

export async function updateServerTradePlan(planId: string, input: CreatePlanInput): Promise<MutationResult<TradePlan>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<PlanRow>(
      `update trade_plans
       set title = $3, asset_name = $4, ticker = $5, market = $6, currency = $7,
           status = $8, thesis = $9, updated_at = now()
       where id = $1 and user_id = $2
       returning id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at`,
      [planId, userResult.userId, input.title, input.assetName, input.ticker, input.market, input.currency, input.status, input.thesis]
    );

    if (result.rowCount !== 1) {
      return notFound("Plan was not found.");
    }

    const children = await loadPlanChildren(planId, userResult.userId);

    return {
      ok: true,
      storage: "postgres",
      data: mapPlanRow(result.rows[0], children.operations, children.reviews)
    };
  } catch {
    return databaseError("Failed to update plan in PostgreSQL.");
  }
}

export async function deleteServerTradePlan(planId: string): Promise<MutationResult<{ id: string }>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<{ id: string }>(
      `delete from trade_plans where id = $1 and user_id = $2 returning id`,
      [planId, userResult.userId]
    );

    if (result.rowCount !== 1) {
      return notFound("Plan was not found.");
    }

    return { ok: true, storage: "postgres", data: result.rows[0] };
  } catch {
    return databaseError("Failed to delete plan from PostgreSQL.");
  }
}

export async function createServerTradeOperation(
  planId: string,
  input: CreateOperationInput,
  identity: CreateEntityIdentity = {}
): Promise<MutationResult<TradeOperation>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const pool = getDatabasePool();
    const planExists = await ensurePlanBelongsToUser(planId, userResult.userId);

    if (!planExists) {
      return {
        ok: false,
        storage: "not-found",
        message: "Plan was not found."
      };
    }

    const result = await pool.query<OperationRow>(
      `insert into trade_operations (
          id, user_id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
          total_amount, take_profit_price, stop_loss_price, decision_reason,
          psychology_note, emotion_tags, strategy_tags, source, created_at, updated_at
       )
       values (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, coalesce($18, now()), coalesce($19, now()))
       on conflict (id) do update set
         action = excluded.action,
         trade_time = excluded.trade_time,
         currency = excluded.currency,
         price = excluded.price,
         quantity = excluded.quantity,
         quantity_unit = excluded.quantity_unit,
         total_amount = excluded.total_amount,
         take_profit_price = excluded.take_profit_price,
         stop_loss_price = excluded.stop_loss_price,
         decision_reason = excluded.decision_reason,
         psychology_note = excluded.psychology_note,
         emotion_tags = excluded.emotion_tags,
         strategy_tags = excluded.strategy_tags,
         source = excluded.source,
         updated_at = excluded.updated_at
       where trade_operations.user_id = excluded.user_id
       returning id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
                 total_amount, take_profit_price, stop_loss_price, decision_reason,
                 psychology_note, emotion_tags, strategy_tags, source, created_at, updated_at`,
      [
        identity.id,
        userResult.userId,
        planId,
        input.action,
        input.tradeTime,
        input.currency,
        input.price,
        input.quantity,
        input.quantityUnit,
        input.totalAmount,
        input.takeProfitPrice,
        input.stopLossPrice,
        input.decisionReason,
        input.psychologyNote,
        input.emotionTags,
        input.strategyTags,
        input.source,
        identity.createdAt,
        identity.updatedAt
      ]
    );

    await touchPlan(planId, userResult.userId);

    return {
      ok: true,
      storage: "postgres",
      data: mapOperationRow(result.rows[0])
    };
  } catch {
    return {
      ok: false,
      storage: "error",
      message: "Failed to create operation in PostgreSQL."
    };
  }
}

export async function updateServerTradeOperation(
  planId: string,
  operationId: string,
  input: CreateOperationInput
): Promise<MutationResult<TradeOperation>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<OperationRow>(
      `update trade_operations
       set action = $4, trade_time = $5, currency = $6, price = $7, quantity = $8,
           quantity_unit = $9, total_amount = $10, take_profit_price = $11,
           stop_loss_price = $12, decision_reason = $13, psychology_note = $14,
           emotion_tags = $15, strategy_tags = $16, source = $17, updated_at = now()
       where id = $1 and plan_id = $2 and user_id = $3
       returning id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
                 total_amount, take_profit_price, stop_loss_price, decision_reason,
                 psychology_note, emotion_tags, strategy_tags, source, created_at, updated_at`,
      [
        operationId,
        planId,
        userResult.userId,
        input.action,
        input.tradeTime,
        input.currency,
        input.price,
        input.quantity,
        input.quantityUnit,
        input.totalAmount,
        input.takeProfitPrice,
        input.stopLossPrice,
        input.decisionReason,
        input.psychologyNote,
        input.emotionTags,
        input.strategyTags,
        input.source
      ]
    );

    if (result.rowCount !== 1) {
      return notFound("Operation was not found in this plan.");
    }

    await touchPlan(planId, userResult.userId);
    return { ok: true, storage: "postgres", data: mapOperationRow(result.rows[0]) };
  } catch {
    return databaseError("Failed to update operation in PostgreSQL.");
  }
}

export async function deleteServerTradeOperation(
  planId: string,
  operationId: string
): Promise<MutationResult<{ id: string }>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<{ id: string }>(
      `delete from trade_operations where id = $1 and plan_id = $2 and user_id = $3 returning id`,
      [operationId, planId, userResult.userId]
    );

    if (result.rowCount !== 1) {
      return notFound("Operation was not found in this plan.");
    }

    await touchPlan(planId, userResult.userId);
    return { ok: true, storage: "postgres", data: result.rows[0] };
  } catch {
    return databaseError("Failed to delete operation from PostgreSQL.");
  }
}

export async function createServerPlanReview(
  planId: string,
  input: CreateReviewInput,
  identity: CreateEntityIdentity = {}
): Promise<MutationResult<PlanReview>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const pool = getDatabasePool();
    const planExists = await ensurePlanBelongsToUser(planId, userResult.userId);

    if (!planExists) {
      return {
        ok: false,
        storage: "not-found",
        message: "Plan was not found."
      };
    }

    const result = await pool.query<ReviewRow>(
      `insert into plan_reviews (
          id, user_id, plan_id, review_time, operation_ids, realized_result,
          profit_loss, violated_rules, review_note, emotion_tags, created_at, updated_at
       )
       values (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7, $8, $9, $10, coalesce($11, now()), coalesce($12, now()))
       on conflict (id) do update set
         review_time = excluded.review_time,
         operation_ids = excluded.operation_ids,
         realized_result = excluded.realized_result,
         profit_loss = excluded.profit_loss,
         violated_rules = excluded.violated_rules,
         review_note = excluded.review_note,
         emotion_tags = excluded.emotion_tags,
         updated_at = excluded.updated_at
       where plan_reviews.user_id = excluded.user_id
       returning id, plan_id, review_time, operation_ids, realized_result, profit_loss,
                 violated_rules, review_note, emotion_tags, created_at, updated_at`,
      [
        identity.id,
        userResult.userId,
        planId,
        input.reviewTime,
        input.operationIds,
        input.realizedResult,
        input.profitLoss,
        input.violatedRules,
        input.reviewNote,
        input.emotionTags,
        identity.createdAt,
        identity.updatedAt
      ]
    );

    await touchPlan(planId, userResult.userId);

    return {
      ok: true,
      storage: "postgres",
      data: mapReviewRow(result.rows[0])
    };
  } catch {
    return {
      ok: false,
      storage: "error",
      message: "Failed to create review in PostgreSQL."
    };
  }
}

export async function updateServerPlanReview(
  planId: string,
  reviewId: string,
  input: CreateReviewInput
): Promise<MutationResult<PlanReview>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<ReviewRow>(
      `update plan_reviews
       set review_time = $4, operation_ids = $5, realized_result = $6, profit_loss = $7,
           violated_rules = $8, review_note = $9, emotion_tags = $10, updated_at = now()
       where id = $1 and plan_id = $2 and user_id = $3
       returning id, plan_id, review_time, operation_ids, realized_result, profit_loss,
                 violated_rules, review_note, emotion_tags, created_at, updated_at`,
      [
        reviewId,
        planId,
        userResult.userId,
        input.reviewTime,
        input.operationIds,
        input.realizedResult,
        input.profitLoss,
        input.violatedRules,
        input.reviewNote,
        input.emotionTags
      ]
    );

    if (result.rowCount !== 1) {
      return notFound("Review was not found in this plan.");
    }

    await touchPlan(planId, userResult.userId);
    return { ok: true, storage: "postgres", data: mapReviewRow(result.rows[0]) };
  } catch {
    return databaseError("Failed to update review in PostgreSQL.");
  }
}

export async function deleteServerPlanReview(
  planId: string,
  reviewId: string
): Promise<MutationResult<{ id: string }>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  try {
    const result = await getDatabasePool().query<{ id: string }>(
      `delete from plan_reviews where id = $1 and plan_id = $2 and user_id = $3 returning id`,
      [reviewId, planId, userResult.userId]
    );

    if (result.rowCount !== 1) {
      return notFound("Review was not found in this plan.");
    }

    await touchPlan(planId, userResult.userId);
    return { ok: true, storage: "postgres", data: result.rows[0] };
  } catch {
    return databaseError("Failed to delete review from PostgreSQL.");
  }
}

export async function replaceServerTradePlanSnapshot(
  planId: string,
  plan: TradePlan
): Promise<MutationResult<TradePlan>> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  const validationMessage = validatePlanSnapshot(planId, plan);
  if (validationMessage) {
    return { ok: false, storage: "validation", message: validationMessage };
  }

  let client: PoolClient | null = null;

  try {
    client = await getDatabasePool().connect();
    await client.query("begin");

    const existing = await client.query<{ id: string }>(
      `select id from trade_plans where id = $1 and user_id = $2 for update`,
      [planId, userResult.userId]
    );
    if (existing.rowCount !== 1) {
      await client.query("rollback");
      return notFound("Plan was not found.");
    }

    const operationIds = plan.operations.map((operation) => operation.id);
    const reviewIds = plan.reviews.map((review) => review.id);
    await assertSnapshotChildOwnership(client, userResult.userId, planId, operationIds, reviewIds);

    const updatedAt = new Date().toISOString();
    const snapshot = { ...plan, id: planId, updatedAt };
    await upsertPlan(client, userResult.userId, snapshot);

    for (const operation of snapshot.operations) {
      await upsertOperation(client, userResult.userId, { ...operation, planId });
    }
    for (const review of snapshot.reviews) {
      await upsertReview(client, userResult.userId, { ...review, planId });
    }

    await client.query(
      `delete from plan_reviews
       where plan_id = $1 and user_id = $2 and not (id = any($3::text[]))`,
      [planId, userResult.userId, reviewIds]
    );
    await client.query(
      `delete from trade_operations
       where plan_id = $1 and user_id = $2 and not (id = any($3::text[]))`,
      [planId, userResult.userId, operationIds]
    );

    const planResult = await client.query<PlanRow>(
      `select id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at
       from trade_plans where id = $1 and user_id = $2`,
      [planId, userResult.userId]
    );
    const operationResult = await client.query<OperationRow>(
      `select id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
              total_amount, take_profit_price, stop_loss_price, decision_reason,
              psychology_note, emotion_tags, strategy_tags, source, created_at, updated_at
       from trade_operations where plan_id = $1 and user_id = $2 order by trade_time desc`,
      [planId, userResult.userId]
    );
    const reviewResult = await client.query<ReviewRow>(
      `select id, plan_id, review_time, operation_ids, realized_result, profit_loss,
              violated_rules, review_note, emotion_tags, created_at, updated_at
       from plan_reviews where plan_id = $1 and user_id = $2 order by review_time desc`,
      [planId, userResult.userId]
    );

    await client.query("commit");
    return {
      ok: true,
      storage: "postgres",
      data: mapPlanRow(
        planResult.rows[0],
        operationResult.rows.map(mapOperationRow),
        reviewResult.rows.map(mapReviewRow)
      )
    };
  } catch (error) {
    if (client) await client.query("rollback");
    console.error("Failed to replace plan snapshot.", error);
    return databaseError("计划修改失败，数据库事务已全部回滚，请重试。");
  } finally {
    client?.release();
  }
}

export async function importLocalTradeData(
  plans: TradePlan[],
  auditReports: AuditReport[]
): Promise<ImportLocalDataResult> {
  const userResult = getConfiguredUserId();

  if (!userResult.ok) {
    return userResult;
  }

  const validationMessage = validateImportData(plans, auditReports);
  if (validationMessage) {
    return { ok: false, storage: "validation", message: validationMessage };
  }

  let client: PoolClient | null = null;

  try {
    client = await getDatabasePool().connect();
    await client.query("begin");

    let operationCount = 0;
    let reviewCount = 0;

    for (const plan of plans) {
      await upsertPlan(client, userResult.userId, plan);

      for (const operation of plan.operations) {
        await upsertOperation(client, userResult.userId, operation);
        operationCount += 1;
      }

      for (const review of plan.reviews) {
        await upsertReview(client, userResult.userId, review);
        reviewCount += 1;
      }
    }

    for (const report of auditReports) {
      await upsertAuditReport(client, userResult.userId, report);
    }

    await client.query("commit");

    return {
      ok: true,
      storage: "postgres",
      imported: {
        plans: plans.length,
        operations: operationCount,
        reviews: reviewCount,
        auditReports: auditReports.length
      }
    };
  } catch (error) {
    if (client) {
      await client.query("rollback");
    }

    console.error("Failed to import local trade data.", error);

    return {
      ok: false,
      storage: "error",
      message: "本地数据上传失败，数据库事务已全部回滚，请查看服务日志定位原因。"
    };
  } finally {
    client?.release();
  }
}

function validateImportData(plans: TradePlan[], auditReports: AuditReport[]) {
  for (const plan of plans) {
    const parsedPlan = parseCreatePlanInput(plan);
    if (!parsedPlan.ok) {
      return `计划“${plan.title || plan.id}”不符合当前规则：${formatImportErrors(parsedPlan.errors)}`;
    }

    for (const operation of plan.operations) {
      const parsedOperation = parseCreateOperationInput(operation);
      if (!parsedOperation.ok) {
        return `计划“${plan.title}”中的操作“${operation.id}”不符合当前规则：${formatImportErrors(parsedOperation.errors)}`;
      }
    }

    for (const review of plan.reviews) {
      const parsedReview = parseCreateReviewInput(review);
      if (!parsedReview.ok) {
        return `计划“${plan.title}”中的复盘“${review.id}”不符合当前规则：${formatImportErrors(parsedReview.errors)}`;
      }
    }
  }

  for (const report of auditReports) {
    const parsedReport = parseAuditReportInput(report);
    if (!parsedReport.ok) {
      return `审计归档“${report.title || report.id}”不符合当前规则：${formatImportErrors(parsedReport.errors)}`;
    }
  }

  return null;
}

function validatePlanSnapshot(planId: string, plan: TradePlan) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.operations) || !Array.isArray(plan.reviews)) {
    return "计划快照必须包含操作和复盘数组。";
  }
  if (plan.id !== planId) return "计划 ID 与请求地址不一致。";

  const validationMessage = validateImportData([plan], []);
  if (validationMessage) return validationMessage;

  const operationIds = plan.operations.map((operation) => operation.id);
  const reviewIds = plan.reviews.map((review) => review.id);
  if (new Set(operationIds).size !== operationIds.length) return "计划中存在重复的操作 ID。";
  if (new Set(reviewIds).size !== reviewIds.length) return "计划中存在重复的复盘 ID。";
  if (plan.operations.some((operation) => operation.planId !== planId)) return "操作记录挂靠了错误的计划。";
  if (plan.reviews.some((review) => review.planId !== planId)) return "复盘记录挂靠了错误的计划。";

  const operationIdSet = new Set(operationIds);
  if (plan.reviews.some((review) => review.operationIds?.some((id) => !operationIdSet.has(id)))) {
    return "复盘关联了当前计划中不存在的操作。";
  }

  return null;
}

async function assertSnapshotChildOwnership(
  client: PoolClient,
  userId: string,
  planId: string,
  operationIds: string[],
  reviewIds: string[]
) {
  const operationConflict = await client.query<{ id: string }>(
    `select id from trade_operations
     where id = any($1::text[]) and (user_id <> $2 or plan_id <> $3) limit 1`,
    [operationIds, userId, planId]
  );
  const reviewConflict = await client.query<{ id: string }>(
    `select id from plan_reviews
     where id = any($1::text[]) and (user_id <> $2 or plan_id <> $3) limit 1`,
    [reviewIds, userId, planId]
  );

  if (operationConflict.rowCount || reviewConflict.rowCount) {
    throw new Error("Snapshot child id belongs to another plan.");
  }
}

function formatImportErrors(errors: string[]) {
  const messages: Record<string, string> = {
    "title is required.": "计划名称不能为空",
    "assetName is required.": "标的名称不能为空",
    "thesis is required.": "计划假设不能为空",
    "price is required.": "价格不能为空",
    "decisionReason is required.": "操作理由不能为空",
    "reviewNote is required.": "复盘内容不能为空",
    "buy/sell operation requires quantity and quantityUnit.": "买入或卖出必须填写数量和数量单位",
    "shares operation requires totalAmount.": "股数模式必须填写总金额",
    "units operation totalAmount must equal quantity.": "份额模式的总金额必须等于份额",
    "observe operation cannot include quantity, quantityUnit, or totalAmount.": "观察操作不能包含数量、数量单位或总金额"
  };

  return errors.map((error) => messages[error] ?? `字段校验失败（${error}）`).join("；");
}

async function ensurePlanBelongsToUser(planId: string, userId: string) {
  const result = await getDatabasePool().query<{ id: string }>(
    `select id from trade_plans where id = $1 and user_id = $2 limit 1`,
    [planId, userId]
  );

  return result.rowCount === 1;
}

async function touchPlan(planId: string, userId: string) {
  await getDatabasePool().query(`update trade_plans set updated_at = now() where id = $1 and user_id = $2`, [
    planId,
    userId
  ]);
}

async function loadPlanChildren(planId: string, userId: string) {
  const pool = getDatabasePool();
  const [operationResult, reviewResult] = await Promise.all([
    pool.query<OperationRow>(
      `select id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
              total_amount, take_profit_price, stop_loss_price, decision_reason,
              psychology_note, emotion_tags, strategy_tags, source, created_at, updated_at
       from trade_operations where plan_id = $1 and user_id = $2 order by trade_time desc`,
      [planId, userId]
    ),
    pool.query<ReviewRow>(
      `select id, plan_id, review_time, operation_ids, realized_result, profit_loss,
              violated_rules, review_note, emotion_tags, created_at, updated_at
       from plan_reviews where plan_id = $1 and user_id = $2 order by review_time desc`,
      [planId, userId]
    )
  ]);

  return {
    operations: operationResult.rows.map(mapOperationRow),
    reviews: reviewResult.rows.map(mapReviewRow)
  };
}

function notFound(message: string): MutationResult<never> {
  return { ok: false, storage: "not-found", message };
}

function databaseError(message: string): MutationResult<never> {
  return { ok: false, storage: "error", message };
}

async function upsertPlan(client: PoolClient, userId: string, plan: TradePlan) {
  await client.query(
    `insert into trade_plans (
        id, user_id, title, asset_name, ticker, market, currency, status, thesis, created_at, updated_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (id) do update set
       title = excluded.title,
       asset_name = excluded.asset_name,
       ticker = excluded.ticker,
       market = excluded.market,
       currency = excluded.currency,
       status = excluded.status,
       thesis = excluded.thesis,
       updated_at = excluded.updated_at
     where trade_plans.user_id = excluded.user_id`,
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
}

async function upsertOperation(client: PoolClient, userId: string, operation: TradeOperation) {
  await client.query(
    `insert into trade_operations (
        id, user_id, plan_id, action, trade_time, currency, price, quantity, quantity_unit,
        total_amount, take_profit_price, stop_loss_price, decision_reason, psychology_note,
        emotion_tags, strategy_tags, source, created_at, updated_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     on conflict (id) do update set
       action = excluded.action,
       trade_time = excluded.trade_time,
       currency = excluded.currency,
       price = excluded.price,
       quantity = excluded.quantity,
       quantity_unit = excluded.quantity_unit,
       total_amount = excluded.total_amount,
       take_profit_price = excluded.take_profit_price,
       stop_loss_price = excluded.stop_loss_price,
       decision_reason = excluded.decision_reason,
       psychology_note = excluded.psychology_note,
       emotion_tags = excluded.emotion_tags,
       strategy_tags = excluded.strategy_tags,
       source = excluded.source,
       updated_at = excluded.updated_at
     where trade_operations.user_id = excluded.user_id`,
    [
      operation.id,
      userId,
      operation.planId,
      operation.action,
      operation.tradeTime,
      operation.currency,
      operation.price,
      operation.quantity,
      operation.quantityUnit,
      operation.totalAmount,
      operation.takeProfitPrice,
      operation.stopLossPrice,
      operation.decisionReason,
      operation.psychologyNote,
      operation.emotionTags,
      operation.strategyTags,
      operation.source,
      operation.createdAt,
      operation.updatedAt
    ]
  );
}

async function upsertReview(client: PoolClient, userId: string, review: PlanReview) {
  await client.query(
    `insert into plan_reviews (
        id, user_id, plan_id, review_time, operation_ids, realized_result, profit_loss,
        violated_rules, review_note, emotion_tags, created_at, updated_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (id) do update set
       review_time = excluded.review_time,
       operation_ids = excluded.operation_ids,
       realized_result = excluded.realized_result,
       profit_loss = excluded.profit_loss,
       violated_rules = excluded.violated_rules,
       review_note = excluded.review_note,
       emotion_tags = excluded.emotion_tags,
       updated_at = excluded.updated_at
     where plan_reviews.user_id = excluded.user_id`,
    [
      review.id,
      userId,
      review.planId,
      review.reviewTime,
      review.operationIds ?? [],
      review.realizedResult,
      review.profitLoss,
      review.violatedRules,
      review.reviewNote,
      review.emotionTags,
      review.createdAt,
      review.updatedAt
    ]
  );
}

async function upsertAuditReport(client: PoolClient, userId: string, report: AuditReport) {
  await client.query(
    `insert into audit_reports (
        id, user_id, period_start, period_end, title, summary, signal_label, signal_level,
        metrics, ai_input_digest, findings, review_questions, source, generation, created_at
     )
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     on conflict (id) do update set
       period_start = excluded.period_start,
       period_end = excluded.period_end,
       title = excluded.title,
       summary = excluded.summary,
       signal_label = excluded.signal_label,
       signal_level = excluded.signal_level,
       metrics = excluded.metrics,
       ai_input_digest = excluded.ai_input_digest,
       findings = excluded.findings,
       review_questions = excluded.review_questions,
       source = excluded.source,
       generation = excluded.generation
     where audit_reports.user_id = excluded.user_id`,
    [
      report.id,
      userId,
      report.periodStart,
      report.periodEnd,
      report.title,
      report.summary,
      report.signalLabel,
      report.signalLevel,
      JSON.stringify(report.metrics),
      report.aiInputDigest,
      report.findings,
      report.reviewQuestions,
      report.generation?.source ?? "legacy",
      JSON.stringify(
        report.generation ?? { source: "legacy", provider: "unknown", promptVersion: "unknown", status: "legacy" }
      ),
      report.createdAt
    ]
  );
}

function mapPlanRow(row: PlanRow, operations: TradeOperation[], reviews: PlanReview[]): TradePlan {
  return {
    id: row.id,
    title: row.title,
    assetName: row.asset_name,
    ticker: row.ticker,
    market: row.market,
    currency: row.currency,
    status: row.status,
    thesis: row.thesis,
    operations,
    reviews,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapOperationRow(row: OperationRow): TradeOperation {
  return {
    id: row.id,
    planId: row.plan_id,
    action: row.action,
    tradeTime: toIsoString(row.trade_time),
    currency: row.currency,
    price: toOptionalNumber(row.price),
    quantity: toOptionalNumber(row.quantity),
    quantityUnit: row.quantity_unit ?? undefined,
    totalAmount: toOptionalNumber(row.total_amount),
    takeProfitPrice: toOptionalNumber(row.take_profit_price),
    stopLossPrice: toOptionalNumber(row.stop_loss_price),
    decisionReason: row.decision_reason,
    psychologyNote: row.psychology_note ?? undefined,
    emotionTags: row.emotion_tags ?? [],
    strategyTags: row.strategy_tags ?? [],
    source: row.source,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function mapReviewRow(row: ReviewRow): PlanReview {
  return {
    id: row.id,
    planId: row.plan_id,
    reviewTime: toIsoString(row.review_time),
    operationIds: row.operation_ids ?? [],
    realizedResult: row.realized_result,
    profitLoss: toOptionalNumber(row.profit_loss),
    violatedRules: row.violated_rules ?? [],
    reviewNote: row.review_note,
    emotionTags: row.emotion_tags ?? [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  };
}

function groupByPlanId<T extends { planId: string }>(items: T[]) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    grouped.set(item.planId, [...(grouped.get(item.planId) ?? []), item]);
  }

  return grouped;
}

function toOptionalNumber(value: string | number | null) {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

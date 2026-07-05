# RationalTrade 后台设计

## 1. 设计目标

后台第一阶段不是重做一个复杂系统，而是把当前本地闭环平滑迁移到云端。

后台需要支持：

- 用户数据云端保存
- 多设备同步
- AI 审计在服务端生成
- 截图识别在服务端处理
- 本地数据可以上传到云端
- 导入导出仍然可用

后台不负责：

- 投资建议
- 股票推荐
- 实时行情
- 券商同步
- 真实收益计算
- 复杂资产管理

## 2. 分期命名

产品路线里已经有 Product Phase 1 / 2 / 3。

后台分期不要再叫 Phase 1，否则会和“Product Phase 1 已包含 AI 截图补账与 AI 审计”产生误解。

后台分期使用：

- Backend M0：本地闭环整理
- Backend M1：云端账户与核心数据
- Backend M2：AI 审计服务化
- Backend M3：截图识别服务化
- Backend M4：同步、导入导出和稳定性
- Backend M5：为产品后续阶段预留

## 3. Backend M0：本地闭环整理

当前已基本完成。

目标：

- H5 本地可用
- 计划、操作、复盘、审计归档本地保存
- JSON 导入导出包含 `plans` 和 `auditReports`
- `/api/audit` 已有 mock-local 占位
- `aiInputDigest` 已形成可传给 AI 的输入摘要

产物：

- `TradePlan`
- `TradeOperation`
- `PlanReview`
- `AuditReport`
- `TradeDataFile`
- `audit-ai-adapter`

不做：

- 登录
- Supabase
- 真实 AI
- 真实 OCR

## 4. Backend M1：云端账户与核心数据

目标：

- 引入 Supabase Auth
- 建立用户数据表
- 计划、操作、复盘、审计归档可以保存到云端
- 保留本地模式作为 fallback

建议表：

### profiles

- `id`
- `email`
- `display_name`
- `created_at`
- `updated_at`

### trade_plans

- `id`
- `user_id`
- `title`
- `asset_name`
- `ticker`
- `market`
- `currency`
- `status`
- `thesis`
- `created_at`
- `updated_at`

### trade_operations

- `id`
- `user_id`
- `plan_id`
- `action`
- `trade_time`
- `currency`
- `price`
- `quantity`
- `quantity_unit`
- `total_amount`
- `take_profit_price`
- `stop_loss_price`
- `decision_reason`
- `psychology_note`
- `emotion_tags`
- `strategy_tags`
- `source`
- `created_at`
- `updated_at`

### plan_reviews

- `id`
- `user_id`
- `plan_id`
- `review_time`
- `operation_ids`
- `realized_result`
- `profit_loss`
- `violated_rules`
- `review_note`
- `emotion_tags`
- `created_at`
- `updated_at`

### audit_reports

- `id`
- `user_id`
- `period_start`
- `period_end`
- `title`
- `summary`
- `signal_label`
- `signal_level`
- `metrics`
- `ai_input_digest`
- `findings`
- `review_questions`
- `source`
- `created_at`

权限：

- 所有用户数据表启用 RLS
- 用户只能读写自己的 `user_id`
- 前端只使用 anon key
- service role 只能在服务端使用

## 5. Backend M2：AI 审计服务化

目标：

- `/api/audit` 从 mock-local 切换为真实 AI 可选
- 服务端组装 prompt
- AI 返回结构必须校验
- 返回结构仍然是 `AuditReport`

输入：

- `plans`
- `operations`
- `reviews`
- `aiInputDigest`

输出：

- `summary`
- `findings`
- `reviewQuestions`
- `signalLabel`
- `signalLevel`

原则：

- AI 只做行为复盘
- 不预测涨跌
- 不推荐买卖
- 不生成目标价
- 不替用户做决策

失败策略：

- AI 失败时回退本地规则报告
- 前端不应空白
- 错误不写入 `audit_reports`

## 6. Backend M3：截图识别服务化

目标：

- 当前 Mock 截图补账替换为真实上传和识别
- 上传截图到 Supabase Storage
- 服务端 OCR/视觉模型识别
- 用户逐条确认后才归档为 `TradeOperation`

建议表：

### recognition_jobs

- `id`
- `user_id`
- `status`
- `source_image_path`
- `raw_result`
- `recognized_items`
- `created_at`
- `updated_at`

流程：

上传截图
↓
创建 recognition job
↓
服务端识别
↓
前端展示识别结果
↓
用户逐条确认
↓
写入 `trade_operations`

不允许：

- 识别结果自动入库
- 前端直接调用 AI/OCR
- 把截图公开访问

## 7. Backend M4：同步、导入导出和稳定性

目标：

- 本地数据可以上传到云端
- 云端数据可以导出为 JSON
- 导入 JSON 可以写入云端
- 多设备同步的冲突策略明确

建议策略：

- 以 `updated_at` 判断新旧
- 删除动作显式执行，不用隐式覆盖
- 导入前提示会替换或合并
- 第一版优先做“替换式导入”，不做复杂 merge

API：

- `GET /api/export`
- `POST /api/import`
- `POST /api/local-to-cloud`

## 8. Backend M5：为后续产品阶段预留

为 Product Phase 2 / 3 预留，但不提前实现。

可能新增：

- `trading_rules`
- `rule_check_results`
- `chart_annotations`
- `market_snapshots`
- `audit_windows`

现在只预留数据模型方向，不写功能。

## 9. 最小 API 规划

### Plans

- `GET /api/plans`
- `POST /api/plans`
- `PATCH /api/plans/:id`
- `DELETE /api/plans/:id`

### Operations

- `POST /api/operations`
- `PATCH /api/operations/:id`
- `DELETE /api/operations/:id`

### Reviews

- `POST /api/reviews`
- `PATCH /api/reviews/:id`
- `DELETE /api/reviews/:id`

### Audit

- `POST /api/audit`
- `POST /api/audit/archive`
- `GET /api/audit/reports`
- `DELETE /api/audit/reports/:id`

### Recognition

- `POST /api/recognition/jobs`
- `GET /api/recognition/jobs/:id`
- `POST /api/recognition/jobs/:id/confirm`

## 10. 开发顺序

推荐顺序：

1. 写 Supabase schema 和 RLS SQL
2. 建本地 repository / cloud repository 抽象
3. 云端读写 plans
4. 云端读写 operations 和 reviews
5. 云端读写 auditReports
6. 本地数据上传到云端
7. `/api/audit` 接真实 AI
8. 截图上传和 recognition jobs
9. 导入导出云端化
10. 做完整回归

## 11. 关键风险

- 过早做复杂同步会拖慢 MVP
- AI 输出不稳定，需要结构校验
- 本地数据迁移要谨慎，不能让用户丢数据
- service role 不能暴露给前端
- 删除和清空动作必须二次确认

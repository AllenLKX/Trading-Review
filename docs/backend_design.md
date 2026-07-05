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

## 1.1 部署环境约束

实际服务器选用腾讯云云服务器，Ubuntu 环境。

因此后台实现优先按“自部署 Next.js 服务 + 自管理数据库/对象存储”的方式设计，而不是默认依赖平台托管。

推荐生产形态：

- 腾讯云 CVM：运行 Next.js H5 和 API
- Ubuntu：服务器操作系统
- Nginx：HTTPS、反向代理、静态资源缓存
- Node.js LTS：运行 Next.js
- pnpm：依赖管理
- PM2 或 systemd：进程守护
- PostgreSQL：业务数据库，可先同机部署，后续再迁移到腾讯云数据库
- 腾讯云 COS：后续存储截图原图
- 服务端环境变量：保存数据库连接、AI Key、COS Key

不建议第一版就引入复杂容器编排。

Docker 可以作为后续选项，但 Backend M1 第一轮可以先用普通 Node.js + PM2 部署，降低运维复杂度。

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

- 引入账户体系
- 建立用户数据表
- 计划、操作、复盘、审计归档可以保存到云端
- 保留本地模式作为 fallback

腾讯云 Ubuntu 自部署下，账户体系有两种选择：

### 方案 A：自建 NextAuth/Auth.js

适合当前腾讯云自部署。

优点：

- 服务端完全在腾讯云
- 不依赖 Supabase Auth
- 未来可接邮箱、微信、GitHub 等登录

代价：

- 需要自己维护 session、用户表和登录流程

### 方案 B：继续使用 Supabase Auth + 自部署业务服务

适合想快速获得登录能力，但数据服务仍跑腾讯云。

优点：

- 登录和 JWT 能力成熟
- 开发速度快

代价：

- 认证依赖外部服务
- 和腾讯云自部署架构会多一层外部依赖

建议：

Backend M1 第一版优先选方案 A，但可以先只做单用户登录或管理口令，等产品形态稳定后再扩展正式账号体系。

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

- 所有表都保留 `user_id`
- 所有 API 都在服务端校验当前用户
- 前端不能直接连接数据库
- 数据库连接字符串只能存在服务端环境变量
- AI Key 和 COS Key 只能存在服务端环境变量

如果后续改用 Supabase，则再启用 RLS；腾讯云自部署第一版主要依赖 API 层权限控制。

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
- 上传截图到腾讯云 COS
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

截图访问策略：

- COS Bucket 默认私有
- 前端上传走服务端签名或服务端中转
- 前端查看截图使用短期签名 URL
- 不把永久公开 URL 写入业务表

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

1. 写 PostgreSQL schema SQL
2. 确认腾讯云 Ubuntu 基础环境
3. 建本地 repository / cloud repository 抽象
4. 云端读写 plans
5. 云端读写 operations 和 reviews
6. 云端读写 auditReports
7. 本地数据上传到云端
8. `/api/audit` 接真实 AI
9. 截图上传到 COS 和 recognition jobs
10. 导入导出云端化
11. 做完整回归

## 10.1 什么时候上传到腾讯云

不要现在立刻上传当前本地版。

建议上传时机：

### 第一次上传：Backend M1 骨架完成后

满足条件：

- 已有生产环境配置文档
- 已有 `.env.production` 所需变量清单
- Next.js 可以 `pnpm build`
- Ubuntu 上 Node.js、pnpm、Nginx、PM2 已就绪
- 至少有一个 `/api/health` 或同等健康检查接口

目的：

- 验证服务器能跑 Next.js
- 验证 HTTPS、域名、Nginx、PM2
- 不急着迁移真实用户数据

### 第二次上传：云端 plans 读写完成后

满足条件：

- 数据库 schema 已建好
- 计划列表可以从云端读取
- 创建/编辑/删除计划可以云端保存
- 本地 fallback 不被破坏

目的：

- 验证真实云端数据链路

### 第三次上传：operations/reviews/auditReports 完成后

满足条件：

- 操作和复盘云端保存
- 审计归档云端保存
- 导入导出仍可用

目的：

- 做第一轮完整云端回归

### 第四次上传：真实 AI 或截图识别接入后

满足条件：

- 服务端 AI Key 配置完成
- AI 返回结构校验完成
- 失败 fallback 可用
- 截图上传不公开暴露

目的：

- 验证生产环境 AI/OCR 调用链路

## 10.2 怎么上传到腾讯云 Ubuntu

推荐发布方式：

### 方式 A：服务器 git pull 部署

适合当前阶段。

流程：

1. 本地开发并提交到 GitHub
2. 本地推送分支
3. SSH 登录腾讯云 Ubuntu
4. 服务器拉取代码
5. 安装依赖
6. 构建
7. 重启进程

示例命令：

```bash
ssh ubuntu@SERVER_IP
cd /var/www/rationaltrade
git pull origin main
pnpm install --frozen-lockfile
pnpm build
pm2 restart rationaltrade
```

第一轮可以先部署测试分支，确认稳定后再切 main。

### 方式 B：GitHub Actions 自动部署

适合后台稳定后。

流程：

1. push 到 main
2. GitHub Actions SSH 到腾讯云
3. 执行拉取、构建、重启

优点：

- 少手工操作
- 发布过程可追踪

代价：

- 需要配置 GitHub Secrets
- 需要先把手工部署跑通

建议先用方式 A，跑通后再做方式 B。

## 10.3 后续改动如何本地验证再发布

每次发布前本地必须完成：

```bash
pnpm typecheck
pnpm build
pnpm dev --hostname 0.0.0.0
```

H5 回归：

- 创建计划
- 添加操作
- 添加复盘
- 截图补账 Mock 确认归档
- 历史计划详情
- 刷新审计
- 归档审计
- 删除/清空动作必须出现确认
- 导出 JSON
- 导入 JSON
- 手机宽度无横向溢出

API 回归：

- `/api/audit` 返回 `AuditReport`
- 后续新增 `/api/health` 后，确认返回 OK
- 后续云端 API 完成后，逐个确认增删改查

发布步骤：

1. 本地验证通过
2. commit
3. push 到 GitHub
4. 腾讯云服务器拉取代码
5. `pnpm install --frozen-lockfile`
6. `pnpm build`
7. 重启 PM2/systemd
8. 浏览器访问生产域名
9. 做一轮最小冒烟测试

回滚策略：

- 每次发布前记录当前 commit
- 出问题时服务器执行 `git checkout <last-good-commit>`
- 重新 `pnpm build`
- 重启服务

## 11. 关键风险

- 过早做复杂同步会拖慢 MVP
- AI 输出不稳定，需要结构校验
- 本地数据迁移要谨慎，不能让用户丢数据
- 数据库、AI、COS 密钥不能暴露给前端
- 删除和清空动作必须二次确认
- 生产服务器需要 HTTPS
- 腾讯云安全组只开放必要端口：80、443、SSH

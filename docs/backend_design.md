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

实际服务器为腾讯云新加坡区云服务器，公网 IP `43.156.228.145`，当前系统是 OpenCloudOS 9.4；正式域名为 `rationaltrade.cn`。

因此后台实现优先按“自部署 Next.js 服务 + 自管理数据库/对象存储”的方式设计，而不是默认依赖平台托管。

推荐生产形态：

- 腾讯云 CVM：运行 Next.js H5 和 API
- OpenCloudOS 9.4：当前服务器操作系统
- Nginx：HTTPS、反向代理、静态资源缓存
- Node.js LTS：运行 Next.js
- pnpm：依赖管理
- PM2 或 systemd：进程守护
- PostgreSQL 15：当前已同机部署，后续可迁移到腾讯云数据库
- 腾讯云 COS：后续存储截图原图
- 服务端环境变量：保存数据库连接、AI Key、COS Key

Next.js 生产进程和 PostgreSQL 均只监听回环地址，公网安全组不开放 3000、5432 端口；所有 H5 与 API 流量统一经过 Nginx。

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
- 浏览器缓存只作为读取失败时的只读 fallback

腾讯云自部署下，账户体系有两种选择：

### 方案 A：自建邮箱密码会话（当前采用）

适合当前腾讯云自部署。

优点：

- 服务端完全在腾讯云
- 不依赖 Supabase Auth
- 当前邮箱密码与数据完全在腾讯云，未来可在同一用户表上增加微信、GitHub 等身份

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

当前已落地方案 A 的邮箱密码、数据库会话和用户隔离；暂不增加第三方身份、邮箱验证或密码找回。

当前代码状态：

- 已新增 `database/schema.sql` 作为 PostgreSQL 初始结构。
- 已新增 `.env.example` 作为环境变量模板。
- 已新增 `/api/system/status` 用于检查服务端配置状态。
- 已新增服务端数据库连接边界；数据库未配置时 H5 可显示最近成功缓存，但正式写操作不可降级为本地保存。
- 已新增 `/api/plans` 只读列表接口，作为云端计划数据 API 的第一步。
- 已新增 `POST /api/plans`、`POST /api/plans/:planId/operations`、`POST /api/plans/:planId/reviews`，用于云端写入骨架。
- 已新增计划、操作、复盘的 `PATCH` 和 `DELETE` 接口，核心数据具备完整 CRUD。
- `PATCH` 当前接收完整的可编辑字段，统一复用创建校验，避免局部更新产生非法数据组合。
- 所有 `DELETE` 请求必须携带 `X-Confirm-Delete: true`，前端仍需先展示二次确认。
- 已新增 `POST /api/sync/import-local`，用于把本地导出的 JSON 批量导入云端。
- 已新增 `POST /api/audit/archive`、`GET /api/audit/reports` 和 `DELETE /api/audit/reports/:id`。
- 云端审计归档最多按创建时间读取近期 20 条，删除同样要求显式确认请求头。
- 前端已封装计划、操作和复盘的完整云端 CRUD adapter。
- H5 启动时直接读取当前用户的服务端数据，读取失败时明确显示缓存状态和重试入口。
- 创建计划、操作和复盘时可保留客户端生成的 ID 与时间戳，方便离线工作副本重试并保持关联稳定。
- 创建接口按同一用户和客户端 ID 幂等 upsert，删除 adapter 把已不存在视为删除目标已达成。
- H5 不提供本地/云端模式。所有核心写操作等待 PostgreSQL API 成功后再更新界面，失败时保留原数据和表单内容。
- `POST /api/sync/import-local` 保留为首次迁移和运维工具，不在正式用户界面展示。
- 计划详情编辑使用 `PUT /api/plans/:planId/snapshot`，计划基础信息、操作和复盘在同一 PostgreSQL 事务中替换，任一校验或写入失败会整体回滚。
- middleware 在迁移完成后使用签名会话 Cookie；Basic Auth 只作为 owner 初始化前的临时回退模式。
- 正式公网入口为 `https://rationaltrade.cn`；健康检查与 PWA 静态资源公开，业务页面和 API 要求有效会话。
- 已新增服务端输入校验模块，先不用第三方校验库，减少 Backend M1 早期依赖面。
- `.env.production`、`.env.local` 等真实配置文件不提交到 GitHub。
- 初始 schema 只定义结构和约束，不包含任何真实用户数据、token、AI Key 或 COS Key。

生产迁移时 `RATIONALTRADE_SINGLE_USER_ID` 只用于把原有数据绑定到 owner 账号。切换 session 模式后，API 从已验证、未撤销的会话读取用户 ID，不允许客户端指定或跨用户查询。

公网入口约束：

- `rationaltrade.cn` 和 `www.rationaltrade.cn` 解析到腾讯云公网 IP，Nginx 按 Host 与原有 OpenClaw 共存。
- 页面与 API 保持同源，前端继续请求相对路径 `/api/*`；浏览器和未来 WebView 套壳不需要额外 API 域名。
- 公网只开放 Nginx 的 80/443 端口；Next.js 3000 和 PostgreSQL 5432 只允许本机或内网访问。
- HTTP 只用于证书签发与跳转，正式业务统一使用 HTTPS。
- SSH 22 面向动态公网 IP 保持可达，但只允许密钥认证；公网禁止 root 密码登录，腾讯云控制台保留密码救援通道。
- 正式账号使用邮箱、scrypt 密码哈希、签名 HttpOnly Cookie 和 PostgreSQL 可撤销会话；middleware 只接受签名会话，业务仓储再次校验会话仍有效。
- `app_events` 记录最小化运营事件，用于服务器按日查询 PV、UV、业务流水和 AI token，不保存交易正文或认证秘密。

ID 设计：

- 主键和外键使用 `text`，数据库默认生成 UUID 字符串。
- 这样既兼容未来正式账号体系，也兼容当前本地存储里的 `plan-...`、`operation-...`、`review-...` 等字符串 ID。
- 本地数据上传云端时可以保留原始 ID，避免复盘关联的 `operationIds` 断裂。

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

### trading_rules

- `id`
- `user_id`
- `title`
- `description`
- `is_active`
- `created_at`
- `updated_at`

说明：

Backend M1 只预留数据表，不在 H5 第一轮实现完整军规管理。

### ai_reviews

- `id`
- `user_id`
- `plan_id`
- `operation_id`
- `review_id`
- `audit_report_id`
- `summary`
- `findings`
- `questions`
- `source`
- `created_at`

说明：

Backend M1 只预留单笔 AI 复盘结果表，不在第一轮接真实 AI。

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

当前实现状态：

- 已接入 DeepSeek OpenAI 格式的 `/chat/completions`，默认模型为 `deepseek-v4-flash`。
- 只把规则层生成的 `aiInputDigest` 发给模型，不发送数据库连接或服务端密钥。
- 使用 JSON Output 并关闭思考模式，模型只生成叙述字段；周期、指标、时间和输入摘要仍由本地规则确定。
- 对枚举、数组数量、文本长度和禁止投资建议进行服务端校验；空内容、截断、超时、非 2xx 或非法输出都回退本地报告。
- 计划变化时只自动更新免费本地指标，只有用户明确点击“AI 分析”才请求 DeepSeek，避免隐性 Token 消耗。
- 密钥使用 `DEEPSEEK_API_KEY`，兼容早期环境中的 `AI_API_KEY`，只允许保存在本地或服务器环境变量中。
- `docs/prompts/audit_system.md` 和 `audit_user.md` 是 Prompt 唯一来源，服务端通过 `lib/server/audit-prompts.ts` 读取并注入审计 JSON。
- 开发环境每次请求读取 Prompt，方便修改验证；生产环境首次读取后缓存，避免重复磁盘 IO。
- Next.js 文件追踪显式包含 `docs/prompts/*.md`，未来使用精简部署产物时也不会遗漏 Prompt。
- `audit_reports.generation` 使用 JSONB 保存来源、provider、model、promptVersion、成功/回退状态和回退原因；旧归档自动标记为 legacy。

## 6. Backend M3：截图识别服务化

当前第一版：

- `/api/recognitions` 接收受登录保护的图片上传，限制格式和 7.5MB 体积。
- Kimi K3 通过腾讯 TokenHub 接收原图，按视觉顺序忠实转写明细行；DeepSeek 只接收转写结果并输出交易 JSON。
- 服务端校验方向、币种、时间、价格、数量和条数；无法确认的证券代码保持空白，不允许模型猜测。
- 原图仅在单次请求内存中处理，不上传 COS、不写数据库。
- 用户逐条确认后才归档为 `TradeOperation`；没有匹配计划时才自动创建计划。
- `ai_screenshot_recognized` 分别记录 Kimi 识图和 DeepSeek 结构化的模型、Prompt 版本、token 与总耗时，不记录转写正文、原图或交易明细。

当前不创建 `recognition_jobs`。只有出现长任务、失败重试、历史识别追溯或多页批处理需求时再引入以下异步模型：

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

未来异步流程：

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

当前已完成第一层可靠性能力：

- PostgreSQL 是正式写入源，H5 等待写请求成功后才更新界面。
- localStorage 只缓存最近一次成功读取或写入的数据。
- 保存失败时保留表单、编辑态和页面原数据。
- 客户端 ID 的幂等创建与确认删除支持网络错误后的安全重试。
- 运维批量导入使用事务和服务端校验。

当前限制：

- 批量导入采用 upsert，不把“导入包缺少某条记录”解释为云端删除。
- 当前不是多设备实时协作；正式多设备并发仍需版本号或 ETag。

建议策略：

- 以 `updated_at` 判断新旧
- 删除动作显式执行，不用隐式覆盖
- 导入前提示会替换或合并
- 当前优先采用保留双方记录的基础合并，避免隐式删除

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

当前已完成审计归档 API。`POST /api/audit` 仍负责生成审计内容，归档 API 只保存用户明确归档的快照，两者职责分开。

### Recognition

- `POST /api/recognition/jobs`
- `GET /api/recognition/jobs/:id`
- `POST /api/recognition/jobs/:id/confirm`

## 10. 开发顺序

推荐顺序：

1. 写 PostgreSQL schema SQL
2. 确认腾讯云 OpenCloudOS 基础环境
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
- 已有 `/api/health` 健康检查接口

目的：

- 验证服务器能跑 Next.js
- 验证 HTTPS、域名、Nginx、PM2
- 不急着迁移真实用户数据

### 第二次上传：云端 plans 读写完成后

满足条件：

- 数据库 schema 已建好
- 计划列表可以从云端读取
- 创建/编辑/删除计划可以云端保存
- 服务端失败时只读缓存提示不被破坏

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

## 10.2 怎么上传到腾讯云服务器

推荐发布方式：

### 方式 A：服务器 git pull 部署

适合当前阶段。

流程：

1. 本地开发并提交到 GitHub
2. 本地推送分支
3. SSH 登录腾讯云服务器
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
- 截图补账真实上传、AI 识别和确认归档
- 历史计划详情
- 刷新审计
- 归档审计
- 删除/清空动作必须出现确认
- 导出 JSON
- 数据库不可用时显示缓存状态，所有写操作不应伪成功
- 手机宽度无横向溢出

API 回归：

- `/api/audit` 返回 `AuditReport`
- `/api/health` 返回 OK
- `/api/system/status` 只返回配置状态，不暴露 token、数据库连接字符串或 COS Secret
- `/api/system/status?db=1` 在配置数据库后可检查 PostgreSQL 连接
- `/api/plans` 未配置数据库时返回空数组；配置数据库和单用户 ID 后返回云端计划列表
- `POST /api/plans` 可创建云端计划
- `POST /api/plans/:planId/operations` 可给计划追加云端操作
- `POST /api/plans/:planId/reviews` 可给计划追加云端复盘
- `POST /api/sync/import-local` 可把本地导出的 JSON 批量导入云端，且保留原始 ID
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

## 10.4 服务器性能不够时如何迁移

迁移目标是：

- 应用代码可以重新部署
- 数据库可以备份恢复
- 截图文件不绑死在旧服务器
- 域名可以切换到新服务器
- 旧服务器保留一段时间作为回滚

### 优先级 1：同一台服务器直接升级

如果只是 CPU、内存不够，优先看腾讯云是否支持当前 CVM 升配。

适合：

- 数据量还小
- 只是构建慢或运行内存偏紧
- 不想迁移 IP 和环境

流程：

1. 在腾讯云控制台创建快照或镜像
2. 停机升配 CPU/内存
3. 启动后检查 Nginx、PM2、PostgreSQL
4. 访问生产域名做冒烟测试

优点：

- 最简单
- 不需要迁移数据库
- 域名和部署目录基本不变

### 优先级 2：购买新 CVM 后迁移应用和数据库

适合：

- 当前机器规格太低
- 需要换系统盘、地域、可用区
- 希望用一台新机器重新整理环境

迁移前准备：

- 确认当前线上 commit
- 备份 `.env.production`
- 备份 PostgreSQL
- 记录 Nginx 配置
- 记录 PM2 进程名
- 确认 COS 文件不在本地磁盘

数据库备份：

```bash
pg_dump "$DATABASE_URL" > rationaltrade_backup_$(date +%Y%m%d_%H%M%S).sql
```

新服务器恢复：

```bash
createdb rationaltrade
psql rationaltrade < rationaltrade_backup.sql
```

应用迁移：

```bash
ssh ubuntu@NEW_SERVER_IP
sudo mkdir -p /var/www/rationaltrade
sudo chown -R ubuntu:ubuntu /var/www/rationaltrade
cd /var/www/rationaltrade
git clone git@github.com:AllenLKX/Trading-Review.git .
git checkout main
pnpm install --frozen-lockfile
pnpm build
pm2 start pnpm --name rationaltrade -- start
```

Nginx 迁移：

- 复制旧服务器站点配置
- 修改 upstream 到新本地端口
- 重新申请或迁移 HTTPS 证书
- `nginx -t`
- reload Nginx

域名切换：

1. 新服务器完整部署
2. 用 `http://NEW_SERVER_IP` 或临时域名验证
3. 修改 DNS A 记录指向新服务器 IP
4. 保留旧服务器至少 24-72 小时

### 优先级 3：数据库拆出去

如果瓶颈主要来自数据库，或者希望后续迁移服务器更轻松，可以把 PostgreSQL 从 CVM 拆到独立数据库。

可选：

- 腾讯云数据库 PostgreSQL
- 自建独立 PostgreSQL CVM

优点：

- 应用服务器以后可以随时换
- 数据迁移频率降低
- 备份和监控更清晰

代价：

- 成本更高
- 网络和权限配置更复杂
- 需要管理数据库白名单或内网连接

### COS 不随 CVM 迁移

截图文件后续应放腾讯云 COS，而不是服务器本地磁盘。

迁移服务器时只迁移：

- 应用代码
- 环境变量
- 数据库
- Nginx/PM2 配置

不迁移：

- 截图文件本体

数据库里只保存 COS object key，不保存本地路径。

### 迁移后的验证清单

- 生产域名可访问
- `/api/health` 返回 OK
- `/api/audit` 返回正常
- 登录状态正常
- 计划列表可读
- 创建计划可写
- 添加操作和复盘可写
- 审计归档可写
- 导出 JSON 正常
- 截图上传和读取正常
- Nginx HTTPS 正常
- PM2 重启后服务自动恢复

### 回滚策略

迁移完成后不要立刻释放旧服务器。

保留旧服务器 24-72 小时。

如果新服务器异常：

1. DNS A 记录切回旧服务器 IP
2. 停止新服务器写入
3. 对比迁移期间是否产生新数据
4. 必要时从新库导出增量再合并

为了降低回滚复杂度，正式切 DNS 前应尽量短时间冻结写入或选择低使用时段迁移。

## 11. 关键风险

- 过早做复杂同步会拖慢 MVP
- AI 输出不稳定，需要结构校验
- 本地数据迁移要谨慎，不能让用户丢数据
- 数据库、AI、COS 密钥不能暴露给前端
- 删除和清空动作必须二次确认
- 生产服务器需要 HTTPS
- 腾讯云安全组只开放必要端口：80、443、SSH

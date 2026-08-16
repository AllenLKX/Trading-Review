# RationalTrade 更新记录

## 2026-08-16

### 正式账号与轻量运营数据

- 新增符合现有移动端 UI 的邮箱密码注册、登录页面和退出入口；暂不发送验证邮件、不提供找回密码。
- 密码使用服务端 scrypt 加盐哈希，登录使用签名 HttpOnly Cookie，会话写入 PostgreSQL 并支持退出后立即撤销。
- 原单用户仓储改为从已验证会话获取 `user_id`，计划、操作、复盘和审计归档按账号隔离。
- 生产迁移保留 Basic Auth 开关，先在服务器终端静默初始化 owner 并绑定原有 8 个计划，再切换 session 模式，避免历史数据被公开注册账号接管。
- 新增 `app_events`，记录 PV、UV、注册登录、业务写入和 AI 调用；不记录交易正文、价格金额、密码、Cookie 或 Prompt 正文。
- DeepSeek 上报增加调用状态、耗时、模型、Prompt 版本及输入/输出/总 token 数。
- 新增 `pnpm report:daily -- YYYY-MM-DD`，按上海时区输出当日摘要、事件计数和最多 300 条用户流水。
- 本地验证通过注册、登录、退出、会话撤销、账号隔离、原有 CRUD、页面跳转以及真实 DeepSeek token 统计。
- 无邮箱验证阶段增加轻量登录与注册限流，不把来源 IP 写入数据库；多实例后再升级共享限流。
- 账号代码与三张新表已发布到腾讯云 `37d688d`；云端历史数据仍为 8 个计划、10 条操作、6 条复盘。当前保持 `AUTH_MODE=basic`，等待 owner 在服务器终端设置邮箱密码后再切换 session，事件表以 0 条干净基线开始。
- owner 初始化后已切换 session 模式；修复 Nginx 反向代理下未登录跳转误用内部 `localhost:3000` 的问题，并让生产冒烟脚本分别验证 Basic 与 session 认证边界。

### 云端数据迁移、AI 追溯与 PWA 基础

- 本地 8 个计划、10 条操作、6 条复盘和 3 条审计归档通过 SSH 管道事务导入云端，没有生成含业务数据的临时文件。
- 云端回读数量一致，所有复盘操作引用无断链。
- 审计报告新增 generation 元数据，记录 source、provider、model、promptVersion、生成状态和回退原因；旧归档兼容为 legacy。
- 新增 `audit_manifest.json`，Prompt 修改必须提升版本，新归档保存实际 Prompt 版本。
- 历史审计卡显示简短模型与 Prompt 版本，不增加主体卡片高度。
- 新增密钥-only SSH 配置，动态公网 IP 场景保留 22 可达但禁止 root 密码登录。
- OpenCloudOS 的 cloud-init 会默认开启 SSH 密码认证，因此加固文件使用 `00-rationaltrade.conf` 先于系统配置生效，并要求用全新连接验证有效配置。
- 新增 PWA manifest、512/180 图标、standalone 与安全区支持；Service Worker 只缓存离线提示，不缓存业务页面、API 或交易数据。
- 云端发布步骤固定先应用数据库 schema、再构建重启；生产健康检查增加 30 秒启动等待，非交互 SSH 明确加载 Node/pnpm 环境。
- `/api/health` 优先返回发布时注入的 Git commit，避免环境文件中的旧版本号造成发布状态误判。

### 正式域名与同源部署方案

- 正式域名确定为 `rationaltrade.cn`，服务器区域确认为腾讯云新加坡 `ap-singapore-1`。
- 浏览器、移动 H5 和未来 WebView 套壳统一访问 `https://rationaltrade.cn`，后台请求继续使用同源 `/api/*`。
- 暂不购买独立 API 域名、付费 DNS 套餐或付费 DV 证书；使用 DNSPod 免费解析和自动续期的免费 HTTPS 证书。
- Nginx 配置改为只匹配 `rationaltrade.cn` 与 `www.rationaltrade.cn`，和原有 OpenClaw IP 路由共存。
- 环境变量模板的 `APP_PUBLIC_ORIGIN` 更新为正式 HTTPS 域名，部署手册补充 DNS 记录和证书签发顺序。
- 腾讯云已安装 Certbot 2.8 与 Nginx 插件，域名 Host 路由内部验证通过；等待 DNS 与 443 后签发证书。
- DNS 根域名与 `www` 已生效，Let's Encrypt ECDSA 证书签发成功，HTTP 强制跳转 HTTPS。
- `certbot-renew.timer` 已启用并完成续期演练，当前证书有效期至 2026-11-14。
- 生产 `APP_PUBLIC_ORIGIN` 已切换为 `https://rationaltrade.cn`；公网健康、访问保护和 DeepSeek 调用通过。

## 2026-07-19

### Prompt 文档化与运行时加载

- 新增 `docs/prompts/audit_system.md`、`audit_user.md` 和维护说明，作为 DeepSeek 周期审计 Prompt 的唯一内容来源。
- TypeScript 中删除 Prompt 正文，新增服务端加载器负责文档读取、占位符校验和审计 JSON 注入。
- 开发环境每次请求读取 Prompt，文档修改可直接验证；生产环境首次读取后缓存，修改发布后重启 PM2 生效。
- `audit_user.md` 必须且只能包含一个 `{{AUDIT_INPUT_JSON}}`，异常时停止模型请求并回退本地规则审计。
- Next.js 文件追踪显式包含 Prompt Markdown，避免未来精简部署时遗漏运行时文件。
- 更新 AI 边界、后端设计、前端架构、项目说明、路线图、部署手册、README 和协作守则，统一记录真实 DeepSeek 接入及 Prompt 维护方式。
- 腾讯云 `.env.production` 已配置 DeepSeek Key，服务器内部真实调用 `deepseek-v4-flash` 成功；验证时云端数据库为空，本地业务数据尚未迁移。

### DeepSeek 周期审计接入

- `/api/audit` 接入 DeepSeek OpenAI 格式接口，默认使用 `deepseek-v4-flash`，避免继续绑定即将弃用的 `deepseek-chat`。
- 请求使用 JSON Output、关闭思考模式并设置 20 秒超时；只发送系统整理后的 `aiInputDigest`。
- DeepSeek 只生成摘要、状态标签、行为发现和复盘追问；周期、指标、时间和输入摘要仍由本地规则生成。
- 服务端校验输出枚举、条数、长度和禁止投资建议；空内容、截断、超时、接口错误或非法输出统一回退本地规则报告。
- 手动点击 AI 分析后使用 Toast 明确提示 DeepSeek 成功或本地规则回退，自动刷新保持安静。
- 计划和记录变化时只重新计算本地指标，真实模型调用限定在用户主动点击“AI 分析”，避免页面加载和普通保存产生隐性费用。
- 新增 `DEEPSEEK_API_KEY`、`AI_BASE_URL`、`AI_MODEL`、`AI_TIMEOUT_MS` 配置，真实密钥继续只存本地和服务器环境文件。
- 新增静默输入的 `scripts/configure-deepseek.sh`，避免密钥出现在聊天或命令历史，并将环境文件权限固定为 `600`。

### 腾讯云首次部署与环境校正

- SSH Key 已授权到服务器 root 用户，后续发布无需重复进入腾讯云控制台。
- 服务器实际系统确认为 OpenCloudOS 9.4，而非原计划中的 Ubuntu，部署手册和后台环境说明已校正。
- 安装并启动 PostgreSQL 15，数据库只监听服务器本机；回环 TCP 认证使用 `scram-sha-256`。
- RationalTrade 已部署到 `/var/www/rationaltrade`，生产构建 commit 为 `a81d2a4`。
- PM2 进程已在线并保存开机恢复配置。
- 补齐 `pm2-root` systemd 开机自启，并将 Next.js 生产监听地址从 `0.0.0.0` 收紧到 `127.0.0.1`。
- 临时访问凭证只保存在服务器 `/root/rationaltrade-access.txt`，权限为 `600`。
- 服务器内部生产冒烟、Basic Auth 和事务数据库回归通过，合成数据已清理。
- 发现服务器原有 OpenClaw Nginx 根路径配置；在确认是否保留前不覆盖，避免影响既有服务。

### 计划事务快照与公网访问保护

- 新增 `PUT /api/plans/:planId/snapshot`，在一个 PostgreSQL 事务中更新计划基础信息、操作和复盘，并明确删除快照中不再存在的子记录。
- 快照会校验计划挂靠关系、重复 ID、复盘引用和子记录归属；失败时整体回滚。
- 前端计划编辑、操作/复盘编辑和删除改为单次事务快照请求，消除多请求部分成功风险。
- 新增生产环境 Basic Auth middleware，除 `/api/health` 外保护页面与业务 API；缺少生产凭证时默认拒绝访问。
- 增加 `APP_PUBLIC_ORIGIN`、`APP_ACCESS_USERNAME`、`APP_ACCESS_PASSWORD` 环境变量模板，真实密码仍只存服务器环境。
- 公网联调 IP 暂定为 `43.156.228.145`，并新增可直接复制的 Nginx 配置。
- 数据库回归增加事务快照成功与非法快照零修改验证。

### 正式数据流改为服务端优先

- 根据产品边界复审，移除面向用户的“本地编辑 / 云端自动保存”模式和整库同步卡片。
- PostgreSQL 固定为正式业务数据源；计划、操作、复盘和审计归档的新增、修改、删除都等待服务端成功后再更新界面。
- 保存期间显示进行中状态并阻止重复提交；失败时保留原数据、编辑态和已填写内容。
- 启动时优先读取服务端；失败时只展示最近一次成功的 localStorage 缓存和重试提示，不允许静默降级写入本地。
- 审计归档、删除和清空同样改为服务端优先，并保留所有删除动作的二次确认。
- 历史页移除恢复示例、清空本地、整包导入等调试入口，保留 JSON 导出。
- `POST /api/sync/import-local` 继续作为首次迁移和运维接口，不作为用户功能。
- 删除不再使用的 `CloudSyncPanel` 与同步模式状态模块。
- 当前计划 ID 单独保存在浏览器偏好中，刷新页面后仍保持用户最后选择的计划，避免记录误挂到列表首项。

### 云端自动保存模式与删除同步

- 新增“本地编辑 / 云端自动保存”工作模式切换。
- 只有数据库可用、本地没有未同步修改，并且启用前再次确认云端未变化时，才允许进入云端模式。
- 计划、操作和复盘的创建、编辑、删除采用本地乐观更新与顺序云端写入队列。
- 审计归档、删除和清空在云端模式下直接写 PostgreSQL，并保留原有二次确认规则。
- 云端写入失败不回滚本地内容，显示错误并保留最后一次失败操作供重试。
- 创建 API 支持客户端 ID、创建时间和更新时间，网络中断后重复创建保持幂等，不生成重复记录。
- 删除 adapter 把 404 视为目标状态已达成，使丢失响应后的删除重试保持幂等。
- 批量导入、整库清空和恢复示例仍限定在本地模式，避免大范围替换被误当作普通自动保存。
- 同步指纹升级为 `rationaltrade.cloudSync.v2`，忽略服务端时间戳差异，只比较实际业务内容。
- 数据库自动回归新增客户端 ID 保留和重复创建验证。

### 归档 Toast 与可靠云端备份

- 审计归档成功后显示可自动消失、也可手动关闭的成功 Toast。
- 新增统一 Toast 组件，云端读取、上传、冲突和失败信息也使用同一反馈方式。
- 云端同步卡改为明确的“本地编辑，PostgreSQL 备份”工作方式，不把当前能力描述成实时双向同步。
- 本地保存同步基线指纹、最近成功时间和上传/下载方向，不保存业务数据或任何凭证。
- 页面显示“尚未建立同步基线”“有未上传修改”“与上次同步一致”等状态。
- 上传前先读取并比较云端；检测到云端变化时暂停上传，提供“使用云端副本”或“合并后上传”。
- 合并时同 ID 以本地版本为准，保留云端独有计划、操作、复盘和审计，避免静默覆盖。
- 状态读取、云端预览和上传失败后提供明确的重试入口。

### 恢复 AI 分析与归档的明确入口

- 审计卡片顶部不再只显示两个含义不清的小图标。
- 恢复“AI 分析”和“归档分析”文字按钮，并保留加载状态与原有归档逻辑。
- 当前 AI 分析仍由本地规则接口生成；真实模型接入将在配置服务端 AI 凭证后启用。
- 当前归档先写入浏览器本地存储，可通过云端同步整包上传到 PostgreSQL。

### 观察记录批量上传修复

问题：

- 旧示例中的观察记录仍携带股数和总金额。
- 批量上传触发 PostgreSQL `trade_operations_observe_has_no_quantity` 约束并整体回滚。
- 页面只显示笼统的英文数据库错误。

修复：

- 旧记录、localStorage、JSON 和批量上传进入当前模型时，统一清除观察记录的数量、数量单位和总金额。
- 修正示例源数据。
- 批量导入在事务开始前逐条校验计划、操作、复盘和审计，并返回具体计划/记录的中文提示。
- 数据库异常提示改为中文，并明确事务已回滚。
- `pnpm verify:database` 新增旧观察记录整包上传、字段清洗、非法整包拒绝和零残留验证。

### 本地 PostgreSQL 真实联调与状态契约修复

验证范围：

- PostgreSQL schema 实际应用。
- 计划、操作、复盘和审计的创建、读取与更新。
- 云端数据预览入口。

修复：

- `/api/system/status` 现在始终返回 `singleUserConfigured`。
- 修复数据库已连通但前端仍显示“待配置”、云端按钮无法启用的问题。
- `.env.local` 只保存本机回环地址和本地测试用户 ID，并保持 Git 忽略。
- 新增本地 PostgreSQL 初始化、启停脚本和 `pnpm verify:database` 自动 CRUD 检查。

### 云端计划 adapter 与安全下载预览

新增：

- `cloudTradeRepository`，覆盖计划、操作、复盘的读取、新增、更新和确认删除。
- 历史页“预览云端数据”入口。
- 云端计划、操作、复盘和审计的数量预览。
- “下载并替换本地”二次确认。

当前行为：

- 页面明确显示当前工作区仍为本地。
- 刷新云端状态不会读取或覆盖本地记录。
- 云端数据库可用后才能读取预览。
- 用户确认替换前，云端数据只保存在临时预览状态。
- 下载后保存为本地工作副本，当前不启用静默双向同步。
- 数据库未配置或读取失败时保留原本地数据并显示原因。

### Backend M1 云端审计归档与前端 repository

新增：

- `POST /api/audit/archive`
- `GET /api/audit/reports`
- `DELETE /api/audit/reports/:reportId`
- `lib/server/audit-repository.ts`
- `lib/server/audit-validation.ts`
- `lib/audit-repository.ts`

当前行为：

- 云端可以保存、读取和删除用户明确归档的审计快照。
- 审计输入在服务端校验周期、信号、指标、摘要、结论和追问字段。
- 删除审计归档必须携带 `X-Confirm-Delete: true`。
- 前端本地审计归档从 `HistoryPage` 的直接 localStorage 读写下沉到 `localAuditRepository`。
- 新增 `cloudAuditRepository`，但默认仍使用本地模式，避免未配置数据库时覆盖本地数据。
- 单用户环境检查提取为共享服务端模块，供计划和审计 repository 复用。

### Backend M1 核心数据更新与删除 API

新增：

- `PATCH /api/plans/:planId`
- `DELETE /api/plans/:planId`
- `PATCH /api/plans/:planId/operations/:operationId`
- `DELETE /api/plans/:planId/operations/:operationId`
- `PATCH /api/plans/:planId/reviews/:reviewId`
- `DELETE /api/plans/:planId/reviews/:reviewId`

当前行为：

- 计划、操作和复盘的云端接口具备完整 CRUD。
- 更新请求复用完整服务端校验，保持观察、股数和份额的数据约束。
- 子记录更新或删除后会刷新所属计划的更新时间。
- 删除计划由 PostgreSQL 外键级联删除所属操作和复盘。
- 所有删除请求必须携带 `X-Confirm-Delete: true`，为前端二次确认提供服务端保护。
- 补充公网入口说明：外部访问只开放 Nginx 80/443，不暴露 Next.js 3000 或 PostgreSQL 5432。

### 腾讯云 Ubuntu 部署手册与脚本

新增：

- `docs/tencent_cloud_runbook.md`
- `scripts/verify-local.sh`
- `scripts/check-production.sh`
- `scripts/apply-schema.sh`

当前用途：

- 本地发布前统一执行类型检查和生产构建。
- 服务器上应用 PostgreSQL schema。
- 发布后检查 `/api/health` 和 `/api/system/status`。
- 记录腾讯云 Ubuntu、Nginx、PM2、PostgreSQL 的首次部署和回滚流程。
- `verify-local.sh` 会阻止在 `pnpm dev` 占用 3000 端口时运行，避免 `next dev` 和 `next build` 同时写 `.next` 导致开发缓存错位。

### Next.js 开发态 Devtools 报错修复

修复本地开发时偶发的 Next.js runtime overlay 报错：

- `__webpack_modules__[moduleId] is not a function`
- `SegmentViewNode` 找不到 React Client Manifest

处理方式：

- 在 `next.config.mjs` 中关闭 `experimental.devtoolSegmentExplorer`。
- 该配置只影响 Next.js 开发态 segment explorer，不影响业务页面、生产构建或云端 API。

### H5 云端同步入口

历史页新增云端同步卡片。

当前行为：

- 显示数据库、AI、COS 配置状态。
- 支持刷新 `/api/system/status?db=1`。
- 数据库、单用户 ID 和连接状态通过后，允许上传当前本地计划和审计归档。
- 上传调用 `POST /api/sync/import-local`。
- 当前仍以本地存储为主，不自动从云端覆盖本地数据。

### Backend M1 本地数据批量导入云端

新增：

- `POST /api/sync/import-local`

当前行为：

- 接收当前导出的 RationalTrade JSON。
- 批量导入计划、操作、复盘和审计归档。
- 使用数据库事务，失败时回滚，避免只导入一部分。
- 保留本地字符串 ID，维持 `operationIds` 等关联关系。
- 同步把 PostgreSQL schema 的主键和外键调整为 `text`，默认仍生成 UUID 字符串，但兼容本地 `plan-...`、`operation-...`、`review-...` ID。

### Backend M1 云端写入 API 骨架

新增：

- `POST /api/plans`
- `POST /api/plans/:planId/operations`
- `POST /api/plans/:planId/reviews`
- `lib/server/trade-validation.ts`

当前行为：

- 可以在配置 PostgreSQL 和 `RATIONALTRADE_SINGLE_USER_ID` 后创建计划、追加操作、追加复盘。
- 未配置数据库时返回 `storage: "not-configured"`，不影响当前本地 H5。
- 服务端校验会阻止观察操作携带股数/份额，也会保证份额模式下总金额等于份额金额。
- 前端保存逻辑暂不切换到云端，等 API 骨架稳定后再做本地数据上传和云端同步。

### Backend M1 云端计划列表接口骨架

新增：

- `lib/server/plan-repository.ts`
- `/api/plans`

当前行为：

- `/api/plans` 只读，不写入数据。
- 未配置 `DATABASE_URL` 时返回空数组和 `storage: "not-configured"`。
- 配置 PostgreSQL 和 `RATIONALTRADE_SINGLE_USER_ID` 后，会读取该用户的计划、操作和复盘。
- 前端 H5 仍继续使用本地存储，暂不替换保存逻辑。

### Backend M1 服务端配置与数据库连接边界

新增：

- `lib/server/config.ts`
- `lib/server/db.ts`
- `/api/system/status`

当前行为：

- `/api/system/status` 只返回数据库、AI、COS 是否已配置。
- `/api/system/status?db=1` 会在配置 `DATABASE_URL` 后尝试连接 PostgreSQL。
- 未配置数据库时不会影响当前本地 H5 使用。
- 接口不会暴露 token、数据库连接字符串、AI Key 或 COS Secret。

### Backend M1 数据库结构初稿

新增 PostgreSQL 初始结构文件：

- `database/schema.sql`

本轮包含：

- `profiles`
- `trade_plans`
- `trade_operations`
- `plan_reviews`
- `audit_reports`
- `trading_rules`
- `ai_reviews`

同时补强 `.gitignore`，明确忽略 `.env.production`、`.env.development`、`.env.test` 等真实环境变量文件。真实 token、AI Key、数据库密码和 COS Key 只允许保存在本地或服务器环境变量中，不提交到 GitHub。

## 2026-06-27

### Backend M1 健康检查骨架

开始实现 Backend M1 的最小代码骨架。

新增：

- `/api/health` 健康检查接口。
- `.env.example` 生产环境变量模板。

健康检查只用于腾讯云 Ubuntu、Nginx、PM2 和发布后的冒烟测试，不访问用户数据、数据库、AI 或 COS。

### 服务器扩容与迁移预案

补充腾讯云服务器性能不足时的迁移设计。

新增内容：

- 同服务器升配优先。
- 新 CVM 迁移应用和 PostgreSQL 的流程。
- 数据库拆分到腾讯云 PostgreSQL 的时机。
- COS 文件不随 CVM 迁移的原则。
- 迁移后验证清单。
- 旧服务器保留 24-72 小时作为回滚。

### 腾讯云 Ubuntu 部署规划补充

用户确认服务器选用腾讯云云服务器，Ubuntu 环境。

本轮补充：

- 后台设计从默认 Supabase 托管视角调整为腾讯云 Ubuntu 自部署优先。
- 增加 Nginx、Node.js、PM2/systemd、PostgreSQL、腾讯云 COS 的部署方向。
- 说明什么时候上传到腾讯云、怎么上传、后续改动如何本地验证后发布。
- README 和 H5 架构文档同步补充发布检查。

### 后台与 H5 架构设计文档

新增：

- `docs/backend_design.md`
- `docs/frontend_architecture.md`

后台设计使用 Backend M0/M1/M2 的分期命名，避免和产品 Product Phase 1 混淆。Product Phase 1 本身包含 AI 截图补账和 AI 审计，后台分期只是说明云端和真实 AI 接入顺序。

### README 与删除确认补充

新增项目 README，记录当前 Phase 1 能力、本地运行方式、数据存储、AI 边界和常用验证步骤。

同时补齐删除类动作的二次确认：

- 删除单条审计归档前需要确认。
- 移除截图识别结果前需要确认。

### 数据导入导出包含审计归档

导出 JSON 现在会同时包含：

- plans
- auditReports

导入 JSON 时会同时恢复计划和审计归档。旧版只包含 plans 或 trades 的 JSON 仍然兼容，审计归档会按空列表处理。

### 审计归档支持删除和清空

历史审计快照归档支持管理用户自己保存的快照。

新增：

- 删除单条审计归档。
- 清空全部审计归档。

当用户没有保存过审计归档时，历史区继续显示示例快照；一旦用户保存了真实归档，则优先显示用户归档内容。

### 审计快照归档可保存

审计卡新增“归档当前审计”按钮。

当前行为：

- 点击归档会把当前 `AuditReport` 保存到浏览器本地。
- 历史审计快照优先展示用户归档内容。
- 用户尚未归档时，继续展示示例历史快照作为兜底。
- 本地最多保留 20 条归档快照。
- 归档成功后在审计卡下方显示反馈提示。

### 审计 API 占位接入

新增 `/api/audit` 接口作为真实 AI 审计前的服务边界。

当前行为：

- 前端仍先用本地规则生成审计报告，保证页面即时可用。
- 历史页会请求 `/api/audit`，成功后使用接口返回的 `AuditReport`。
- 接口当前返回 mock-local 来源，内部仍复用本地规则。
- 刷新审计按钮现在会触发一次接口请求。
- 请求失败时回退到本地报告，不影响用户查看。

后续接真实 AI 时，可在该接口内把 `aiInputDigest` 发送给模型，并返回同样的 `AuditReport` 结构。

### 审计卡默认收起次要信息

用户反馈审计卡过长，且历史审计快照折叠区点击不稳定。

本轮调整：

- 审计卡默认只展示评估周期、情绪热度、近期主要结论、记录量、复盘覆盖。
- 审计细节、复盘追问、AI 输入摘要、历史审计快照默认收起。
- 折叠交互从原生 `details` 改为按钮控制，提升移动端点击稳定性。

同时新增 `audit-ai-adapter` 边界：

- 当前仍使用本地规则生成 `AuditReport`。
- 对外保留 `buildAuditReport(plans)`。
- 预留 `buildAuditAiRequest(report)`，后续接真实 AI 时可以直接把 `aiInputDigest` 作为请求输入。

### 审计输出改为轻量 AI 报告结构

近 30 天审计先保持简单，不做复杂 Dashboard。

本轮调整为更适合未来接 AI 的一次性输出结构：

- `aiInputDigest`：系统整理出的审计输入摘要，可直接传给 AI。
- `summary`：一段周期性审计结论。
- `findings`：若干事实发现。
- `reviewQuestions`：给用户继续复盘的追问。

当前仍由本地规则生成，未来接入真实 AI 时，可以把 `aiInputDigest` 发送给模型，并要求模型返回同样结构。

### AI 截图补账 Mock 流程接入计划模型

记录页新增“截图补账”入口，使用 Mock 识别结果先跑通 Phase 1 的 AI 截图识别确认流程。

当前流程：

- 点击截图补账进入识别结果确认。
- 展示多条 Mock 识别交易。
- 用户逐条确认标的、代码、时间、价格、数量和心理活动。
- 批量归档时写入 `TradeOperation`。
- 归档会优先匹配同代码或同标的计划。
- 没有匹配计划时自动创建截图补账计划，再把操作挂到该计划。

同时对齐手动操作规则：

- 批量识别里的“股数 / 份额”可切换。
- 份额模式下归档金额等于份额金额。
- 观察记录不要求数量，也不展示归档金额。
- 时间输入框按本地时区显示。

### 时间线记录编辑与删除

计划详情页中的时间线记录支持管理单条内容。

新增：

- 编辑单条操作。
- 删除单条操作。
- 编辑单条复盘。
- 删除单条复盘。

删除操作时，如果未来有复盘关联了该操作，会同步从复盘关联列表中移除该操作 id。复盘仍然独立存在。

同时修正了编辑已有操作或复盘时，时间输入框显示为 UTC 偏移时间的问题。编辑表单会按本地时区显示时间。

### 计划详情内编辑基础信息

计划详情页新增基础信息编辑能力。

可编辑：

- 计划名称
- 标的
- 代码
- 市场
- 币种
- 计划假设

保存后会更新当前计划，后续新增操作会继续挂靠到这个计划。已有操作和复盘仍保持原记录内容。

### 文档维护规则

用户要求后续重要产品需求和实现变更同步写入合适的需求文档和更新记录。

已明确：

- 产品需求、核心数据模型、页面结构、重要开发节奏变化，需要更新 docs。
- `docs/change_log.md` 作为持续更新记录。
- `docs/AGENTS.md` 已加入对应执行规则。

### 计划详情内直接新增记录

计划详情不再只是查看时间线。

新增：

- 在计划详情中直接添加操作。
- 在计划详情中直接添加独立复盘。
- 保存后仍停留在计划详情，时间线即时更新。

这样用户不必回到底部“记录”页重新选择计划。

### 计划-操作-复盘结构重构

本轮将 Phase 1 的核心记录对象从“单条交易记录”调整为“计划”。

新的产品结构：

- 一个计划默认对应一个标的。
- 一个计划可以包含多次操作。
- 操作包括买入、卖出、观察。
- 一个计划可以包含多次复盘。
- 复盘完全独立于操作，即使什么操作都没有发生，也可以对计划做阶段性复盘。
- AI 分析后续应面向一段时间内的所有计划、操作和复盘做聚合审计。

数据结构同步调整为：

- `TradePlan`
- `TradeOperation`
- `PlanReview`

旧版 `TradeDecision` 保留为迁移兼容类型。旧本地数据会迁移为计划数据。

### 复盘结果语义调整

独立复盘中的实际结果不再使用“待复盘 / 盈利 / 亏损 / 持平”作为新输入选项。

新输入选项：

- 符合预期
- 部分符合
- 不符合预期

旧数据中的盈利、亏损、持平、待复盘仍保留显示兼容。

### 计划详情拆分

历史页从直接展开卡片时间线，调整为：

- 计划列表
- 计划详情视图
- 计划详情内展示时间线、计划假设、状态、操作数、复盘数

### 本地数据导入导出

无后台阶段使用浏览器本地存储。

数据导出格式升级为 plans schema：

- `schemaVersion: 2`
- `source: rationaltrade-local`
- `plans`

导入仍兼容旧版 trades JSON，并会迁移为 plans。

### 当前仍未接入

- Supabase
- 真实 AI API
- 真实 OCR
- 真实行情
- 账户体系

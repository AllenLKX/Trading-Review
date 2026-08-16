# RationalTrade

RationalTrade 是一个移动端优先的交易决策记录与行为复盘工具。

它不是荐股工具，也不是资产管理工具。当前目标是先跑通 Phase 1：创建计划，记录操作和独立复盘，再基于近 30 天记录生成轻量审计报告。

## 当前能力

- 创建和编辑交易计划
- 在计划下记录买入、卖出、观察
- 在计划下记录独立复盘
- 编辑和删除计划时间线里的操作与复盘
- Mock AI 截图补账流程，逐条确认后批量归档
- 近 30 天审计摘要、复盘追问和 AI 输入摘要
- 用户主动触发的 DeepSeek 周期行为审计，失败时回退本地规则
- 审计快照归档、删除、清空
- 本地 JSON 导入导出，包含计划和审计归档

## 本地运行

```bash
pnpm install
pnpm dev --hostname 0.0.0.0
```

默认本机访问：

```text
http://localhost:3000
```

手机同局域网体验时，使用电脑局域网 IP 加端口访问。

需要验证真实 PostgreSQL API 时，参照 `docs/local_database.md` 初始化隔离的本地测试库。日常启停使用：

```bash
./scripts/local-db.sh start
./scripts/local-db.sh stop
```

## 腾讯云 OpenCloudOS 部署

生产环境已部署到腾讯云 OpenCloudOS 9.4 云服务器。

正式域名为 `rationaltrade.cn`。页面与 `/api/*` 使用同一 HTTPS 域名，浏览器、移动 H5 和未来套壳 App 共用同一服务端入口。

建议形态：

- Nginx 负责 HTTPS 和反向代理
- Node.js LTS 运行 Next.js
- PM2 或 systemd 守护进程
- PostgreSQL 保存业务数据
- 腾讯云 COS 保存后续截图文件

当前 Backend M1 已部署，PostgreSQL 是正式数据源，localStorage 只作为最近一次成功读取的缓存。域名 DNS 生效后配置免费 HTTPS。

详细部署步骤见：

```text
docs/tencent_cloud_runbook.md
```

部署前复制环境变量模板：

```bash
cp .env.example .env.production
```

健康检查接口：

```text
/api/health
```

它只验证 Next.js 服务是否正常运行，不访问用户数据、数据库、AI 或 COS。

系统状态接口：

```text
/api/system/status
/api/system/status?db=1
```

默认只返回数据库、AI、COS 是否已配置，不暴露任何真实 token 或连接字符串。加上 `?db=1` 时会尝试连接 PostgreSQL；未配置 `DATABASE_URL` 时只会返回未配置状态，不影响当前本地 H5 使用。

云端计划列表接口：

```text
GET /api/plans
POST /api/plans
PATCH /api/plans/:planId
DELETE /api/plans/:planId
POST /api/plans/:planId/operations
PATCH /api/plans/:planId/operations/:operationId
DELETE /api/plans/:planId/operations/:operationId
POST /api/plans/:planId/reviews
PATCH /api/plans/:planId/reviews/:reviewId
DELETE /api/plans/:planId/reviews/:reviewId
POST /api/sync/import-local
POST /api/audit/archive
GET /api/audit/reports
DELETE /api/audit/reports/:reportId
```

当前前端以 PostgreSQL 为正式数据源，localStorage 只保留最近一次成功读取的只读缓存。未配置数据库时返回 `storage: "not-configured"`；配置 PostgreSQL 和 `RATIONALTRADE_SINGLE_USER_ID` 后，可以管理计划、操作和复盘。`DELETE` 必须携带 `X-Confirm-Delete: true`，并由前端先完成二次确认。

`POST /api/sync/import-local` 接收当前导出的 RationalTrade JSON，批量导入计划、操作、复盘和审计归档。导入会保留本地字符串 ID，用于维持复盘和操作之间的关联。

审计生成和审计归档相互独立：`POST /api/audit` 在配置 `DEEPSEEK_API_KEY` 后调用 DeepSeek，未配置、超时或输出校验失败时返回本地规则报告；`/api/audit/archive` 和 `/api/audit/reports` 负责用户明确保存的云端快照。

历史页云端同步卡片明确以本地工作区为准。数据库可用后，可以先预览云端的计划、操作、复盘和审计数量；只有再次确认，才会把云端数据下载并替换本地工作副本。当前不做静默拉取或自动双向同步。

## 数据说明

当前数据保存在浏览器本地存储中。

- 计划数据：`rationaltrade.tradePlans.v2`
- 审计归档：`rationaltrade.auditReports.v1`

导出的 JSON 包含：

- `plans`
- `auditReports`

旧版只包含 `trades` 或 `plans` 的 JSON 仍可导入。

## AI 边界

审计接口 `/api/audit` 已接入 DeepSeek。模型只接收 `aiInputDigest` 并生成行为总结、发现和复盘追问；确定性指标仍由本地规则生成。所有模型输出都经过结构和投资建议边界校验，失败时自动回退本地规则报告。

运行时 Prompt 统一维护在：

```text
docs/prompts/audit_system.md
docs/prompts/audit_user.md
```

TypeScript 不保存 Prompt 副本。开发环境修改文档后下一次请求生效；生产环境需要重启 PM2。

安全配置本地密钥：

```bash
./scripts/configure-deepseek.sh .env.local
```

脚本静默读取密钥，不把密钥写入命令历史；`.env.local` 已被 Git 忽略。配置后需要重启 `pnpm dev`。

截图补账当前使用 Mock 识别结果。识别结果必须由用户逐条确认后才会归档。

## 常用验证

运行生产构建验证前，先停止正在运行的 `pnpm dev`。`next dev` 和 `next build` 都会写 `.next`，同时运行可能导致本地开发缓存错位。

```bash
./scripts/verify-local.sh
```

只检查线上或服务器本机冒烟：

```bash
./scripts/check-production.sh http://localhost:3000
```

页面验证建议：

- 记录页：创建计划，添加操作和复盘
- 记录页：进入截图补账，确认 Mock 识别结果后批量归档
- 历史页：查看计划详情，编辑或删除时间线记录
- 历史页：刷新审计，归档审计快照，再展开历史归档
- 历史页：导出 JSON，确认包含 `auditReports`

## 当前分支

主要开发分支：

```text
codex/phase-1-local-loop
```

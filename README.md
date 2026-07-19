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

## 腾讯云 Ubuntu 部署方向

生产环境计划使用腾讯云 Ubuntu 云服务器。

建议形态：

- Nginx 负责 HTTPS 和反向代理
- Node.js LTS 运行 Next.js
- PM2 或 systemd 守护进程
- PostgreSQL 保存业务数据
- 腾讯云 COS 保存后续截图文件

当前版本仍是本地存储闭环，不建议立刻上传生产服务器。等 Backend M1 骨架完成、`pnpm build` 通过、生产环境变量清单明确后，再做第一次腾讯云部署。

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
POST /api/plans/:planId/operations
POST /api/plans/:planId/reviews
POST /api/sync/import-local
```

当前前端仍使用本地存储，以上接口先作为云端数据 API 骨架。未配置数据库时返回 `storage: "not-configured"`；配置 PostgreSQL 和 `RATIONALTRADE_SINGLE_USER_ID` 后，可以创建计划、追加操作和追加复盘。

`POST /api/sync/import-local` 接收当前导出的 RationalTrade JSON，批量导入计划、操作、复盘和审计归档。导入会保留本地字符串 ID，用于维持复盘和操作之间的关联。

## 数据说明

当前数据保存在浏览器本地存储中。

- 计划数据：`rationaltrade.tradePlans.v2`
- 审计归档：`rationaltrade.auditReports.v1`

导出的 JSON 包含：

- `plans`
- `auditReports`

旧版只包含 `trades` 或 `plans` 的 JSON 仍可导入。

## AI 边界

当前没有接真实 AI。

审计接口 `/api/audit` 现在返回 `mock-local` 报告，内部仍复用本地规则。后续接真实 AI 时，优先使用 `aiInputDigest` 作为模型输入，并返回同样的 `AuditReport` 结构。

截图补账当前使用 Mock 识别结果。识别结果必须由用户逐条确认后才会归档。

## 常用验证

```bash
pnpm typecheck
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

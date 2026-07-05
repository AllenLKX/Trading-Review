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

# RationalTrade H5 / 前端架构设计

## 1. 当前定位

当前 H5 是 Product Phase 1 的主要交付形态。

目标是移动端优先，先跑通：

- 计划
- 操作
- 独立复盘
- Mock 截图补账
- 近 30 天审计
- 审计归档
- 本地导入导出

## 2. 技术栈

当前使用：

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react
- localStorage
- Next.js API Route

暂未引入：

- Supabase
- shadcn/ui 组件生成
- 真实 AI SDK
- 真实 OCR
- PWA

## 3. 目录结构

### app

页面和 API 入口。

- `app/page.tsx`：H5 主入口，控制底部 tab
- `app/layout.tsx`：应用布局和 metadata
- `app/globals.css`：全局样式和 Tailwind 层
- `app/api/audit/route.ts`：审计 API 占位

### components

通用 UI。

- `BottomTabBar`
- `TopAppBar`
- `SegmentedControl`
- `ChipGroup`
- `EmptyState`

原则：

- 只放跨业务复用组件
- 不放交易业务逻辑
- 移动端优先

### features

业务功能模块。

`features/trades`

- 记录页
- 计划下操作表单
- 计划下复盘表单
- 截图补账 Mock 流程
- 批量识别确认卡片

`features/audits`

- 历史页
- 计划列表
- 计划详情
- 时间线编辑和删除
- 审计卡

### lib

数据模型、数据处理和本地状态。

- `types.ts`：核心 TypeScript 类型
- `use-trade-plans.ts`：本地计划状态管理
- `trade-repository.ts`：localStorage repository
- `trade-data-file.ts`：导入导出 JSON
- `audit-summary.ts`：本地审计规则
- `audit-ai-adapter.ts`：AI 审计服务边界
- `plan-migration.ts`：旧交易记录迁移到计划模型
- `sample-data.ts`：示例数据

## 4. 状态管理

当前使用 React state + localStorage。

核心 hook：

- `useTradePlans`

负责：

- 加载本地 plans
- 保存 plans
- 创建计划
- 更新计划
- 删除计划
- 添加操作
- 添加复盘
- 导入替换
- 恢复示例

审计归档目前在 `HistoryPage` 内管理：

- localStorage key：`rationaltrade.auditReports.v1`
- 后续接后台时可迁移到 `audit_reports` 表

## 5. 数据流

### 手动记录

`RecordPage`
↓
`PlanOperationForm` 或 `PlanReviewForm`
↓
`useTradePlans.addOperation/addReview`
↓
localStorage
↓
`HistoryPage`

### 截图补账

`ScreenshotUploadPanel`
↓
Mock `sampleBatchItems`
↓
`BatchVerificationCard`
↓
用户逐条确认
↓
生成 `TradeOperation`
↓
匹配或创建计划
↓
归档到 localStorage

### 审计

`HistoryPage`
↓
本地 `buildAuditReport(plans)` 先生成 fallback
↓
请求 `/api/audit`
↓
成功则使用接口返回
↓
失败则保留 fallback

## 6. 删除和清空规则

所有删除类动作必须二次确认。

包括：

- 删除计划
- 清空本地计划
- 删除操作
- 删除复盘
- 删除审计归档
- 清空审计归档
- 移除截图识别结果

确认文案要说明影响范围。

## 7. 导入导出

导出 JSON 使用 `TradeDataFile`。

当前包含：

- `schemaVersion`
- `exportedAt`
- `source`
- `plans`
- `auditReports`
- 可选旧字段 `trades`

导入兼容：

- 新版 `plans + auditReports`
- 旧版 `plans`
- 旧版 `trades`
- 旧数组格式 trades

## 8. H5 设计原则

- 第一屏直接是可用工具，不做营销页
- 移动端优先
- 核心操作放在底部 tab 中
- 表单字段要清楚显示错误
- 默认展示关键信息，其余收起
- 删除和清空必须确认
- 不提供投资建议
- AI 结果必须可解释、可确认

## 9. 后续前端改造点

接后台后建议调整：

1. 增加 auth 状态
2. 增加 local/cloud repository 抽象
3. `useTradePlans` 支持云端模式
4. 审计归档从 `HistoryPage` 下沉到 repository
5. 截图补账从 Mock 切换到 recognition job
6. 导入导出支持云端数据
7. 增加 PWA manifest 和离线提示

## 10. 回归清单

每次较大改动后检查：

- 创建计划
- 添加操作
- 添加复盘
- 截图补账批量归档
- 历史计划详情
- 编辑和删除时间线记录
- 刷新审计
- 归档审计
- 删除和清空审计归档
- 导出 JSON
- 导入 JSON
- 手机宽度无横向溢出

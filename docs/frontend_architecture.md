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
- `Toast`

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
- 云端备份状态、预览、冲突处理和失败重试

### lib

数据模型、数据处理和本地状态。

- `types.ts`：核心 TypeScript 类型
- `use-trade-plans.ts`：本地计划状态管理
- `trade-repository.ts`：本地计划 repository 与完整云端 CRUD adapter
- `trade-data-file.ts`：导入导出 JSON
- `audit-summary.ts`：本地审计规则
- `audit-ai-adapter.ts`：AI 审计服务边界
- `audit-repository.ts`：本地与云端审计归档访问边界
- `plan-migration.ts`：旧交易记录迁移到计划模型
- `sync-state.ts`：同步基线指纹、冲突判断和无损合并
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

审计归档状态目前在 `HistoryPage` 内管理，持久化已经下沉到 repository：

- localStorage key：`rationaltrade.auditReports.v1`
- `localAuditRepository` 保持现有本地行为
- `cloudAuditRepository` 已支持读取、归档和确认删除
- 页面尚未自动切换云端数据源

云端备份元数据使用独立 localStorage key：

- `rationaltrade.cloudSync.v1`
- 只保存同步指纹、成功时间和方向
- 不保存计划正文、数据库地址或任何 Token

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

## 7.1 云端同步入口

历史页新增云端同步卡片。

当前行为：

- 展示数据库、AI、COS 是否已配置。
- 可刷新 `/api/system/status?db=1`。
- 数据库、单用户 ID 和连接状态通过后，允许上传当前本地数据。
- 上传使用 `POST /api/sync/import-local`。
- 明确显示“本地编辑，确认后同步到 PostgreSQL”。
- 可读取云端计划和审计归档并先展示数量预览。
- 只有用户再次确认后，才会把云端数据下载为当前本地工作副本。
- 显示未建立基线、存在本地修改、已同步和失败状态。
- 上传前读取云端并比较同步基线，云端变化时暂停上传。
- 冲突时可下载云端替换本地，或合并后上传；同 ID 以本地版本为准，云端独有记录保留。
- 状态、预览和上传失败后可直接重试。
- 当前不做实时双向同步，也不会自动拉取或覆盖本地数据。

设计原则：

- 云端未配置时给明确状态，不让用户误以为上传成功。
- 上传前必须二次确认。
- 云端下载替换前必须展示计划、操作、复盘、审计数量，并再次确认。
- 第一轮只做明确的上传和下载，不做复杂双向同步。
- 当前批量上传是 upsert，不隐式删除云端独有记录；删除同步留给后续显式云端模式。
- 旧版观察记录在读取和上传边界统一移除数量字段，避免历史数据违反当前规则。

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
2. 把 `useTradePlans` 改为异步 mutation 状态，消费现有 cloud repository
3. 在删除同步和账号体系完成后，再开放实时云端编辑模式
4. 把审计归档状态完全下沉到 hook
5. 截图补账从 Mock 切换到 recognition job
6. 增加服务端云端导出
7. 增加 PWA manifest 和离线提示

## 9.1 发布到腾讯云前的前端检查

每次发布前本地检查：

```bash
pnpm typecheck
pnpm build
pnpm dev --hostname 0.0.0.0
```

浏览器检查：

- H5 首屏能打开
- 记录和历史两个 tab 能切换
- 表单错误状态清晰
- 删除和清空动作有二次确认
- 审计卡默认收起次要内容
- 手机宽度无横向溢出

生产发布后检查：

- 生产域名可访问
- 静态样式正常加载
- `/api/audit` 返回正常
- 刷新页面后没有 404
- 移动端底部导航不遮挡主要按钮

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

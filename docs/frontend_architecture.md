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
- JSON 导出

## 2. 技术栈

当前使用：

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- lucide-react
- PostgreSQL（正式数据源）
- localStorage（最近成功数据缓存）
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
- 服务端连接异常提示和重试

### lib

数据模型、数据处理和客户端状态。

- `types.ts`：核心 TypeScript 类型
- `use-trade-plans.ts`：服务端优先的计划状态管理
- `trade-repository.ts`：服务端 CRUD adapter 与浏览器缓存 repository
- `trade-data-file.ts`：导入导出 JSON
- `audit-summary.ts`：本地审计规则
- `audit-ai-adapter.ts`：AI 审计服务边界
- `audit-repository.ts`：本地与云端审计归档访问边界
- `plan-migration.ts`：旧交易记录迁移到计划模型
- `sample-data.ts`：示例数据

## 4. 状态管理

当前使用 React state + PostgreSQL API，localStorage 只保留最近一次成功缓存。

核心 hook：

- `useTradePlans`

负责：

- 优先加载服务端 plans
- 服务端不可用时展示最近成功缓存和明确错误
- 创建计划
- 更新计划
- 删除计划
- 添加操作
- 添加复盘
- 所有写操作等待服务端成功后才更新 React state 和 localStorage 缓存
- 写入期间锁定相关操作，失败时保留表单和原数据

审计归档状态目前在 `HistoryPage` 内管理，持久化已经下沉到 repository：

- localStorage key：`rationaltrade.auditReports.v1`
- `cloudAuditRepository` 负责读取、归档和确认删除
- `localAuditRepository` 只缓存最近一次成功读取的归档
- 用户界面不提供“本地/云端”模式切换

## 5. 数据流

### 手动记录

`RecordPage`
↓
`PlanOperationForm` 或 `PlanReviewForm`
↓
`useTradePlans.addOperation/addReview`
↓
等待 PostgreSQL API 成功
↓
更新 React state 与 localStorage 缓存
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
等待 PostgreSQL API 逐项成功后更新界面

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

## 7.1 服务端保存约定

- 正式界面不展示云端同步卡片、工作模式或数据库迁移工具。
- HTTP 请求在技术上仍是异步调用，但用户交互采用阻塞式服务端优先流程。
- 计划、操作、复盘和审计归档的新增、修改、删除均等待 API 成功后再更新页面。
- 计划详情及时间线修改通过单个事务快照请求提交，避免多请求产生部分成功。
- 请求中按钮显示进行中状态并禁止重复提交。
- 失败时不清空表单、不关闭编辑态、不删除当前界面数据。
- `POST /api/sync/import-local` 仅供首次迁移和运维使用，不是普通用户功能。
- 云端创建保留客户端 ID，重复提交同一 ID 不制造重复记录。
- 当前不做多设备实时协作；启动时会读取服务端权威数据。

设计原则：

- 服务端不可用时给明确状态，不让用户误以为保存成功。
- 所有删除仍需用户二次确认，并通过显式 DELETE API 执行。
- 运维批量导入是 upsert，不隐式删除服务端独有记录。
- 旧版观察记录在读取和导入边界统一移除数量字段，避免历史数据违反当前规则。

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
2. 为正式多设备场景增加服务端版本号或 ETag 冲突控制
3. 完成账号体系后，把当前单用户数据源升级为正式用户工作区
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
- 删除动作有二次确认
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
- 手机宽度无横向溢出

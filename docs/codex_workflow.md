# Codex 工作流说明

## 一、总体原则

Codex 需要先理解产品，再写代码。

不要直接让 Codex “按照设计稿实现整个 App”。

每次任务都应明确：

- 当前 Phase
- 当前页面
- 是否允许接后端
- 是否允许使用 Mock 数据
- 是否允许实现 AI
- 哪些功能必须推迟

## 二、推荐工作流

### Step 1：整体评审

先让 Codex 阅读：

- `docs/PROJECT_BRIEF.md`
- `docs/ROADMAP.md`
- `docs/DESIGN_REFERENCE.md`
- `docs/AI_BOUNDARY.md`
- `AGENTS.md`

然后查看三期设计稿。

要求 Codex 只评审，不写代码。

### Step 2：Phase 1 页面骨架

只实现：

- 移动端 App Shell
- Bottom Tab Bar
- 记录决策页
- 决策历史与审计页
- 示例数据

不接 Supabase，不接 AI API。

### Step 3：Phase 1 表单与状态

实现：

- 手动记录表单
- AI 批量识别 Mock 列表
- 空状态 / 完整数据态切换
- 本地状态保存

### Step 4：数据模型

定义：

- Transaction
- AIReview
- AuditReport
- TradingRule
- ErrorTag

先在 TypeScript 类型中定义，再决定是否接 Supabase。

### Step 5：接 Supabase

实现：

- 数据库表
- 新增记录
- 查询历史记录
- 文件上传
- 示例数据

### Step 6：接 AI

先接：

- 单笔交易复盘
- 近 30 天聚合审计

再考虑：

- OCR
- 错题本归因
- 军规审计

## 三、每次给 Codex 的任务模板

每次任务都应该包含：

1. 当前阶段
2. 本轮目标
3. 明确不做什么
4. 使用哪些设计稿
5. 是否使用 Mock 数据
6. 技术要求
7. 输出要求

## 四、禁止的任务方式

不要这样问：

- “把这个 App 做出来”
- “按照设计稿全部实现”
- “顺便把后端也接上”
- “你看着办”
- “把三期都做了”

## 五、推荐的任务方式

应该这样问：

- “当前只做 Phase 1 的页面骨架”
- “只使用 Mock 数据”
- “不要接 Supabase”
- “不要接 AI API”
- “不要实现 Phase 2 和 Phase 3”
- “先说明改哪些文件，再写代码”

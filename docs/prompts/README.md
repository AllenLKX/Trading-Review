# AI Prompt 维护说明

本目录是 RationalTrade 运行时 Prompt 的唯一内容来源。

## 文件

- `audit_system.md`：DeepSeek 周期行为审计的 system message。
- `audit_user.md`：DeepSeek 周期行为审计的 user message 模板。

## 修改规则

1. Prompt 文案只在本目录修改，不在 TypeScript 中复制一份。
2. `audit_user.md` 必须且只能保留一个 `{{AUDIT_INPUT_JSON}}` 占位符，运行时会注入审计 JSON。
3. 输出字段必须继续满足 `summary`、`signalLabel`、`signalLevel`、`findings`、`reviewQuestions` 契约。
4. 不得删除投资建议边界、JSON 输出要求和样本不足约束。
5. 修改后同步记录 `docs/change_log.md`，运行 `pnpm typecheck` 和生产构建，并真实点击一次“AI 分析”。
6. 开发环境每次请求重新读取文档；生产环境首次读取后缓存在进程内，修改文档后需要重启 PM2。

## 数据边界

当前只向模型注入 `AuditAiRequest`：

- `schemaVersion`
- `period.start`
- `period.end`
- `inputDigest`

`inputDigest` 包含聚合统计和最多 6 条近期操作或复盘摘要，不包含数据库连接、Token 或服务端环境变量。

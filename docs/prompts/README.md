# AI Prompt 维护说明

本目录是 RationalTrade 运行时 Prompt 的唯一内容来源。

## 文件

- `audit_system.md`：DeepSeek 周期行为审计的 system message。
- `audit_user.md`：DeepSeek 周期行为审计的 user message 模板。
- `audit_manifest.json`：Prompt 名称与版本；修改任一 Prompt 时必须提升 `version`。
- `vision_system.md`：Kimi K3 原图忠实转写规则。
- `vision_user.md`：Kimi K3 转写 user message 模板。
- `vision_manifest.json`：Kimi K3 转写 Prompt 版本。
- `recognition_system.md`：DeepSeek 将转写文本结构化为交易的规则。
- `recognition_user.md`：截图识别 user message 模板。
- `recognition_manifest.json`：截图识别 Prompt 版本。

## 修改规则

1. Prompt 文案只在本目录修改，不在 TypeScript 中复制一份。
2. `audit_user.md` 必须且只能保留一个 `{{AUDIT_INPUT_JSON}}` 占位符，运行时会注入审计 JSON。
3. 输出字段必须继续满足 `summary`、`signalLabel`、`signalLevel`、`findings`、`reviewQuestions` 契约。
4. 不得删除投资建议边界、JSON 输出要求和样本不足约束。
5. 修改后同步记录 `docs/change_log.md`，运行 `pnpm typecheck` 和生产构建，并真实点击一次“AI 分析”。
6. 开发环境每次请求重新读取文档；生产环境首次读取后缓存在进程内，修改文档后需要重启 PM2。
7. Prompt 内容发生变化时同步更新 `audit_manifest.json` 的 `version`，归档会保存该版本用于追溯。
8. Kimi 转写 Prompt 使用 `{{SOURCE_IMAGE_NAME}}` 占位符；修改后提升 `vision_manifest.json` 版本。
9. DeepSeek 结构化 Prompt 使用 `{{OCR_INPUT_JSON}}` 占位符；修改后提升 `recognition_manifest.json` 版本。
10. 任一截图 Prompt 变更都必须用真实截图同时回归转写和最终交易列表。

## 数据边界

当前只向模型注入 `AuditAiRequest`：

- `schemaVersion`
- `period.start`
- `period.end`
- `inputDigest`

`inputDigest` 包含聚合统计和最多 6 条近期操作或复盘摘要，不包含数据库连接、Token 或服务端环境变量。

截图识别链路先由 Kimi K3 接收原图并输出顺序转写，DeepSeek 只接收转写文本、置信度、顺序和原文件名，不接收原图、数据库连接或服务端密钥。原图在请求内存中处理后丢弃，不写入交易记录。

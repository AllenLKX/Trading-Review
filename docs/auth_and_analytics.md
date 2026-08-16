# 账号、会话与运营数据

## 1. 当前能力

- 邮箱和密码注册、登录、退出。
- 暂不发送验证邮件，不提供找回密码。
- 密码使用服务端 scrypt 加盐哈希，数据库不保存明文。
- 登录使用 7 天有效的签名 HttpOnly 持久 Cookie；刷新和重开浏览器保持登录，会话同时写入 PostgreSQL，可在退出时立即撤销。
- 计划、操作、复盘和审计归档继续按 `user_id` 隔离。
- 页面曝光、登录注册、业务写入和 AI 审计调用写入 `app_events`。
- 登录页漏斗按浏览器匿名 ID 去重，可查询看到登录页后截至查询时仍未注册或登录的人数。
- 分享链接支持 `?adtag=渠道名`，可按来源查看 PV、UV、注册和登录。

## 2. 生产迁移顺序

现有云端数据属于 `RATIONALTRADE_SINGLE_USER_ID`。不能直接开放注册后让第一个账号接管数据，必须先初始化 owner：

```bash
cd /var/www/rationaltrade
./scripts/configure-auth.sh prepare .env.production
set -a && source .env.production && set +a
./scripts/apply-schema.sh
./scripts/bootstrap-owner-account.sh .env.production
./scripts/configure-auth.sh enable .env.production
pnpm build
APP_VERSION="$(git rev-parse --short HEAD)" pm2 restart rationaltrade --update-env
pm2 save
```

`bootstrap-owner-account.sh` 在终端静默读取密码，密码不会进入参数、命令历史、Git 或聊天。该命令会把 owner 邮箱绑定到已有 profile，保留原计划、操作、复盘和审计归档，并撤销该账号的旧会话。

认证模式从 `basic` 切换到 `session` 后必须重新执行 `pnpm build`，不能只重启 PM2。

## 3. 注册边界

`AUTH_ALLOW_REGISTRATION=true` 时允许任何人创建独立账号。当前不验证邮箱所有权，因此邮箱只作为登录标识，不能用于找回密码或安全通知。需要暂停新增用户时改为 `false` 并重新构建发布。

当前单进程内限制同一来源 15 分钟最多 10 次登录尝试、每小时最多 5 次注册尝试。该限流适合当前单机小流量阶段；扩展到多实例时改为 Redis 或 Nginx 共享限流。

## 4. 事件数据

`app_events` 保存：

- `page_view`：PV、UV 和页面路径。
- `auth_registered`、`auth_login_succeeded`、`auth_login_failed`、`auth_logged_out`。
- 计划、操作、复盘和审计归档的保存、修改、删除事件。
- `ai_audit_generated`：provider、model、Prompt 版本、成功/回退、耗时和 token 用量。
- `ai_screenshot_recognized`：Kimi 识图/DeepSeek 结构化模型、Prompt 版本、成功状态、耗时和分段 token 用量；不记录原图、转写正文或交易字段。
- `screenshot_batch_archived`：截图确认后归档的受影响计划数、新计划数和操作数；不记录交易正文或金额。

事件不保存密码、Cookie、DeepSeek Token、Prompt 正文、交易理由、心理描述、价格、金额或持仓数量。

登录和注册请求会携带与 `page_view` 相同的随机匿名 ID，只用于关联登录页曝光与后续进入产品的结果。它不包含邮箱或设备信息，也不用于跨浏览器识别用户。

### 4.1 分享来源 `adtag`

分享时在正式网址后增加参数：

```text
https://rationaltrade.cn/?adtag=wechat
https://rationaltrade.cn/?adtag=xiaohongshu
https://rationaltrade.cn/?adtag=friend-allen
```

规则：

- 只接受中文或英文字母、数字、点、下划线和连字符，最长 64 个字符。
- 浏览器保存最近一次合法的非直接来源；没有 `adtag` 的普通访问不会清除旧来源。
- 新的合法 `adtag` 会覆盖该浏览器以前保存的来源。
- 未登录跳转到登录页时保留 `adtag`，注册和登录事件继续携带相同来源。
- 服务端只保存标签值，不保存完整查询参数、分享 URL 或页面正文。
- `adtag` 用于轻量渠道归因，不用于付费广告平台的跨设备归因或反作弊。

## 5. 按日查询

服务器执行：

```bash
cd /var/www/rationaltrade
set -a && source .env.production && set +a
pnpm report:daily -- 2026-08-16
```

默认时区是 `Asia/Shanghai`，输出 JSON 包含：

- `summary`：PV、UV、注册、成功/失败登录、AI 调用和 token 合计。
- `loginFunnel`：当日登录页去重访客、后来注册或登录的访客、截至查询时仍未进入产品的访客和对应比例。重复刷新不会增加 UV；访客以后完成注册或登录时，历史日期的“仍未进入”人数会相应减少。该漏斗从 `2026-08-16 19:56 Asia/Shanghai` 开始采集，因此当天只有部分日数据，`2026-08-17` 起才是完整自然日。
- `trafficSources`：每个 `adtag` 的 PV、UV、注册数和成功登录数。
- `eventCounts`：各类事件数量。
- `activity`：最多 300 条按时间倒序的用户流水。

暂不建设用户可见看板。需要长期运营后再增加管理员权限、筛选页面、留存策略和聚合表。

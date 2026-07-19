# RationalTrade 本地 PostgreSQL

## 用途

本地 PostgreSQL 只用于在上传腾讯云前验证真实数据库行为：

- 应用 schema
- 验证计划、操作、复盘、审计 CRUD
- 验证云端上传、预览和下载
- 复现数据库接口问题

生产数据和生产密钥不要放入本地测试库。

## 当前开发配置

- PostgreSQL 16
- 仅监听 `127.0.0.1`
- 端口 `55432`
- 数据目录：`~/Library/Application Support/RationalTrade/postgres16`
- 管理角色：`rationaltrade_admin`
- 应用角色：`rationaltrade_app`
- 本地 profile：`local-owner`

本地采用 trust 认证，只允许本机回环访问。该方式适合个人开发机，不可照搬到腾讯云生产环境。

## 首次初始化

先安装 Postgres.app 16 到 `~/Applications/Postgres.app`，然后执行：

```bash
./scripts/setup-local-db.sh
```

脚本会幂等创建集群、数据库、应用角色、schema 和本地 profile。

把脚本最后输出的两项写入被 Git 忽略的 `.env.local`：

```text
DATABASE_URL=postgresql://rationaltrade_app@127.0.0.1:55432/rationaltrade
RATIONALTRADE_SINGLE_USER_ID=local-owner
```

## 日常使用

```bash
./scripts/local-db.sh start
./scripts/local-db.sh status
./scripts/local-db.sh stop
```

启动数据库后再运行：

```bash
pnpm dev
```

检查真实连接：

```text
http://localhost:3000/api/system/status?db=1
```

开发服务运行时，可执行完整 API CRUD 检查：

```bash
pnpm verify:database
```

该脚本只使用合成数据，并在完成后调用确认删除接口清理测试记录。

## 安全边界

- `.env.local` 不提交 GitHub。
- 本地数据库不监听局域网或公网地址。
- 腾讯云必须使用密码或更强认证，不能使用 trust。
- 腾讯云安全组不能开放 PostgreSQL `5432` 给公网。

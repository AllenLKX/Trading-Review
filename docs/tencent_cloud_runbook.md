# RationalTrade 腾讯云 OpenCloudOS 部署手册

## 1. 目标

本手册用于把 RationalTrade 部署到当前腾讯云 OpenCloudOS 9.4 服务器。Ubuntu 保留为未来迁移选项，但包管理命令不同。

当前优先目标：

- 跑通 Next.js H5 和 API。
- 跑通 `/api/health` 和 `/api/system/status`。
- 准备 PostgreSQL schema。
- 为后续本地数据上传云端预留路径。

当前不做：

- 真实 AI Key 上传到 GitHub。
- 真实用户数据写入仓库。
- 复杂 CI/CD。
- 多用户注册。

当前公网联调入口暂定为 `http://43.156.228.145`。IP + HTTP 只用于首次连通性验证；Basic Auth 在 HTTP 上不能防止链路窃听，写入真实交易数据前必须改为域名 + HTTPS，或仅允许可信来源 IP/VPN 访问。

服务器已有 OpenClaw 的 Nginx 根路径配置。RationalTrade 已在 `127.0.0.1:3000` 运行，但在确认 OpenClaw 是否保留前，不覆盖 `/etc/nginx/conf.d/openclaw.conf`。

## 2. 本地发布前检查

在本地执行：

```bash
./scripts/verify-local.sh
git status --short
git push origin codex/phase-1-local-loop
```

要求：

- 执行前先停止正在运行的 `pnpm dev`。
- `pnpm typecheck` 通过。
- `pnpm build` 通过。
- `git status --short` 没有未提交改动。

## 3. 服务器基础环境

当前 OpenCloudOS 9.4 安装：

```bash
dnf install -y git curl nginx postgresql-server postgresql-contrib
postgresql-setup --initdb
systemctl enable --now postgresql nginx
```

当前服务器通过 root 的 NVM 使用 Node.js 22。执行 pnpm/PM2 前加载：

```bash
source /root/.nvm/nvm.sh
npm install -g pnpm@10 pm2
```

当前实测资源为 2 核 CPU、2GB 内存、2GB Swap、40GB 系统盘，足够私有单用户第一版。

## 4. 拉取代码

建议目录：

```bash
sudo mkdir -p /var/www
sudo chown "$USER":"$USER" /var/www
cd /var/www
git clone git@github.com:AllenLKX/Trading-Review.git rationaltrade
cd rationaltrade
git checkout codex/phase-1-local-loop
```

如果服务器尚未配置 GitHub SSH Key，需要先在服务器上创建 SSH Key，并添加到 GitHub。

## 5. 生产环境变量

复制模板：

```bash
cp .env.example .env.production
```

编辑 `.env.production`：

```bash
nano .env.production
```

必填或后续必填：

- `NEXT_PUBLIC_APP_VERSION`
- `APP_PUBLIC_ORIGIN=http://43.156.228.145`
- `APP_ACCESS_USERNAME`
- `APP_ACCESS_PASSWORD`
- `DATABASE_URL`
- `RATIONALTRADE_SINGLE_USER_ID`
- `AI_API_KEY`
- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`
- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`

注意：

- `.env.production` 不提交到 GitHub。
- 数据库密码、AI Key、COS Key 只放服务器环境变量或服务器本地文件。
- `APP_ACCESS_PASSWORD` 在服务器上执行 `openssl rand -base64 24` 生成，不在聊天、文档或 GitHub 中保存明文。
- 生产环境缺少访问用户名或密码时，除 `/api/health` 外统一返回 503，避免公网裸露业务数据。

## 6. PostgreSQL 初始化

创建数据库和初始单用户 profile：

```bash
sudo -u postgres psql
```

在 psql 中执行：

```sql
create database rationaltrade;
create user rationaltrade_app with encrypted password 'replace-this-before-running';
grant all privileges on database rationaltrade to rationaltrade_app;
\q
```

设置 `DATABASE_URL` 后执行 schema：

```bash
set -a
source .env.production
set +a
./scripts/apply-schema.sh
```

创建私有单用户 profile，并把返回的 `id` 写入 `.env.production` 的 `RATIONALTRADE_SINGLE_USER_ID`：

```bash
psql "$DATABASE_URL" -c "insert into profiles (email, display_name) values ('owner@example.com', 'Owner') returning id;"
```

## 7. 构建和启动

```bash
pnpm install --frozen-lockfile
pnpm build
pm2 start "pnpm start" --name rationaltrade
pm2 save
pm2 startup systemd -u root --hp /root
systemctl enable --now pm2-root
```

检查：

```bash
pm2 status
./scripts/check-production.sh http://localhost:3000
ss -lntp | grep ':3000'
```

生产进程必须只监听 `127.0.0.1:3000`，由 Nginx 对外提供入口。不要在腾讯云安全组开放 3000 或 5432 端口。

## 8. Nginx 反向代理

外部手机要访问服务，腾讯云需要提供一个公网入口。可先使用 CVM 公网 IP 联调，正式使用建议把域名解析到该公网 IP 并配置 HTTPS。

腾讯云安全组建议：

- 对公网开放 80 和 443。
- SSH 22 尽量只允许自己的固定 IP。
- 不对公网开放 Next.js 3000。
- 不对公网开放 PostgreSQL 5432。

仓库已提供当前 IP 对应的配置 `deploy/nginx-rationaltrade.conf`。复制并启用：

```bash
sudo cp deploy/nginx-rationaltrade.conf /etc/nginx/sites-available/rationaltrade
sudo ln -s /etc/nginx/sites-available/rationaltrade /etc/nginx/sites-enabled/rationaltrade
sudo nginx -t
sudo systemctl reload nginx
```

配置内容使用：

```nginx
server {
    listen 80;
    server_name 43.156.228.145;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 9. 发布后验证

访问：

```text
http://43.156.228.145/api/health
http://43.156.228.145/api/system/status
http://43.156.228.145/api/system/status?db=1
```

手机页面检查：

- 首页可以打开。
- 记录页与历史页可读取 PostgreSQL 数据。
- 新增或修改后刷新页面，记录仍然存在。
- 数据库不可用时显示缓存状态，写操作不会提示成功。
- 首次打开会出现 RationalTrade 的用户名和密码提示；取消或输入错误时不能读取页面和业务 API。
- `/api/health` 保持公开，供 Nginx、PM2 和腾讯云健康检查使用，不读取业务数据。

临时访问用户名和密码只存放在服务器：

```bash
cat /root/rationaltrade-access.txt
```

该文件权限必须为 `600`，不得复制进仓库。

## 9.1 2026-07-19 首次部署状态

- 代码目录：`/var/www/rationaltrade`
- 部署分支：`codex/phase-1-local-loop`
- 已部署 commit：`a81d2a4`
- PostgreSQL 15：已启动并设置开机启动
- PM2 `rationaltrade`：已在线并保存进程列表
- PM2 systemd 服务：已启用并启动，服务器重启后自动恢复
- Next.js：仅监听 `127.0.0.1:3000`
- 内部健康检查：200
- 无认证业务 API：401
- 正确认证业务 API：200
- 数据库事务 CRUD：通过，合成测试数据已清理
- 公网 Nginx：等待确认 OpenClaw 路由归属

## 10. 后续发布

本地：

```bash
./scripts/verify-local.sh
git push origin codex/phase-1-local-loop
```

服务器：

```bash
cd /var/www/rationaltrade
source /root/.nvm/nvm.sh
git pull origin codex/phase-1-local-loop
pnpm install --frozen-lockfile
pnpm build
pm2 restart rationaltrade
./scripts/check-production.sh http://localhost:3000
```

## 11. 回滚

发布前记录当前 commit：

```bash
git rev-parse HEAD
```

如果发布后出问题：

```bash
cd /var/www/rationaltrade
git checkout LAST_GOOD_COMMIT
pnpm install --frozen-lockfile
pnpm build
pm2 restart rationaltrade
./scripts/check-production.sh http://localhost:3000
```

## 12. 迁移到新服务器

如果当前服务器性能不够：

1. 新建更高配置腾讯云 CVM。
2. 安装同样的 Node.js、pnpm、Nginx、PM2、PostgreSQL；新服务器可以继续使用 OpenCloudOS，也可以迁移到 Ubuntu。
3. 从旧服务器备份 PostgreSQL。
4. 在新服务器恢复数据库。
5. 复制 `.env.production`，确认密钥文件不进入 Git。
6. 拉取同一 commit。
7. 构建启动。
8. 用 `/api/health` 和 `/api/system/status?db=1` 验证。
9. 切换域名 DNS 或负载入口。
10. 旧服务器保留 24-72 小时用于回滚。

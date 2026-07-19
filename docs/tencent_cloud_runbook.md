# RationalTrade 腾讯云 Ubuntu 部署手册

## 1. 目标

本手册用于第一次把 RationalTrade 部署到腾讯云 Ubuntu 服务器。

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

腾讯云 Ubuntu 建议先安装：

```bash
sudo apt update
sudo apt install -y git curl nginx postgresql postgresql-contrib
```

安装 Node.js LTS 和 pnpm：

```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable
corepack prepare pnpm@latest --activate
```

安装 PM2：

```bash
sudo npm install -g pm2
```

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
```

检查：

```bash
pm2 status
./scripts/check-production.sh http://localhost:3000
```

## 8. Nginx 反向代理

新建配置：

```bash
sudo nano /etc/nginx/sites-available/rationaltrade
```

示例：

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_SERVER_IP;

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

启用：

```bash
sudo ln -s /etc/nginx/sites-available/rationaltrade /etc/nginx/sites-enabled/rationaltrade
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 发布后验证

访问：

```text
http://YOUR_DOMAIN_OR_SERVER_IP/api/health
http://YOUR_DOMAIN_OR_SERVER_IP/api/system/status
http://YOUR_DOMAIN_OR_SERVER_IP/api/system/status?db=1
```

手机页面检查：

- 首页可以打开。
- 历史页云端同步卡片可见。
- 数据库配置完成后，状态显示可用。
- 未配置 AI/COS 时只显示未配置，不影响页面。

## 10. 后续发布

本地：

```bash
./scripts/verify-local.sh
git push origin codex/phase-1-local-loop
```

服务器：

```bash
cd /var/www/rationaltrade
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
2. 安装同样的 Node.js、pnpm、Nginx、PM2、PostgreSQL。
3. 从旧服务器备份 PostgreSQL。
4. 在新服务器恢复数据库。
5. 复制 `.env.production`，确认密钥文件不进入 Git。
6. 拉取同一 commit。
7. 构建启动。
8. 用 `/api/health` 和 `/api/system/status?db=1` 验证。
9. 切换域名 DNS 或负载入口。
10. 旧服务器保留 24-72 小时用于回滚。

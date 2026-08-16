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

正式域名为 `rationaltrade.cn`，解析到 `43.156.228.145`。服务器位于腾讯云 `ap-singapore-1`，域名与 HTTPS 生效前不通过公网写入真实交易数据。

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

编辑 `.env.production`（服务器没有 `nano` 时使用 `vi`）：

```bash
vi .env.production
```

必填或后续必填：

- `NEXT_PUBLIC_APP_VERSION`
- `APP_PUBLIC_ORIGIN=https://rationaltrade.cn`
- `APP_ACCESS_USERNAME`
- `APP_ACCESS_PASSWORD`
- `DATABASE_URL`
- `RATIONALTRADE_SINGLE_USER_ID`
- `DEEPSEEK_API_KEY`
- `AI_BASE_URL=https://api.deepseek.com`
- `AI_MODEL=deepseek-v4-flash`
- `AI_TIMEOUT_MS=20000`
- `VISION_AI_API_KEY`
- `VISION_AI_BASE_URL=https://tokenhub.tencentmaas.com/v1`
- `VISION_AI_MODEL=kimi-k3`
- `VISION_AI_TIMEOUT_MS=120000`
- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`
- `TENCENT_COS_BUCKET`
- `TENCENT_COS_REGION`

注意：

- `.env.production` 不提交到 GitHub。
- 数据库密码、DeepSeek Key、Kimi 识图 Key、COS Key 只放服务器环境变量或服务器本地文件。
- `APP_ACCESS_PASSWORD` 在服务器上执行 `openssl rand -base64 24` 生成，不在聊天、文档或 GitHub 中保存明文。
- 生产环境缺少访问用户名或密码时，除 `/api/health` 外统一返回 503，避免公网裸露业务数据。

DeepSeek Key 可在服务器代码目录中交互配置，输入内容不会回显：

```bash
cd /var/www/rationaltrade
./scripts/configure-deepseek.sh .env.production
source /root/.nvm/nvm.sh
pm2 restart rationaltrade --update-env
```

随后访问 `/api/system/status`，确认 `integrations.ai.configured` 为 `true`；再在历史页点击“AI 分析”，成功时会显示 DeepSeek 更新 Toast。

截图补账使用腾讯 TokenHub 中的 Kimi K3，与 DeepSeek 使用不同 Key。服务器中静默配置：

```bash
cd /var/www/rationaltrade
./scripts/configure-vision-ai.sh .env.production
source /root/.nvm/nvm.sh
pm2 restart rationaltrade --update-env
```

配置后访问 `/api/system/status`，确认 `integrations.vision.configured` 为 `true`且 `model` 为 `kimi-k3`。Key 只进入权限为 `600` 的服务器环境文件，不提交 GitHub。脚本会自动正确分行，避免手工编辑时把多个变量粘到一行。

生产 Prompt 位于服务器仓库的 `docs/prompts/`。修改并发布 Prompt 文档后必须执行：

```bash
cd /var/www/rationaltrade
source /root/.nvm/nvm.sh
git pull origin codex/phase-1-local-loop
pm2 restart rationaltrade --update-env
```

Prompt 在每个生产进程首次调用时读取并缓存；不需要把 Prompt 放入 `.env.production`，也不允许放到前端。

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

外部手机、浏览器和未来套壳 App 共用 `https://rationaltrade.cn`。前端与 `/api/*` 保持同源，暂不拆分独立 API 域名。

腾讯云安全组建议：

- 对公网开放 80 和 443。
- SSH 22 尽量只允许自己的固定 IP。
- 不对公网开放 Next.js 3000。
- 不对公网开放 PostgreSQL 5432。

家庭宽带和移动网络公网 IP 会变化，因此当前 SSH 22 保持公网可达，但服务器使用 `deploy/sshd-rationaltrade.conf` 禁止密码登录，只接受已授权 SSH Key。`PermitRootLogin prohibit-password` 不影响腾讯云 VNC/救援终端使用 root 密码。

部署 SSH 加固：

```bash
install -o root -g root -m 600 deploy/sshd-rationaltrade.conf /etc/ssh/sshd_config.d/00-rationaltrade.conf
rm -f /etc/ssh/sshd_config.d/99-rationaltrade.conf
sshd -t
systemctl reload sshd
sshd -T | grep -E '^(pubkeyauthentication|passwordauthentication|kbdinteractiveauthentication|permitrootlogin|maxauthtries) '
```

OpenCloudOS 的 `50-cloud-init.conf` 默认包含 `PasswordAuthentication yes`。OpenSSH 对多数全局指令采用首个值，因此本项目配置必须使用 `00-` 前缀，不能放在 `99-`。

reload 后必须从另一条终端实际完成一次密钥登录，再保留配置；不要在未验证 SSH Key 时关闭当前会话。

DNSPod 免费解析添加：

- `@`：A 记录，值为 `43.156.228.145`，默认线路，TTL 600。
- `www`：CNAME 记录，值为 `rationaltrade.cn`，默认线路，TTL 600。

仓库已提供域名配置 `deploy/nginx-rationaltrade.conf`。OpenCloudOS 复制并启用：

```bash
cp deploy/nginx-rationaltrade.conf /etc/nginx/conf.d/rationaltrade.conf
nginx -t
systemctl reload nginx
```

配置内容使用：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name rationaltrade.cn www.rationaltrade.cn;

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

DNS 生效且 HTTP 健康检查通过后，使用 Certbot 为根域名和 `www` 签发免费证书，并开启 HTTP 到 HTTPS 跳转。证书申请不要早于 DNS 生效，否则会因域名验证失败。

## 9. 发布后验证

访问：

```text
https://rationaltrade.cn/api/health
https://rationaltrade.cn/api/system/status
https://rationaltrade.cn/api/system/status?db=1
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
- 首次部署 commit：`a81d2a4`
- 当前运行 commit：以服务器 `/var/www/rationaltrade` 的 `git rev-parse --short HEAD` 为准
- PostgreSQL 15：已启动并设置开机启动
- PM2 `rationaltrade`：已在线并保存进程列表
- PM2 systemd 服务：已启用并启动，服务器重启后自动恢复
- Next.js：仅监听 `127.0.0.1:3000`
- 内部健康检查：200
- 无认证业务 API：401
- 正确认证业务 API：200
- 数据库事务 CRUD：通过，合成测试数据已清理
- DeepSeek：服务器密钥已配置，`deepseek-v4-flash` 内部真实调用通过
- 云端业务数据：已迁移 8 个计划、10 条操作、6 条复盘和 3 条审计归档，复盘引用无断链
- 域名：`rationaltrade.cn` 已购买，等待 DNS 记录生效和 HTTPS 签发
- 公网 Nginx：域名 Host 独立路由到 RationalTrade，原有 IP 路由继续保留给 OpenClaw
- Certbot 2.8 与 Nginx 插件：已安装
- 域名 HTTP Host 内部验证：健康检查 200，未认证业务 API 401
- HTTPS：`rationaltrade.cn` 与 `www.rationaltrade.cn` 已签发 ECDSA 证书，HTTP 自动 301 跳转 HTTPS
- 当前证书有效期至 2026-11-14，`certbot-renew.timer` 已启用，续期演练通过
- 正式环境 `APP_PUBLIC_ORIGIN` 已切换为 `https://rationaltrade.cn`

## 10. 后续发布

首次从 Basic Auth 切换到邮箱密码登录前，严格执行 `docs/auth_and_analytics.md` 的 owner 初始化顺序。owner 密码只在服务器终端输入。

2026-08-16 当前状态：owner 已初始化，`AUTH_MODE=session` 与公开注册已启用。未登录根路径跳转 `https://rationaltrade.cn/login`，业务 API 无会话返回 401；owner 历史数据、新账号隔离、会话撤销、PV/UV 和 AI token 日报均已通过生产验证。

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
set -a
source .env.production
set +a
./scripts/apply-schema.sh
pnpm build
APP_VERSION="$(git rev-parse --short HEAD)" pm2 restart rationaltrade --update-env
./scripts/check-production.sh http://localhost:3000
pm2 save
```

通过非交互 SSH 自动发布时，命令需要由 `bash -lc` 执行，或显式 `source /root/.nvm/nvm.sh`，否则 shell 可能找不到 `pnpm`。健康检查会等待最多 30 秒，覆盖 PM2 重启后的正常启动窗口；`APP_VERSION` 由当前 Git commit 自动注入，便于确认发布版本。

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

# RationalTrade 网页发布检查清单

## 1. 当前交付边界

- 当前发布物是响应式 H5/PWA。
- 本轮不创建 Android、iOS 或 Capacitor 原生壳。
- 正式页面与 API 共用 `https://rationaltrade.cn`。
- Service Worker 只缓存离线提示页，不缓存业务页面、API 响应或交易数据。

## 2. 本地自动验证

生产构建前停止 `pnpm dev`，避免开发服务和构建同时写入 `.next`。

```bash
./scripts/verify-local.sh
pnpm verify:auth
pnpm verify:analytics
pnpm verify:database
```

真实 AI 全链路只在需要确认模型或 Prompt 变更时运行，避免日常重复计费：

```bash
pnpm verify:ai-workflow -- http://127.0.0.1:3000 /absolute/path/to/trade-screenshot.png
```

## 3. 移动浏览器兼容性

至少检查以下 CSS 视口：

- iPhone SE：`375x667`
- 现代 iPhone：`390x844`
- 紧凑 Android：`360x800`
- 大屏 Android：`412x915`

每个视口确认：

- 页面没有横向滚动。
- Sticky Header 和 Bottom Tab Bar 宽度正确。
- 底部导航、截图固定按钮和 Toast 不互相遮挡。
- 表单字号至少 16px，iOS 聚焦输入框不会自动放大。
- 设置弹层完整位于视口内，邮箱长文本可以换行。
- 日间和黑夜模式都可读，刷新后保持选择。
- 浏览器缩放未被禁用。

## 4. 状态与失败路径

- 初次载入只显示加载状态，不闪现示例计划或示例审计。
- 新账号显示真实空状态，可以创建第一个计划。
- 已打开页面断网后显示全局离线提示。
- API 读取失败时只显示本浏览器最近一次成功缓存。
- 创建、编辑、归档失败时保留用户输入和当前编辑态。
- 删除和清空仍要求二次确认。
- 离线导航进入静态离线页，页面不声称业务数据已保存。

## 5. 发布后冒烟

```bash
./scripts/check-production.sh https://rationaltrade.cn
```

随后人工确认：

- 注册、登录、刷新保持会话、退出后重新登录。
- 创建计划，添加操作和独立复盘。
- 历史详情、编辑、删除和 JSON 导出。
- 截图补账识别、人工确认和事务归档。
- DeepSeek 审计、归档和 Toast。
- `/api/health` 返回本次部署 commit。
- CSS、图标、manifest、Service Worker 和离线页均为 200。

## 6. 真机限制

桌面移动视口可以发现布局、溢出、字号和多数交互问题，但不能完全替代真机 Safari 对键盘、相册上传、安装到主屏幕和内存压力的验证。正式公开分享前，至少用一台 iPhone Safari 和一台 Android Chrome 完成一次最短冒烟；这不阻塞当前网页开发与部署。

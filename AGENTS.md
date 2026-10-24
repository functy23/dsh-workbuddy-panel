# AGENTS.md

给在本仓库里工作的 AI 代理（以及未来的自己）的说明。项目是 **DSH 插件**：把一个本地 `workbuddy2api` 网关托管进 DeepSeek Harness。

## 这是什么

- 插件名 **dsh-workbuddy-panel**，分两半：host（`src/*.ts`，跑在 DSH 主进程）与 client（`src/client/*.tsx`，打包成 `lib/client.js` 由浏览器加载）。
- host 半负责：拉起/监督网关进程、读网关 HTTP API、把模型目录注册成 pi-ai provider、暴露两个 loopback 路由。
- client 半负责：设置页四个分区（概览 / 账号 / 模型 / 网关进程）、账号表格、添加账号弹窗、composer 额度徽章。

## 命令

    pnpm run build        # 必须通过：tsdown（host ESM + client CJS）
    pnpm run typecheck    # 两个 tsconfig 都要干净
    pnpm run test         # vitest，当前 16 个用例

提交前这三条必须全绿。不要提交 `node_modules`；`lib/` 会被提交（装插件的人要能直接用）。

## 目录地图

    src/supervisor.ts   进程生命周期（spawn / 重启 / 健康探测 / 日志环）
    src/service.ts      所有可变状态；status() 是唯一投影入口
    src/routes.ts       /plugins/workbuddy2api-gateway/{status,action,client-hello}
    src/catalog.ts      目录合并 + 覆盖层 + 稳定排序（id 升序）
    src/usage.ts        网关用量账本 → 按天聚合
    src/client/         UI；ui-rows.tsx / ui-styles.ts 是视觉基础
    tests/              服务端单测 + SSR 渲染测试 + primitives 测试替身

## 硬性约定

1. **不碰宿主**：不修改 DSH 的安装目录、不 patch 宿主 bundle。宿主没给的位（比如设置导航图标）用"打标记 + 自己的 CSS"实现。
2. **不引运行时依赖**：QR 编码器是手写的（`qr-code.ts`），不要换成 npm 包；UI 原子来自宿主 seed 模块。
3. **一个事实一个来源**：进程状态只在 `supervisor`，目录只在 `service`，UI 只读 `status()`，不要在组件里自己算业务状态。
4. **失败要保留上一份数据**：网关读失败时目录不能清空（正在跑的会话依赖它）。
5. **所有写操作走 `action` 路由**，带 controlKey；`status` 保持只读。
6. **文案**：中文与英文同时加进 `client/copy.ts`（`ZH` 与 `EN` 键必须一一对应），不要硬编码中文。

## 视觉约定

- 颜色只用 `--dsw-alias-*` 令牌；不要写死颜色（热力图墨色是 `var(--dsw-alias-brand-primary)`，坑过两次）。
- 卡片无描边、圆角 12px；卡片内容上下内边距 10px；卡片之间靠容器 `gap:16px`（`.cs-pageBody`），不要用 margin。
- 分段控件是 claude-style 的 pill：轨道 `#ffffff14`、滑块 `#ffffff24` + `translateX` 过渡；不要在选中项上另刷背景。
- 页面切换动画：进入 `+8px → 0`、退出镜像，带 `blur(3px)`，`.25s/.12s`，缓动 `cubic-bezier(.22,1,.36,1)`。

## 发版

    git tag v0.1.0 && git push --tags
    gh release create v0.1.0 --title v0.1.0 --notes "..."

版本号写在 `package.json`；`tsdown` 通过 `define` 把它注入 `src/version.ts`，UI 上的版本徽章读的是同一个值。

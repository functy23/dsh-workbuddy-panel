# AGENTS.md

给在本仓库里工作的 AI 代理（以及未来的自己）的说明。项目是 **DSH 插件**：把一个本地 `workbuddy2api` 网关托管进 DeepSeek Harness。

## 这是什么

- 插件名 **dsh-workbuddy-panel**，分三层：host gateway row（`src/gateway.ts`，服务端缓存 + `ctx.subprocess` 托管）、host panel row（`src/index.ts`，pi-ai provider + 目录 + 路由）、client（`src/client/*.tsx`，打包成 `lib/client.js`）。
- host gateway row 负责：下载/校验服务端、生成网关配置、通过 `ctx.subprocess` 拉起/停止/重启进程、暴露 `workbuddy2apiGateway` 服务。
- host panel row 负责：读 `GatewayHost` 服务、读网关 HTTP API、把模型目录注册成 pi-ai provider、暴露两个 loopback 路由。它不 import `node:child_process`。
- client 半负责：设置页四个分区（概览 / 账号 / 模型 / 网关进程）、服务端下载卡、账号表格、添加账号弹窗、composer 额度徽章。

## 命令

    pnpm run build        # 必须通过：tsdown（host ESM + client CJS）
    pnpm run typecheck    # 两个 tsconfig 都要干净
    pnpm run test         # vitest，当前 49 个用例

提交前这三条必须全绿。不要提交 `node_modules`；`lib/` 会被提交（装插件的人要能直接用）。

## 目录地图

    src/gateway.ts              host gateway row：服务端缓存 + ctx.subprocess 生命周期
    src/gateway-supervisor.ts  进程状态机（spawn / 重启 / 健康探测 / 日志环）
    src/gateway-contract.ts    host row 与 panel row 的共享状态/服务接口
    src/server-release.ts      server.json 解析、平台映射、Release URL
    src/server-store.ts        gzip 下载、SHA-256、原子安装、缓存指针
    src/service.ts             所有可变状态；status() 是唯一投影入口
    src/routes.ts              /plugins/workbuddy2api-gateway/{status,action,client-hello}
    src/catalog.ts             目录合并 + 覆盖层 + 稳定排序（id 升序）
    src/usage.ts               网关用量账本 → 按天聚合
    src/client/                UI；ui-rows.tsx / ui-styles.ts 是视觉基础
    tests/                     服务端单测 + SSR 渲染测试 + primitives 测试替身
    server.json                固定服务端版本/资产/SHA-256（唯一版本来源）
    scripts/                   服务端构建 / manifest / 本地缓存安装脚本，不进发布包
    bin/workbuddy2api          本地开发二进制，只用于生成 manifest / 本地安装；不进 npm 包
    upstream/                  上游源码快照，只作对照阅读；发布包不含它

## 硬性约定

0. **服务端只有一个来源**：`server.json` 里的固定版本 + 每个平台的 SHA-256，加上 `~/.dsh/workbuddy2api-gateway/server/<version>/<platform>/` 的校验缓存。不要恢复 PATH / 目录探测或"可配置路径"；`bin/workbuddy2api` 只是本地开发二进制，用来生成 manifest 和填充本地缓存，**不进 npm 包**。要换版本就发新的 server Release、更新 `server.json`，再发面板。
1. **upstream/ 是只读快照**：不要在那里改网关逻辑。
2. **不碰宿主**：不修改 DSH 的安装目录、不 patch 宿主 bundle。宿主没给的位（比如设置导航图标）用"打标记 + 自己的 CSS"实现。
3. **不引运行时依赖**：QR 编码器是手写的（`qr-code.ts`），不要换成 npm 包；UI 原子来自宿主 seed 模块。唯一例外见下一条。
4. **pi-ai 必须自带，不许退回 peer**：`@earendil-works/pi-ai` 在 `dependencies` 里**精确钉死**一个版本。peer-only 在 `nodeLinker: hoisted` + `autoInstallPeers: false` 的 profile 里没有自己的依赖边，会解析到别的插件留在根目录的旧副本——`0.82.1` 那次 `PI_AI_ERROR` 就是这么来的（`estimateMessageTokens` 没有 `system` 分支）。换代际只改 `package.json` 里那一个版本号；`src/pi-ai-version.ts` 的 `MIN_PI_AI_VERSION` 是最低可运行代际，不是钉的版本。
5. **一个事实一个来源**：进程/服务端状态只在 host gateway row（`GatewayHost` 服务），目录只在 `service`，UI 只读 `status()`，不要在组件里自己算业务状态。
6. **失败要保留上一份数据**：网关读失败时目录不能清空（正在跑的会话依赖它）。
7. **所有写操作走 `action` 路由**，带 controlKey；`status` 保持只读。
8. **文案**：中文与英文同时加进 `client/copy.ts`（`ZH` 与 `EN` 键必须一一对应），不要硬编码中文。
9. **panel 不 spawn**：`src/index.ts` / `src/service.ts` / `src/client/` 不得 import `node:child_process`；进程只能由 host gateway row 通过 `ctx.subprocess` 启动。
10. **下载先校验**：服务端字节必须先过 gzip 解压 + 大小 + SHA-256，再原子 rename；校验失败不执行、不更新 `current.json`。

## 视觉约定

- 颜色只用 `--dsw-alias-*` 令牌；不要写死颜色（热力图墨色是 `var(--dsw-alias-brand-primary)`，坑过两次）。
- 卡片无描边、圆角 12px；卡片内容上下内边距 10px；卡片之间靠容器 `gap:16px`（`.cs-pageBody`），不要用 margin。
- 分段控件是 claude-style 的 pill：轨道 `var(--dsh-claude-chip, var(--dsw-alias-bg-layer-2))`、滑块 `var(--dsw-alias-bg-overlay)` + 阴影 + `translateX` 过渡；不要再写死 `#ffffff14` / `#ffffff24`。
- 页面切换动画：进入 `+8px → 0`、退出镜像，带 `blur(3px)`，`.25s/.12s`，缓动 `cubic-bezier(.22,1,.36,1)`。

## 发版

服务端和面板分开：

    # 1. 构建并发布服务端资产
    pnpm run server:build 1.13.0-panel
    gh release create server-v1.13.0-panel \
      dist/workbuddy2api-1.13.0-panel-*.gz \
      --title server-v1.13.0-panel --notes "..."

    # 2. 发布面板（server.json 已带校验值）
    pnpm run check
    npm pack --dry-run
    git tag v0.4.0 && git push --tags
    gh release create v0.4.0 --title v0.4.0 --notes "..."

版本号写在 `package.json`；`tsdown` 通过 `define` 把它注入 `src/version.ts`，UI 上的版本徽章读的是同一个值。服务端版本写在 `server.json`，由 host gateway row 读取。

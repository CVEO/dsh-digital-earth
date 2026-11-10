# 参与开发 / Contributing

感谢参与数字地球插件。本文只放开发、构建、测试与发布流程；用户使用说明见 [README.md](README.md)。

## 环境 / Requirements

- Node.js 22 或 24、npm。
- 运行期零第三方依赖；`esbuild` 只在构建期使用。
- 首次拉取后安装构建依赖：

```bash
npm ci
```

## 常用命令 / Commands

```bash
npm run build:client    # 重建 client.js（改了 src/client 后必须执行）
npm run check           # 语法 + 产物一致性 + 行数预算 + 全部测试
npm run release:check   # 发布前只读自检（版本 / 打包清单 / 预算）
```

- `client.js` 是构建产物，**不要手改**；改 `src/client` 后重新构建。
- `npm run check` 会检查 `client.js` 是否与源码一致，过期的产物会让 CI 失败。
- 修改工具契约或数据格式前，先补对应测试。

## 目录 / Layout

```text
dsh-digital-earth/
├── index.js                 # 宿主入口：inject / apply + 公开 re-export
├── src/host/                # 宿主：路由、命令桥、体检、存储、六个工具、/earth
├── src/client/              # 客户端源码：面板、图层、量测 / 指认、分析、着色器、i18n
├── client.js                # 客户端产物（npm run build:client 生成）
├── assets/readme/           # README 截图
├── icon.svg                 # 插件市场图标
├── locale/                  # 插件市场元数据（zh / en）
├── vendor/cesium/           # 自托管三维引擎（第三方声明见 THIRD-PARTY.md / NOTICE）
├── scripts/                 # 构建、行数预算、地理配准修复、发布自检
├── test/                    # 单元 / 契约 / 产物冒烟测试
├── CHANGELOG.md
├── THIRD-PARTY.md
├── NOTICE
└── package.json
```

## 分支 / Branches

- `develop`：日常开发与集成分支。功能从 `feature/*` 切出，PR 合并回 `develop`。
- `main`：稳定与发布分支。只接收 `develop` 的发布合并和紧急修复。
- 功能开发期间在 `develop` 上持续提交、跑测试；准备发布时再合并到 `main`。

## 约定 / Rules

- 六个 Agent 工具（`earth_scene` / `earth_capture` / `earth_draw` / `earth_measure` / `earth_analyze` / `earth_shader`）的名称、参数、action 集合保持不变；新能力优先做面板侧或新增可选参数。
- 一个模块一个职责；纯计算与 React / Cesium 分离；新文件优先控制在 300 行内。
- 行数预算：`index.js` ≤ 80 行；`src/host/**` 单文件 ≤ 600 行；`src/client/**` 单文件 ≤ 900 行；`ViewerSurface.js` 是限期例外，只允许缩小。
- 不提交本机绝对路径、个人截图、token 或本地临时笔记。
- 提交前跑通 `npm run check`；涉及发布链路的改动再跑 `npm run release:check`。

## 发布 / Release

1. 在 `develop` 上完成功能与 `npm run check`、`npm run release:check`。
2. 合并到 `main`，在 `main` 上再跑一次 `npm run check` 与 `npm run release:check`。
3. 打与 `package.json` 版本一致的 tag（例如 `v1.5.2`），推送 `main` 和 tag。
4. 在 GitHub 创建 Release；tag 工作流通过 OIDC 发布 npm（已存在的版本会自动跳过）。

本地 `npm run release:check` 只做只读自检，不会 tag / push / publish。版本号以 `package.json` 为单一来源；README 徽章、Host / Client About、CHANGELOG 顶部跟随它。

## License

MIT；第三方组件与数据声明见 [THIRD-PARTY.md](THIRD-PARTY.md) 与 [NOTICE](NOTICE)。

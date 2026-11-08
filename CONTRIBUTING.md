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
├── preview.png              # README 头图
├── icon.svg                 # 插件市场图标
├── locale/                  # 插件市场元数据（zh / en）
├── vendor/cesium/           # 自托管 CesiumJS 1.147
├── scripts/                 # 构建、行数预算、地理配准修复、发布自检
├── test/                    # 单元 / 契约 / 产物冒烟测试
├── CHANGELOG.md
├── NOTICE
└── package.json
```

## 约定 / Rules

- 六个 Agent 工具（`earth_scene` / `earth_capture` / `earth_draw` / `earth_measure` / `earth_analyze` / `earth_shader`）的名称、参数、action 集合保持不变；新能力优先做面板侧或新增可选参数。
- 一个模块一个职责；纯计算与 React / Cesium 分离；新文件优先控制在 300 行内。
- 行数预算：`index.js` ≤ 80 行；`src/host/**` 单文件 ≤ 600 行；`src/client/**` 单文件 ≤ 900 行；`ViewerSurface.js` 是限期例外，只允许缩小。
- 不提交本机绝对路径、个人截图、token 或本地临时笔记。
- 提交前跑通 `npm run check`；涉及发布链路的改动再跑 `npm run release:check`。

## 发布 / Release

- 发布是 tag-only + GitHub Actions OIDC：在 `main` 上打与 `package.json` 版本一致的 tag，由工作流发布。
- 本地 `npm run release:check` 只做只读自检，不会 tag / push / publish。
- 版本号以 `package.json` 为单一来源；README 徽章、About、CHANGELOG 顶部跟随它。

## License

MIT；CesiumJS 以 Apache-2.0 分发，第三方声明见 [NOTICE](NOTICE)。

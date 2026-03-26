# bilibili-webos

运行在 LG webOS TV 上的第三方哔哩哔哩客户端，面向遥控器 5-way 导航与电视大屏交互做适配。

项目目前以个人自用 MVP 为主，优先保证首页浏览、搜索、详情、播放、历史、个人页等主链路可用，并持续优化焦点流、返回链路和 webOS 真机播放稳定性。当前主要在 `LG C1` 上验证。

本项目与哔哩哔哩、LG 均无官方关联。

## 项目目标

- 为 LG webOS TV 提供一个可实际使用的哔哩哔哩客户端
- 遥控器操作优先，而不是桌面浏览器交互习惯
- 优先保证真机安装、启动、播放、返回等关键链路稳定
- MVP 阶段先把常用功能闭环，再逐步补齐边缘能力

## 当前能力

- 首页推荐流、频道切换和基础内容浏览
- 搜索、搜索结果、视频详情、PGC 详情
- 播放器主链路（暂停、继续、返回、控制条、设置面板等）
- 历史、稍后再看、收藏、个人中心、登录等常用页面
- webOS 能力封装、统一遥控器键位处理、焦点管理与页面栈返回链路

## 技术栈

- `React 19`
- `TypeScript 5`
- `Vite 7`
- `Vitest + jsdom`

## 开发要求

- 默认按 `1920x1080` 设计与验证
- 遥控器焦点态必须清晰，不能出现看得见但无法聚焦的主操作
- 浏览器开发体验仅作为辅助，最终以 webOS Simulator / 真机为准
- 平台能力统一收敛在 `src/platform/*`，避免在业务组件里散落调用原生接口

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 本地开发

```bash
npm run dev
```

### 3. 质量检查

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

## webOS 构建与部署

部署到 webOS Simulator 或真机时，优先使用仓库脚本，不要手工调用裸 `ares-*` 命令。

```bash
npm run build:webos
npm run webos:package
npm run webos:deploy -- --device <deviceName>
npm run webos:launch -- --device <deviceName>
```

如果需要拆步骤手动执行，推荐顺序：

```bash
npm run webos:package
npm run webos:update -- --device <deviceName>
# 等待约 8 秒
npm run webos:verify-install -- --device <deviceName>
npm run webos:launch -- --device <deviceName>
```

说明：

- 设备名、IP、passphrase、私钥等属于本机开发环境配置，不应写入仓库
- 日常优先 `webos:deploy`，只有明确需要清洁重装时才使用 `webos:reinstall`
- 如果电视表现像旧包，不能只看 CLI 成功提示，要继续核对实际安装入口和资源版本

## 目录结构

```text
src/
  app/         应用壳、页面栈、路由与启动逻辑
  components/  通用电视端组件
  features/    业务功能模块
  platform/    webOS、遥控器、焦点、生命周期封装
  styles/      全局样式与设计 token
scripts/       构建、打包、部署脚本
docs/          设计规范、计划与说明文档
ui_ref/        UI 参考稿
```

## 相关文档

- [DESIGN.md](./DESIGN.md)：统一视觉与交互规范
- [docs/plans/2026-03-21-tv-ui-refactor-plan.md](./docs/plans/2026-03-21-tv-ui-refactor-plan.md)：UI 重构阶段计划
- [AGENTS.md](./AGENTS.md)：仓库协作约束、开发流程和 webOS 部署规则

## 已知边界

- 当前仍是以个人使用场景驱动的项目，不承诺覆盖所有哔哩哔哩功能
- 现阶段优先保证普通视频播放闭环，不提前承诺会员/版权内容兼容性
- 主要验证设备为 `LG C1`，其他机型可能仍需额外适配与真机验证

## License

本项目采用 `GNU General Public License v3.0`（`GPL-3.0`）许可发布，详见 [LICENSE](./LICENSE)。

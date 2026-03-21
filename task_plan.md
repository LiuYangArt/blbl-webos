# Task Plan: Bilibili WebOS TV UI 重构

## Goal
基于 `ui_ref` 的整套 TV Mockup，建立可复用的电视端 UI 规范与组件层，并分阶段替换当前页面骨架，优先完成首页与播放器页试点。

## Phases
- [x] Phase 1: 前期调研与参考稿拆解
- [x] Phase 2: 计划文档与实施范围确认
- [x] Phase 3: 设计 token 与基础 TV 组件层落地
- [x] Phase 4: 首页视觉与焦点交互重构
- [x] Phase 5: 播放器页视觉与控制层重构
- [ ] Phase 6: 其余页面扩展与验收收尾

## Key Questions
1. 哪些视觉规则应该先沉淀为全局 token，而不是散落在页面 CSS 中？
2. 哪些 mockup 控件适合抽成跨页面组件，哪些应保留为页面组合？
3. 如何把 mockup 里的 hover 反馈转换成 webOS 遥控器焦点反馈？
4. 第一阶段做到什么粒度，既能验证方向，又不把页面全量重写失控？

## Decisions Made
- 先沉淀轻量 UI 规范，再按组件化方式替换页面：避免每页重复抄样式，后续搜索、登录、历史页可直接复用。
- 先做首页与播放器页试点：这两页最能验证 Hero、泳道卡片、控制层、返回链路和 TV 焦点态。
- 不直接照搬 `ui_ref/*.html`：静态稿中的 hover、远程字体、演示结构需要翻译成 TV 可聚焦的 React 组件。
- 侧边导航本轮先作为视觉锚点和当前页状态展示，不提前做未完成页面的可聚焦跳转，避免把焦点引到占位页。

## Errors Encountered
- 仓库中不存在 `.codebase_index.md`：已改为目录扫描与精确文件读取补齐上下文。

## Status
**Currently in Phase 6** - 首页与播放器试点已完成，基础组件与全局 token 已落地，下一步进入搜索/登录/历史页扩展与真机验证。

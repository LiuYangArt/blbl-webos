# Notes: UI Mockup 落地分析

## 参考来源

### Source 1: `ui_ref/DESIGN.md`
- 创意方向是 “The Neon Curator”，强调深色电影感、非对称布局、粉蓝双色光源。
- 重点设计规则：禁止 1px 分割线、优先用表面层级区分模块、聚焦态需要 `1.05x` 放大与主色外发光。
- TV 场景规则明确：外边距要留足安全区，内容层级要大、稀疏、可远距离识别。

### Source 2: `ui_ref/home_featured/code.html`
- 首页结构为：左侧导航、Hero Banner、主次 CTA、分页点、推荐泳道与大卡片。
- 卡片、按钮、导航、Glass 面板都具备高复用性，适合抽象成组件。

### Source 3: `ui_ref/categories_search/code.html`
- 搜索与分类页延续同一视觉系统，说明不是单页皮肤，而是一套统一语言。
- 分类区可抽象为 `CategoryTile`，搜索框需要转成 TV 输入入口，而不是浏览器输入体验。

### Source 4: `ui_ref/video_player_details/code.html`
- 播放器页包含顶部标题栏、底部控制层、进度条、相关视频泳道。
- 玻璃面板和图标控制按钮需要做成电视端可聚焦组件，而不是单纯 CSS hover。

### Source 5: 当前仓库实现
- 当前 UI 仍是启动骨架阶段，见 `src/features/home/HomePage.tsx`、`src/features/player/PlayerPage.tsx`。
- 样式集中在 `src/styles/app.css`，适合先重构为 token + 组件类，而不是继续堆页面级样式。
- 焦点基础设施已存在，见 `src/components/FocusButton.tsx` 和 `src/platform/focus.ts`，应在此之上扩展。

## Synthesized Findings

### 适合先抽的全局层
- 颜色 token
- 字体层级 token
- 间距与圆角 token
- 焦点态和表面层级 token
- 页面骨架与安全区规则

### 第一批基础组件
- `AppShell`
- `SideNavRail`
- `TvButton`
- `HeroBanner`
- `SectionHeader`
- `MediaCard`
- `ProgressBar`
- `PlayerControlBar`

### TV 化改造重点
- 所有 `hover` 视觉反馈都要映射为 `:focus-visible` / 程序焦点态。
- 左导航 hover 展开应改成“当前选中突出 + 保持可读标签”，不要依赖鼠标移入。
- 玻璃模糊与大阴影要适度，避免影响 webOS 真机性能。

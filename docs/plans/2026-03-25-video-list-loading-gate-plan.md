# 视频列表页统一 Loading Gate 方案

## 1. 背景与问题

在 `LG C1` 真机上，当前列表页虽然已有基础 loading 态，但用户仍会看到“页面结构先出现，再随着数据返回发生位置变化”的过程，典型表现为：

- 首页首屏阶段，频道按钮和内容区会在数据与登录态陆续就绪后发生可见位移
- Focus 白框会跟随布局变化移动，造成“焦点框追不上内容”的观感
- 遥控器首屏操作时，用户会在未稳定的布局上进行导航，容易产生卡顿感与不确定感

这属于 TV 端首屏稳定性问题。  
目标不是继续为单页补丁，而是建立“所有视频列表页一致”的加载门控规则。

## 2. 方案目标

统一采用 **Loading Gate**：

- 数据未就绪时，只渲染统一全屏 Loading 页面
- 不渲染真实列表结构，不让用户看到布局变化过程
- 数据就绪后，一次性切换到最终页面结构

这样可以把“布局变化”限制在不可见阶段，降低焦点框抖动和首屏不稳定观感。

## 3. 统一规则

### 3.1 组件层统一

新增通用组件（建议放 `src/features/shared`）：

- `VideoListLoadingPage`

统一职责：

- 只承载列表页加载阶段的视觉（Loading 文案/轻量动画）
- 不包含可操作按钮，避免加载阶段出现无意义焦点交互
- 作为所有视频列表页的唯一 loading 壳

### 3.2 页面层统一

所有视频列表页遵循同一门控：

- `ready = 页面关键数据已成功 + 关键登录态判定已稳定`
- `!ready` 时返回 `VideoListLoadingPage`
- `ready` 后才渲染真实页面结构（tabs / section / grid / chips）

### 3.3 错误态不合并进 Loading Gate

Loading Gate 只处理“加载中”。  
请求失败、无登录态、空数据等业务状态，继续按原页面逻辑返回现有 `PageStatus` / 空态，不与 loading 混用。

## 4. 覆盖页面清单

本次统一覆盖以下视频列表相关页面：

1. `HomePage`
2. `HotPage`
3. `HistoryPage`
4. `FollowingPage`
5. `LibraryPage`（`later` / `favorites`）
6. `SearchResultsPage`
7. `SubscriptionsPage`
8. `AuthorSpacePage`

## 5. 首页特殊策略

首页需要额外处理“登录态与推荐流时序”：

- 登录态处于 `idle/loading` 时，首页保持 Loading Gate
- 登录态稳定到 `authenticated/guest` 后，再开始展示首页真实结构
- 避免“先展示 guest tabs，再切换 authenticated tabs”的可见跳变

## 6. 风险与控制

### 风险 1：加载页停留时间变长

原因：把原本部分“边加载边显示”改成“先挡住再展示”。  
控制：Loading 组件保持轻量、无重动画；并行请求策略不变，避免额外增加接口耗时。

### 风险 2：回归已有错误态交互

控制：只替换 loading 分支，不改 error/empty/login 分支语义。

### 风险 3：焦点初始落点变化

控制：正式页面挂载后仍沿用原有 `defaultFocus` 与焦点引擎策略；Loading 页不放可聚焦按钮。

## 7. 验收标准（真机）

在 `LG C1` 真机上满足：

1. 进入任一视频列表页时，先看到统一 Loading 页面，而不是半成品布局
2. Loading 结束后页面一次性稳定出现，不再看到频道按钮/列表容器在可见阶段明显位移
3. Focus 白框不再出现“追着布局跑”的观感
4. 原有错误态、空态、登录引导行为与文案保持不退化

## 8. 实施步骤

1. 新增 `VideoListLoadingPage` 与样式
2. 接入 8 个列表页 loading 分支
3. 首页补“auth 稳定后再展示”的门控逻辑
4. 执行 `lint/test/typecheck/build`
5. 真机部署并复测首屏稳定性


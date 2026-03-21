# WebOS TV 焦点系统重构计划（基于 Spatial Navigation / Section 模型）

## 1. 文档目标

本文档用于为后续 `bilibili_webos` 的 TV 焦点系统重构提供一份可直接实施的计划。  
目标不是继续修补当前基于 `data-focus-row / data-focus-col` 的最近点匹配方案，而是明确切换到一套更适合电视端的 **Spatial Navigation / Section** 焦点模型。

本计划暂不要求本轮立即编码落地。  
本轮产出是：

- 解释为什么当前方案不适合继续补
- 总结 webOS 官方示例 `MediaPlayback` 的焦点思路
- 给出适合本仓库的目标架构
- 拆出可执行的实施阶段、文件范围、验收标准和风险控制

---

## 2. 背景与问题定义

### 2.1 当前实现方式

当前仓库的焦点导航主要依赖：

- `src/platform/focus.ts`
- `src/platform/remote.ts`
- 页面/组件上的 `data-focus-row` 与 `data-focus-col`

其核心思想是：

- 每个可聚焦元素标注一组逻辑坐标
- 按方向键时，根据当前元素坐标，在全局候选里找“最接近”的下一个目标
- 再配合 `focusGroup` 做一层“左栏 / 主内容区”分区

### 2.2 已经暴露出的实际问题

当前方案在 TV 页面变复杂后，已经出现稳定性问题：

- 左右、上下会出现“跳格”
- 同一行元素移动时，可能跳过中间项
- 多 section 页面中，焦点容易误入左侧导航
- 页面切换后旧焦点残留，导致新页面一进来左栏先激活
- 同一个焦点系统需要同时兼顾：
  - 左侧主导航
  - Hero CTA
  - 热搜 chip 网格
  - 视频网格
  - 播放器控制条
  - 抽屉 / 弹窗 / 面板

这些场景已经超出了“全局 row/col 最近匹配”模型的天然表达能力。

### 2.3 根本原因

当前问题的根本原因不是某一个排序权重不对，而是模型不够：

- 它只知道“元素坐标”
- 不知道“当前在什么区域”
- 不知道“进入一个区域后应该落到哪里”
- 不知道“离开一个区域时应该去哪里”
- 不知道“某个元素在某个方向上的邻居是谁”

也就是说，它缺的是 **TV 焦点的结构信息**，而不是再多几个 if。

---

## 3. 参考项目调研结论

参考项目：`F:\CodeProjects\bilibili_tv_android\MediaPlayback`

### 3.1 它怎么处理焦点

这个示例项目没有自己实现“按上下左右时由业务代码推算下一焦点”。  
它的做法是：

1. 初始化 `SpatialNavigation`
2. 将一组可导航元素注册成一个或多个 section
3. 调用 `makeFocusable()`
4. 把方向键导航交给 `SpatialNavigation`
5. 业务层只负责：
   - `Enter`
   - `Back`
   - 播放器媒体键
   - 焦点变化时的 UI 状态反馈

关键代码：

- `MediaPlayback/js/MediaPlayerUI.js`
- `MediaPlayback/lib/spatial_navigation.js`
- `MediaPlayback/index.html`

### 3.2 它的模型为什么更适合 TV

`SpatialNavigation` 支持下面这些能力：

- `selector`
  - 定义一个 section 包含哪些可聚焦元素
- `defaultElement`
  - 定义该 section 的默认焦点
- `enterTo`
  - 进入某个 section 时，优先回到默认焦点，还是回到上次焦点
- `leaveFor`
  - 当从某个 section 向某个方向离开时，明确跳转到哪个 section 或元素
- `data-sn-left/right/up/down`
  - 对单个元素显式指定方向邻居，避免几何推断失真

这套模型天然适合电视端，因为 TV 的核心不是“元素排布像网格”，而是“用户可预期地从一个区域移动到另一个区域”。

### 3.3 对本项目最重要的启发

对 `bilibili_webos` 来说，真正要借鉴的不是某个具体动画或样式，而是下面这些原则：

- 焦点导航应该是一个独立基础设施层，不应该散落在页面里
- 页面应先被拆成 section，再做方向规则
- section 之间的切换应可配置，而不是靠距离猜
- “返回某个区域时回到上次焦点”应成为一等能力
- 复杂页面中的特殊跳转，必须允许显式覆盖

---

## 4. 本项目的目标方案

## 4.1 目标

将当前基于全局 row/col 的焦点系统，重构为：

- **Section 化**
- **方向邻接可配置**
- **默认焦点 / 上次焦点可恢复**
- **弹层 / 抽屉 / 对话框可接管焦点**
- **左导航与主内容区切换受控**

### 4.2 最终期望能力

重构完成后，系统至少应满足：

- 左右移动优先在当前 section 内稳定导航
- 上下移动优先在当前 section 内稳定导航
- 只有显式允许时，才跨 section
- 页面进入时，焦点落在页面主内容默认焦点，而不是左侧导航
- 返回到一个 section 时，可选择：
  - 回到默认焦点
  - 回到上次焦点
- 打开抽屉 / 弹窗时，焦点被该区域接管
- 关闭抽屉 / 弹窗后，焦点恢复到之前的触发点

---

## 5. 不建议继续沿用当前方案的理由

## 5.1 row/col 方案不适合复杂 TV 页面

当前方案只适合下面这种简单情况：

- 单一列表
- 规则矩阵
- 几乎没有跨区跳转

而真实 TV 页面通常包含：

- 左侧全局导航
- 主内容区多个 section
- Hero 区和网格区并存
- 动态加载内容
- 弹层、抽屉、面板
- 焦点恢复与返回链路

这时继续给 row/col 补规则，会有三个问题：

- 规则越来越多，但仍然无法表达完整意图
- 页面越多，冲突越多
- 每个新页面都要重新“猜”一遍几何关系

## 5.2 再继续补，只会进入“修一处坏另一处”的循环

当前已出现的现象已经证明：

- 调整候选排序后，仍然会跳格
- 加输入去重后，仍然会跳格
- 限制跨区后，仍然会在多 section 页面出现不可预测结果

这说明现在最该变的不是参数，而是模型。

---

## 6. 建议采用的实现路线

## 6.1 方案选择

建议切换到下面两种路线之一：

### 方案 A：直接引入 `SpatialNavigation` 类库

优点：

- 路径最短
- 模型成熟
- 与 webOS 示例项目方向一致
- 自带 section、默认焦点、显式 leaveFor、显式 data-sn-* 等能力

缺点：

- 需要确认库是否与当前 React 结构、构建链路兼容
- 需要为 React 组件封装一层 declarative API

### 方案 B：参考 `SpatialNavigation` 思路，自建轻量焦点引擎

优点：

- 更可控
- 可以只做本项目真正需要的子集
- 代码风格与仓库更统一

缺点：

- 实施周期更长
- 很容易再次掉进“自己重写不成熟空间导航算法”的坑

### 推荐结论

**优先推荐方案 A。**

原因：

- 当前最大问题是焦点模型不稳定，而不是代码所有权
- 示例项目已经证明这条路在 webOS 页面是成立的
- 当前项目更需要尽快获得稳定 TV 导航，而不是再花很长时间造一个自定义焦点轮子

---

## 7. 目标架构设计

## 7.1 新焦点层的职责边界

建议新增一层焦点基础设施，负责：

- section 注册与销毁
- section 配置管理
- 默认焦点和上次焦点恢复
- 方向导航
- 焦点锁定 / 接管 / 恢复
- 和遥控器按键层对接

建议目录：

- `src/platform/focus/engine.ts`
- `src/platform/focus/registry.ts`
- `src/platform/focus/section.ts`
- `src/platform/focus/remoteAdapter.ts`
- `src/platform/focus/types.ts`

如果首轮不想拆太细，也至少要把当前：

- `src/platform/focus.ts`
- `src/platform/remote.ts`

重构为更清晰的多文件结构，而不是继续堆在同一文件里。

## 7.2 Section 模型

每个 section 应至少支持这些配置：

```ts
type FocusSectionConfig = {
  id: string;
  selector: string;
  defaultElement?: string;
  enterTo?: 'default-element' | 'last-focused';
  leaveFor?: {
    left?: string;
    right?: string;
    up?: string;
    down?: string;
  };
  disabled?: boolean;
};
```

### 说明

- `selector`
  - 该 section 管哪些元素
- `defaultElement`
  - 首次进入时的默认焦点
- `enterTo`
  - 再次进入该 section 时使用默认焦点还是上次焦点
- `leaveFor`
  - 当前 section 在某个方向无法继续导航时，显式跳到哪个 section 或元素

## 7.3 组件层 API

建议提供两个层级的 React 封装：

### A. `FocusSection`

负责声明一个焦点区域：

```tsx
<FocusSection
  id="search-hot-keywords"
  selector="[data-focus-scope='search-hot-keywords'] [data-focusable='true']"
  defaultElement="[data-focus-id='search-hot-0']"
  enterTo="last-focused"
  leaveFor={{ up: '@search-actions', down: '@search-history' }}
>
  ...
</FocusSection>
```

### B. `Focusable`

负责声明一个可聚焦元素：

```tsx
<Focusable
  focusId="search-hot-0"
  data-sn-right="[data-focus-id='search-hot-1']"
  data-sn-left="@side-nav"
>
  ...
</Focusable>
```

### 设计原则

- 页面只描述焦点关系，不直接做导航运算
- 业务组件不直接碰 `window.addEventListener('keydown', ...)`
- 平台层与业务层隔离

## 7.4 遥控器层职责

`src/platform/remote.ts` 后续应简化为：

- 负责监听遥控器键
- 将方向键 / Enter / Back 转成焦点系统和页面系统可理解的语义
- 不再自己决定“下一个焦点是谁”

也就是说：

- `LEFT / RIGHT / UP / DOWN`
  - 交给 Focus Engine
- `ENTER`
  - 激活当前焦点
- `BACK`
  - 继续走现有 `弹窗 > 面板 > 页面 > 退出应用`

---

## 8. 页面级焦点分区建议

## 8.1 App Shell

建议全局固定 section：

- `side-nav`
  - 左侧全局导航
- `global-topbar`
  - 顶部状态或全局入口（如果保留）

规则：

- 左导航默认不主动抢焦点
- 只有当内容区显式 `leaveFor.left = '@side-nav'` 时，才允许从主区切到左导航

## 8.2 首页

建议拆成：

- `home-hero-actions`
- `home-recommend-grid`
- `home-hot-grid`

规则：

- Hero 区按下进入推荐区
- 推荐区按下进入热门区
- 推荐区最左列按左才允许回左导航
- 推荐区内部左右移动必须先走同排相邻项

## 8.3 搜索页

建议拆成：

- `search-actions`
- `search-hot-keywords`
- `search-history`
- `search-preview-grid`

规则：

- 搜索动作区按下进入热搜
- 热搜按下进入历史
- 历史为空时，按下直接进入推荐内容区
- 热搜和历史必须是独立 section，避免“全页 chip 混成一个大网格”

## 8.4 详情页

建议拆成：

- `detail-hero-actions`
- `detail-episodes`
- `detail-related-grid`

规则：

- 首次进入焦点在“立即播放 / 继续播放”
- 选集区和相关推荐区的上下关系显式定义
- 内容区最左边按左时，才允许回侧栏

## 8.5 播放器页

建议拆成：

- `player-controls`
- `player-settings-drawer`
- `player-related-grid`

规则：

- 打开 settings drawer 后，drawer 接管焦点
- 关闭 drawer 后，恢复到打开按钮
- 播放器控制条内部左右移动必须是显式顺序

---

## 9. 建议的实施阶段

## Phase 0：前置调研与基线冻结

### 目标

在真正开始改之前，先把“当前问题样本”固化下来，避免重构过程中丢失验证目标。

### 任务

1. 列出现有已知焦点异常路径
2. 为首页、搜索、详情、播放器分别整理一组最小复现场景
3. 确认是否直接引入 `SpatialNavigation`，还是先做 PoC
4. 确认 `SpatialNavigation` 与当前 React/Vite 兼容性

### 产出

- 一份焦点异常样本清单
- 一份依赖引入可行性结论

### 验收

- 能明确回答“后续我们究竟换什么、不换什么”

## Phase 1：建立新的焦点基础设施

### 目标

在平台层建立 section 化焦点引擎，但暂时不大面积改页面。

### 任务

1. 引入 `SpatialNavigation` 或建立兼容封装
2. 新建 `focus engine` 多文件结构
3. 把遥控器方向键改为驱动新引擎
4. 保留旧 `row/col` 方案一段时间作为临时兼容层
5. 为 React 提供 `FocusSection` / `Focusable` 封装

### 涉及文件

- `src/platform/remote.ts`
- `src/platform/focus/*`
- `src/components/FocusButton.tsx`
- `src/components/TvIconButton.tsx`

### 验收

- 新焦点系统可独立驱动一个简单 demo 页面
- 不依赖 row/col 也能完成基础 4-way 导航

## Phase 2：试点改造搜索页

### 为什么先选搜索页

因为搜索页同时包含：

- 顶部按钮区
- 热搜 chip 网格
- 搜索历史区
- 推荐视频区

它比首页更容易暴露 section 切换是否合理，但又比播放器风险小。

### 任务

1. 将搜索页拆成明确 section
2. 为热搜 chip 提供稳定左右/上下导航
3. 为“左导航 <-> 主区”建立显式规则
4. 进入搜索页时默认落在输入入口

### 涉及文件

- `src/features/search/SearchPage.tsx`
- `src/features/search/SearchResultsPage.tsx`

### 验收

- 热搜 4 列场景不再跳格
- 上下在 section 之间切换稳定
- 左侧导航不会无故抢焦点

## Phase 3：首页试点改造

### 目标

验证首页 Hero + 多个视频网格的 section 导航模型。

### 任务

1. 首页按 Hero / 推荐 / 热门拆 section
2. 推荐和热门网格内部导航稳定
3. section 间上下切换明确
4. 页面进入默认落在 Hero CTA

### 验收

- 视频网格左右移动不跳格
- 视频网格按左时不会越过中间项
- 进入详情页 / 返回首页后，焦点恢复符合预期

## Phase 4：详情页与播放器页改造

### 目标

把最复杂的 TV 页面也纳入统一焦点模型。

### 任务

1. 详情页拆为主操作 / 选集 / 相关推荐
2. 播放器拆为控制条 / 设置抽屉 / 相关推荐
3. 焦点锁定与恢复机制接入抽屉和弹层
4. 与现有 BackHandler 整合

### 验收

- 打开抽屉后焦点只在抽屉内活动
- 关闭抽屉后焦点回到触发按钮
- 播放器页返回链路与焦点恢复不冲突

## Phase 5：移除旧 row/col 方案

### 目标

在主要页面迁移完成后，删除旧焦点坐标系统，降低长期维护成本。

### 任务

1. 删除 `data-focus-row / data-focus-col` 依赖
2. 清理兼容逻辑和过渡代码
3. 统一全部页面使用新 API
4. 更新文档和组件说明

### 验收

- 新系统成为唯一焦点方案
- 新增页面不再需要手动维护 row/col

---

## 10. 具体任务清单

## 10.1 基础设施任务

- 评估并引入 `SpatialNavigation`
- 建立 `FocusSection` React 封装
- 建立 `Focusable` React 封装
- 建立 section 注册/销毁机制
- 建立默认焦点和上次焦点恢复机制
- 建立焦点接管与恢复机制
- 建立跨区 leaveFor 规则

## 10.2 页面迁移任务

- 搜索页 section 化
- 首页 section 化
- 详情页 section 化
- 播放器页 section 化
- 左侧主导航接入 section 模型

## 10.3 清理任务

- 清理旧 row/col 属性
- 清理旧 focusGroup 临时逻辑
- 清理遥控器输入层的过渡补丁

---

## 11. 涉及文件建议

### 新增

- `src/platform/focus/engine.ts`
- `src/platform/focus/registry.ts`
- `src/platform/focus/types.ts`
- `src/platform/focus/react.tsx`

### 重构

- `src/platform/remote.ts`
- `src/components/FocusButton.tsx`
- `src/components/TvIconButton.tsx`
- `src/components/SideNavRail.tsx`
- `src/App.tsx`

### 页面接入

- `src/features/home/HomePage.tsx`
- `src/features/search/SearchPage.tsx`
- `src/features/search/SearchResultsPage.tsx`
- `src/features/video-detail/VideoDetailPage.tsx`
- `src/features/player/PlayerPage.tsx`

---

## 12. 验证方案

## 12.1 静态验证

每轮改动后至少运行：

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## 12.2 手动路径验证

每个阶段都要固定验证这些路径：

### 搜索页

- 输入入口按下进入热搜
- 热搜第一列按右只到第二列
- 热搜第三列按左只到第二列
- 热搜按左只在最左列时切回左导航

### 首页

- Hero CTA 按下进入推荐
- 推荐网格左右不跳格
- 推荐区按下进入热门区
- 热门区最左列按左才切左导航

### 详情页

- 默认焦点在播放按钮
- 播放按钮按下进入选集
- 选集按下进入相关推荐

### 播放器页

- 控制条左右移动顺序稳定
- 打开设置抽屉后，焦点被抽屉锁定
- 关闭抽屉后，焦点回到打开按钮

## 12.3 真机 / 模拟器验证

至少保证：

- Simulator 中焦点移动稳定
- 真机上遥控器连续点击不丢焦点
- 页面切换与返回链路不抢焦点

---

## 13. 风险与控制策略

## 13.1 风险：第三方库与 React 组件树不完全贴合

### 控制

- 先做最小 PoC
- 优先封装在平台层，不把第三方 API 直接散到页面里

## 13.2 风险：一次性全站迁移风险过高

### 控制

- 先搜索页试点
- 再首页
- 再详情 / 播放器

## 13.3 风险：旧系统与新系统并存期间产生双重行为

### 控制

- 只保留短期过渡兼容
- 每迁移一个页面，就减少一部分旧逻辑依赖

## 13.4 风险：页面异步加载导致默认焦点时机不稳定

### 控制

- section 进入时通过 `defaultElement` / `last-focused` 控制
- 不再用全局 `focusFirst()` 作为长期主方案

---

## 14. 暂不在本计划第一轮解决的内容

- Pointer 模式的复杂 hover 行为
- 鼠标与遥控器混合输入策略优化
- 焦点动效细节打磨
- 虚拟列表 / 超长列表焦点回收优化
- 无障碍朗读语义增强

这些内容后续都可以建立在新焦点模型之上再做，不应成为第一轮重构阻塞项。

---

## 15. 实施建议结论

结论非常明确：

- **停止继续在 row/col 最近匹配方案上打补丁**
- **采用 Spatial Navigation / Section 模型重构焦点系统**
- **优先从搜索页试点落地**
- **待搜索页验证稳定后，再推广到首页、详情、播放器**

这条路线更符合：

- webOS 示例项目的实践
- TV 大屏交互规律
- 当前仓库的长期维护需求

---

## 16. 后续开始实施时的推荐顺序

以后准备真正动手时，建议按这个顺序开始：

1. 先做 `SpatialNavigation` 接入 PoC
2. 再抽 `FocusSection` / `Focusable`
3. 先迁移搜索页
4. 手动验证热搜与搜索结果区不跳格
5. 再迁移首页
6. 最后迁移详情页和播放器页

如果实施时只能做一件事，优先做：

- **搜索页 section 化试点**

因为它最容易验证“新的焦点模型是否真的解决了当前跳格问题”。

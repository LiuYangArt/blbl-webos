# 2026-03-23 webOS Simulator flex gap 关键间距失效 Postmortem

## 结论

这次问题表面上看是多个零散 UI 细节：

1. 搜索页主按钮之间在网页端有间距，在 `webOS Simulator` 里却紧贴
2. 搜索页不同 section 之间本应有纵向留白，但在 `Simulator` 里标题和上一块内容直接挨在一起
3. `UI Debug` 顶部按钮组同样出现“浏览器正常、Simulator 挤在一起”的现象

真正的根因不是单个页面样式写坏，而是：

- 项目里一批关键布局间距依赖了 `display: flex` + `gap`
- 这些间距在桌面浏览器里成立，但在 `webOS Simulator` 中并不总是稳定
- 当 `gap` 失效时，主按钮组、section 堆叠、wrap chip 组就会直接塌成一团

最终沉淀后的原则是：

- **关键视觉间距不能只依赖 `flex gap`**
- **页面主 section 堆叠、主按钮组、抽屉操作区、wrap chip 组要优先用显式 sibling margin 或容器 margin 方案兜底**
- **浏览器端只是辅助观察，最终要以 `webOS Simulator / 真机` 的实际可见效果为准**

## 用户可见现象

这轮用户连续指出了几类表面上不相干的问题：

1. 搜索页“输入关键词 / 搜索默认词”两个主按钮在浏览器里有空隙，在 Simulator 里完全贴在一起
2. `UI Debug` 页“关闭 UI Debug / 焦点切到控件上可直接观察真实聚焦态”两个按钮也出现同样问题
3. 搜索页“热搜 / 搜索历史 / 直接开看”几个 section 垂直堆叠时没有留白，标题直接贴着上一块内容
4. 用户已经开始怀疑这不是单独页面问题，而是 Simulator 环境对布局能力有差异

这些反馈如果拆开看，很容易误判成：

- 搜索页自己的样式写漏了
- `UI Debug` 页单独写坏了
- `SectionHeader` 自己 margin 丢了
- 某一组按钮焦点态外框把视觉间距吃掉了

但最后确认不是单点错误。

## 根因一：关键间距大量依赖 `flex gap`

问题位置主要集中在：

- `src/styles/app.css`
- `src/features/search/SearchPage.tsx`
- `src/features/debug/UiDebugPage.tsx`

排查后发现，多个关键区域都用了下面这类结构：

```css
display: flex;
gap: ...;
```

典型位置包括：

1. 搜索页主按钮组 `search-entry`
2. `UI Debug` 顶部按钮组 `ui-debug-hero__actions`
3. Hero / 登录页主动作区
4. 页面主 section 外层 `page-shell`
5. 播放器设置抽屉里的操作按钮和 chip 组

这些写法在现代桌面浏览器里通常没问题，但在 `webOS Simulator` 里，关键间距不能默认认为和桌面浏览器完全一致。

## 根因二：这不是“某个按钮没 margin”，而是“一类布局语义不稳”

这次如果只修搜索页，会留下两个问题：

1. 同类写法在别的页面还会继续出错
2. 下次用户看到类似现象时，又要重新从头排查一次

用户后续继续指出：

- 搜索页 section 垂直堆叠也没间距

这说明问题不是“某两个按钮组件之间缺一个 margin”，而是：

- **关键布局语义本身不能只靠 `flex gap` 成立**

一旦 `gap` 失效：

1. 横向按钮组会贴在一起
2. 纵向 section 会挤成一串
3. wrap chip 组换行后的行间距也会不稳

所以修复必须上升到模式层，而不是继续打零散补丁。

## 根因三：浏览器与 TV 容器差异必须以前者服从后者

这次用户判断很关键：

- “网页端是有间距的，但 Simulator 里没有”

这意味着不能再把“浏览器里看起来正常”当作布局正确的充分证据。

在这个项目里，最终运行环境是：

1. `webOS Simulator`
2. 真机 `webOS TV`

所以这类布局问题的判断顺序必须固定为：

1. 先看 Simulator / 真机是不是成立
2. 再看桌面浏览器是不是一致

而不是反过来。

## 修复方案

### 1. 关键横向按钮组改成显式 sibling margin

已收口的位置包括：

1. `search-entry`
2. `hero-banner__actions`
3. `detail-hero__actions`
4. `login-panel__actions`
5. `search-composer__actions`

处理方式是：

- 不再依赖 `gap`
- 改成 `> * + * { margin-left: ... }`

好处是：

1. 语义直观
2. 对 TV 容器更稳
3. 不会被 `gap` 支持差异直接打穿

### 2. 允许换行的按钮 / chip 组改成容器 margin 方案

已收口的位置包括：

1. `ui-debug-hero__actions`
2. `player-settings-drawer__chips`
3. `player-settings-drawer__actions`
4. `player-subtitle-panel__chips`

处理方式是：

1. 容器使用负 `margin`
2. 子元素使用正 `margin`

这样做的原因是：

- 这类区域会 `wrap`
- 单纯 sibling margin 只适合单行
- 负 margin + 正 margin 对换行场景更稳

### 3. 页面主 section 堆叠改成相邻块显式间距

已收口的位置包括：

1. `page-shell`
2. `home-channel-stack`
3. `home-subscription-group`
4. `player-settings-drawer__section`
5. `player-settings-drawer__info`

处理方式是：

- 纵向容器不再依赖 `gap`
- 改成 `> * + * { margin-top: ... }`

这一步直接解决了搜索页里：

1. “热搜”标题贴着上一块按钮
2. “搜索历史”标题贴着上一块内容
3. “直接开看”标题贴着上一块内容

## 为什么这个问题容易误判

这次问题很容易被误判成下面几类：

1. 焦点白框让人误以为按钮距离被吃掉
2. `SectionHeader` 的 `margin-bottom` 写漏了
3. 某个页面自己没有套统一按钮样式
4. Simulator 只是偶发缓存或旧包

但真正情况是第五类：

5. **关键布局本身依赖了对 `webOS Simulator` 不够稳的间距机制**

也就是说，问题不是“样式没写”，而是“写法对目标环境不够稳”。

## 修复与沉淀

### 1. 把关键间距兜底规则写回设计规范

这次已经把下面两条写进：

- `DESIGN.md`

新增的硬规则包括：

1. 页面主 section 堆叠、主按钮组、抽屉操作区、wrap chip 组等关键区域，禁止只依赖 `flex gap` 承担唯一间距语义
2. 搜索页不同 section 之间必须保留稳定的纵向留白，不能只在桌面浏览器里成立

### 2. 优先收口“关键区”而不是盲改所有 `gap`

这次没有机械式全局替换所有 `gap`，而是先处理最影响 TV 体验的区域：

1. 页面首屏 section 堆叠
2. 主按钮组
3. 抽屉操作区
4. 会换行的 chip / action 组

这样可以避免：

1. 为了修 Simulator 去破坏正常的 grid 布局
2. 把风险扩散到不需要动的样式上

### 3. Simulator 问题排查顺序要固定

以后只要用户反馈：

- 网页端正常
- Simulator 里按钮、section、chip 间距消失或明显变窄

优先检查顺序应固定为：

1. 这个区域是不是关键视觉间距
2. 它是不是用 `flex gap` 在承担唯一间距语义
3. 能不能改成 sibling margin 或容器 margin 方案
4. 改完后再去看浏览器端是否仍一致

不要先猜：

- 焦点框
- 白边
- 单个按钮 margin
- 特定页面漏样式

## 经验沉淀

以后继续改 TV UI 时，要默认记住：

1. `flex gap` 不是不能用，但不能让它单独承担关键视觉间距
2. 对 `webOS Simulator / 真机` 来说，关键间距优先选择更朴素但更稳的写法
3. 页面主堆叠、主按钮组、wrap chip 组、抽屉动作区，是最值得优先兜底的高风险区域
4. 浏览器开发态看到的间距成立，不代表 TV 容器里也成立
5. 一旦用户指出“网页端正常、Simulator 不正常”，要优先怀疑布局实现方式，而不是只怀疑缓存或单页样式

## 后续固定检查项

以后只要新增或重构以下区域，都必须同步检查 Simulator / 真机的实际间距：

1. 页面首屏 section 堆叠
2. 主 CTA / 次 CTA 按钮组
3. 搜索、登录、详情、播放器设置等动作区
4. 会换行的 chips / actions 容器
5. `UI Debug` 中用于对照真实控件的关键按钮组

验证清单里应明确包含：

1. 桌面浏览器里是否正常
2. `webOS Simulator` 里是否仍保留同样的关键间距
3. 真机上是否与 Simulator 保持一致
4. 是否还有其他同模式的容器没被一起收口

# 2026-03-23 webOS Simulator 旧包误判与 UI Debug 治理 Postmortem

## 结论

这次用户看到“Simulator 里还是旧样式”，最终不是单一原因，而是两层问题叠在一起：

1. `webOS Simulator` 本身确实容易被旧会话、旧窗口和旧代理残留污染
2. 但这次更关键的根因，是 `dist` 已经更新，而 `build/webos` 仍然指向旧的 legacy 入口

另外，这次也顺手暴露了另一个长期治理问题：

- `UI Debug` 页如果不设规则，很容易慢慢长成一套“只在 Debug 页存在”的新样式

最终沉淀后的原则是：

- **判断 Simulator 是否拿到新包时，要以 `build/webos` 为准，而不是只看 `dist`**
- **`UI Debug` 页只能陈列真实组件与真实样式来源，不能反向孵化新的调试专用视觉体系**
- **浏览器端视觉增强不能高于 Simulator / 真机基线，TV 容器能看到什么才是最终约束**

## 用户可见现象

用户连续看到几类现象：

1. 首页频道切换器和顶部按钮样式明明已经改了，但 Simulator 里仍像旧版
2. 桌面浏览器和 Simulator 的按钮焦点态不一致，网页端还出现额外白框
3. `UI Debug` 页里有些控件样式能看到，有些控件又像漏掉了
4. 用户担心如果继续给 Debug 页单独补样式，会让项目里实际样式来源越来越混乱

这些反馈如果拆开看，很容易误判成：

- Simulator 缓存没清
- 构建脚本偶发失效
- 某两个页面单独写乱了
- Debug 页只是展示不全

但最后确认不是这么简单。

## 根因一：Simulator 实际加载的是 `build/webos`，不是 `dist`

问题位置：

- `scripts/build-webos.mjs`
- `scripts/prepare-webos.mjs`
- `build/webos/index.html`

这轮排查里最关键的证据是：

- `dist/assets/index-legacy-*.js` 已经是最新时间戳
- 但 `build/webos/assets/index-legacy-*.js` 仍然是旧文件
- `build/webos/index.html` 也仍然引用旧的 legacy 入口脚本

而 Simulator 启动时传入的目录就是：

- `F:\CodeProjects\bilibili_webos\build\webos`

这说明判断“代码是不是已经被 Simulator 拿到”时，真正该看的不是 `dist`，而是：

1. `build/webos/index.html`
2. `build/webos/assets/*`

只要这里还是旧入口，Simulator 里看到旧 UI 就完全合理。

## 根因二：旧会话残留仍然会放大误判

问题位置：

- `scripts/webos-cli.mjs`
- `.agents/skills/lg-webos-deploy/SKILL.md`

即便这次真正的关键根因落在 `build/webos`，旧会话残留仍然会制造大量噪音：

1. 旧 Simulator 主进程可能还没退干净
2. 旧 DevTools 子窗口可能还挂在旧会话上
3. 旧 `simulator-media-proxy` 可能还在继续服务上一轮上下文

如果一边残留旧会话，一边 `build/webos` 也没同步成功，就会形成双重误导：

- 看起来像缓存
- 实际又不只是缓存

因此以后排查顺序必须固定：

1. 先确认 `npm run webos:simulator` 是否真的重建并重启
2. 再核对 `build/webos` 是否已切到最新入口
3. 只有这两步都没问题后，才继续怀疑更深层的 Simulator 环境问题

## 根因三：UI Debug 页天然有“发明新样式”的风险

问题位置：

- `src/features/debug/UiDebugPage.tsx`
- `src/styles/app.css`
- `DESIGN.md`

`UI Debug` 页的初衷是好的：

- 把当前项目里用到的控件集中陈列出来
- 给每个控件写清楚“这是用在哪个页面的什么东西”
- 这样后续用户说“改这个按钮”时，双方可以快速对齐

但它也有一个天然风险：

- 为了把版面摆漂亮，最省事的做法往往是给 Debug 页自己补一套样式

如果放任这种做法，结果就会变成：

1. 业务页面有一套真实样式
2. Debug 页又有一套“看起来差不多”的调试样式
3. 后续再有人参照 Debug 页改 UI，就会把假的来源当成真的来源

所以这次明确收敛成：

- `UI Debug` 页只能展示真实组件
- 允许新增说明性布局容器
- 不允许新增只服务 Debug 页的控件视觉语义

## 根因四：浏览器和 Simulator 不一致时，要以 TV 容器为基线

问题位置：

- `src/styles/app.css`
- `DESIGN.md`

这次用户还指出一个很实际的问题：

- 桌面浏览器里某些按钮会看到额外白框
- 但 Simulator 的表现更接近目标效果

因为当前项目最终是跑在 `webOS TV` 和 `webOS Simulator` 上，而这两个环境的内核与桌面浏览器并不完全等价，所以后续要明确：

- 浏览器开发态只是辅助
- 如果浏览器增强样式和 Simulator 冲突，应优先保证 Simulator / 真机一致

否则就会出现“桌面浏览器看着更花，但 TV 上不成立”的伪优化。

## 修复与沉淀

### 1. 把 Simulator 排查规则写回 Skill 和项目约束

已经把下面两条写回：

- `.agents/skills/lg-webos-deploy/SKILL.md`
- `AGENTS.md`

新增的硬规则包括：

1. Simulator 看起来像旧包时，先看 `build/webos`，不要只看 `dist`
2. `UI Debug` 优先通过快捷键和 URL 查询参数进入，不把 Windows 下 JSON `--params` 当成唯一稳定入口

### 2. 把 UI Debug 治理规则写回 UI 规范

已经把下面两条写回：

- `DESIGN.md`
- `docs/plans/2026-03-21-tv-ui-refactor-plan.md`

新增的硬规则包括：

1. `UI Debug` 只展示真实组件和真实样式来源
2. 新收口的通用控件要同步补到 `UI Debug` 页
3. 同类控件必须共用同一套语义，不允许页面和 Debug 页各自长一套近似变体

### 3. 补测试锁住 UI Debug 入口

这次补充的测试会优先覆盖：

1. `launchParams.route = 'ui-debug'` 时能直接进入调试页
2. `?uiDebug=1` 时能稳定进入调试页
3. 快捷键入口保持不和浏览器常见默认快捷键冲突

## 经验沉淀

以后只要继续改下面这些区域，都要同时复查：

1. `scripts/build-webos.mjs` / `scripts/prepare-webos.mjs` 是否真的把最新构建同步进 `build/webos`
2. `scripts/webos-cli.mjs` 的 Simulator 生命周期管理是否仍然可靠
3. `UI Debug` 页展示的是不是真实组件，而不是“Debug 专用皮肤”
4. 浏览器开发态的焦点反馈是否和 Simulator / 真机基线一致

## 后续固定检查项

以后只要用户反馈“Simulator 里还是旧的”，先按这个顺序检查：

1. `npm run webos:simulator` 是否刚重新执行过
2. `build/webos/index.html` 引用的是哪个 `index-legacy-*.js`
3. `build/webos/assets` 和 `dist/assets` 的入口是否一致
4. 当前 Simulator 会话是否确实是新进程、新窗口

以后只要新增通用 UI 控件，也要按这个顺序检查：

1. 是否已经收口到真实通用组件
2. 是否已经写进 `DESIGN.md`
3. 是否已经补进 `UI Debug` 页
4. 是否仍以 Simulator / 真机可见效果为最终基线

# 2026-03-21 webOS 6.0 Simulator 白屏问题 Postmortem

## 结论

本次 “Simulator 能启动应用，但只看到背景渐变、React UI 整体不显示” 的核心根因，已经从最初判断的“仅仅是产物语法太新”进一步收敛为两层问题叠加：

1. **当前前端构建产物默认面向较新的浏览器，而 `webOS TV 6.0 / LG C1` 所在代际的 Web 引擎明显更旧**
2. **LG C1 真机上的打包应用，对 `type="module"` 入口本身也不能直接当成可靠启动路径**

更具体地说：

1. 我们已经先修复过 `build/webos/index.html` 的资源绝对路径问题，让 Simulator 至少能正确加载 HTML / CSS。
2. 新一轮白屏并不是资源 404，而是主脚本在更早阶段就发生了兼容性失败。
3. `webOS TV 6.0` 对应的内核能力大致停留在 `Chromium 79` 这一代。
4. 仓库当前使用 `Vite 7 + React 19`，默认构建目标更现代，产物里仍残留 `?.`、`??` 等 `Chromium 79` 不支持的语法。
5. 即使把语法降级后，真机上仍进一步暴露出 `type="module"` 入口没有真正执行的问题。
6. 这些失败都发生在 React 挂载之前，所以最终现象就是：背景样式能显示，但整个 App UI 白屏。

最终修复方式不是单独一条，而是同时做两件事：

- 把构建目标显式降到 `chrome79`
- 在 webOS 打包产物中强制改用 legacy 非 module 入口

修复后：

- `webOS 6.0 Simulator` 已能够正常显示应用 UI
- `LG C1` 真机 UI 也已恢复显示

## 用户可见症状

- 点击 Simulator 中的 App 图标后，窗口能打开，但页面只有背景，没有任何实际 UI。
- `Launch App` 指向 `build/webos` 后，表现依然接近空白页。
- 6.0 Simulator 弹出主进程错误：
  - `A JavaScript error occurred in the main process`
  - `Error: socket hang up`
- 从页面表现看，CSS 已生效，但 React 主逻辑没有真正跑起来。

## 根因拆解

### 根因一：第一层问题其实已经变了，不再是资源路径错误

问题位置：

- `vite.config.ts`
- `build/webos/index.html`

此前 Simulator “点图标无反应” 的一层根因，是构建产物引用了 `/assets/...` 和 `/webOSTV.js` 这类绝对路径。切到文件目录启动时，Simulator 无法按预期解析这些资源。

这层问题通过：

- `base: './'`

已经修好。修好后 `index.html` 能正确加载 CSS 和 JS 资源，所以后续看到“背景渐变能出来”，说明已经进入第二层问题，而不是还停留在资源找不到。

### 根因二：`webOS TV 6.0` 的 Web 引擎能力明显低于当前默认构建目标

问题位置：

- `vite.config.ts`
- `dist/assets/*.js`

排查时确认了两个事实：

1. 最终目标设备 `LG C1` 对应 `webOS TV 6.0`。
2. 该代平台的浏览器能力大致相当于 `Chromium 79`。

而当前项目构建链路是：

- `Vite 7`
- `React 19`

默认面向的浏览器代际更高。实测扫描构建产物后，可以看到 JS 中仍然存在：

- `?.`
- `??`

这类语法在 `Chromium 79` 上会在脚本解析阶段直接失败，因此 React 根本没有机会执行 `createRoot(...).render(...)`。

这就解释了为什么页面表现是：

- HTML 在
- CSS 在
- React UI 不在

### 根因三：Simulator 主进程的 `socket hang up` 不是这次白屏的主根因

问题位置：

- `webOS 6.0 Simulator` Electron 壳

排查中用户同时看到了：

- `Error: socket hang up`

这个错误确实会干扰判断，但从最终现象和修复结果看，它不是导致 App UI 白屏的主根因，更多像是 Simulator 自身主进程或调试连接层面的异常噪音。

理由是：

1. 即使存在这个弹窗，页面仍然成功加载了 HTML 和 CSS。
2. 一旦把前端产物降级到 `chrome79`，UI 就恢复显示。
3. 如果主根因是 `socket hang up`，单纯调整前端构建目标不应该解决白屏。

因此本次复盘中应把它视为“伴随性异常”，而不是主修复方向。

## 修复内容

### 1. 明确把 webOS 6.0 构建目标降到 `chrome79`

在 [vite.config.ts](/F:/CodeProjects/bilibili_webos/vite.config.ts) 中加入：

```ts
build: {
  outDir: 'dist',
  sourcemap: true,
  target: 'chrome79',
  cssTarget: 'chrome79',
}
```

后续又做了一轮小型整理，把这个兼容目标提成常量，避免后面继续散落 magic string。

### 2. 重新构建并验证产物语法已经降级

重新执行构建后，实际检查 `dist/assets/*.js`，确认：

- `?.` 已被降级
- `??` 已被降级

这一步很关键，因为“写了 target”不等于“产物里真的没有旧内核不认识的语法”。必须看最终产物。

### 3. 真机补充：不能只停在 “降级语法”，还要强制切换到 legacy 入口

后续真机排查时，又观察到一个关键事实：

- 电视屏幕已经能够显示我们插入的普通内联诊断脚本
- 但一直停在 `startup-timeout`
- 且始终看不到 `main.tsx` 中打出的“入口模块已执行”阶段提示

这说明：

- HTML 已加载
- 非 module 普通脚本已执行
- 但 `type="module"` 的前端入口并没有在真机上真正跑起来

因此最后在 [scripts/prepare-webos.mjs](/F:/CodeProjects/bilibili_webos/scripts/prepare-webos.mjs) 中，把 `build/webos/index.html` 进一步重写为：

- 保留 `webOSTV.js`
- 注入 `polyfills-legacy-*.js`
- 注入 `index-legacy-*.js`
- 不再让真机依赖 `type="module"` 入口

这一步完成后，`LG C1` 真机 UI 才真正恢复显示。

### 4. 重启 6.0 Simulator，确认重新加载的是新产物

为了排除旧缓存影响，排查时还执行了：

- 关闭现有 `webOS_TV_6.0_Simulator` 进程
- 重新 `npm run webos:simulator`

同时确认：

- `build/webos/index.html` 已引用新的 hash 资源
- Simulator profile 下的缓存 / preferences 时间戳已更新

说明新包确实被重新加载，而不是还在使用之前的旧缓存。

## 为什么这个问题容易误判

这次问题很容易被误判成以下方向：

1. **误判成 Simulator 包损坏**
   因为同时有 `socket hang up` 弹窗。
2. **误判成 app 资源没打进去**
   因为页面看上去像空白。
3. **误判成 React 业务代码崩了**
   因为 UI 不显示，很像运行时异常。

但真正有效的判断线索是：

- 背景渐变存在，说明 CSS 已成功加载。
- `index.html` 中资源路径已改成相对路径，说明第一层路径问题已经被排除。
- 新产物中能直接搜到 `?.` / `??`，而 `webOS 6.0` 代际又偏旧，这两边证据能对上。

## 验证结果

本次修复后已完成这些验证：

- `npm run lint`
- `npm run typecheck`
- `npm run build:webos`
- `npm run webos:simulator`

验证结果：

- `webOS 6.0 Simulator` 可启动应用
- `LG C1` 真机 UI 已恢复显示
- 不再出现“只有背景、没有界面”的白屏现象
- 但这只证明“启动链路已恢复”，不代表播放链路已经成立

## 经验沉淀

后续做 webOS / TV 端联调时，优先遵守这些规则：

1. 不要把 “现代浏览器能跑” 默认等同于 “旧版 webOS WebView 也能跑”。
2. 只看源码不够，必须检查最终 `dist/assets/*.js` 里还残留了哪些语法。
3. 遇到“CSS 在、React UI 不在”的白屏，第一时间怀疑脚本解析阶段兼容性，而不是只盯着接口或样式。
4. Simulator 的 Electron 壳错误可能是噪音，不能因为弹窗先入为主地把问题归到 Simulator 本身。
5. 电视端构建目标应该围绕最终真机代际明确声明，不能完全依赖构建工具默认值。
6. 对 `webOS TV 6.0` 这类旧代际设备，`type="module"` 不能默认当成真机可靠入口；要检查最终打包 HTML 到底引用了哪一类脚本。

## 后续约束

后续继续推进播放器和 webOS 真机联调时，补充以下约束：

1. 构建目标要继续以 `LG C1 / webOS TV 6.0` 这类目标设备为基线验证。
2. 如果未来升级依赖导致产物再次现代化，优先回到“查产物语法 + 查目标设备内核”这一套排查路径。
3. Simulator 只负责帮助发现“页面是否能跑起来”，媒体能力最终仍以真机验证为准。
4. 后续继续做真机发布时，优先保留当前 legacy 打包策略，除非确认新的 webOS 目标设备链路已明确支持 module 入口。

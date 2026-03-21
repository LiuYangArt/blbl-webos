# 2026-03-21 浏览器 Dev 播放链路修复 Postmortem

## 结论

本次“页面能打开但播放器黑屏、控制台和 Network 错误快速增长”的问题，不是单点故障，而是两个根因叠加：

1. React 状态更新链路里存在无限更新环，导致播放器不断被重新加载。
2. 浏览器开发态的媒体请求并没有真正稳定中转到 bilivideo CDN，导致 `<video>` 请求被取消或拿到错误响应。

修复后，PC 浏览器 `npm run dev` 下已经可以完成“首页 -> 详情 -> 播放”的主链路闭环，缩略图与实际视频都能加载。

## 用户可见症状

- 首页最初出现 `Failed to fetch` / 403。
- 缩略图可以看到页面结构，但图片本身不显示。
- 进入播放器后黑屏，控制台错误迅速增加。
- Network 里 `nav`、`playurl`、媒体请求短时间内密集重复，媒体请求经常 `cancelled`。

## 根因拆解

### 根因一：`refreshAuth` 身份不稳定，触发全局重复鉴权

问题位置：

- `src/app/AppStore.tsx`
- `src/App.tsx`

之前 `refreshAuth` 是在 store value 构造过程中内联生成的函数。任何全局 state 更新都会让它获得新引用，而 `App.tsx` 又有：

```ts
useEffect(() => {
  void refreshAuth();
}, [refreshAuth]);
```

结果就是：

`state 变化 -> refreshAuth 引用变化 -> effect 重跑 -> /nav 再打一次 -> state 再变化`

这解释了用户截图里大量重复的 `nav 200`。

### 根因二：播放页把“进度持久化”错误地接回了“播放器初始化”

问题位置：

- `src/features/player/PlayerPage.tsx`

播放页在 `timeupdate` 里持续写入本地播放进度，而播放器初始化 effect 又间接依赖了那份进度，形成：

`timeupdate -> setWatchProgress -> 组件重渲染 -> effect 重新 load video -> 媒体请求被新请求打断`

这就是 `Maximum update depth exceeded` 和媒体请求持续 `cancelled` 的主要来源。

### 根因三：Vite 原代理配置不适合动态媒体 URL 中转

问题位置：

- `vite.config.ts`

`__bili_media/<encoded-url>` 最初试图复用 proxy 的动态路由思路，但实测并没有稳定转发到真实视频 CDN，返回结果一度落到了错误页面或错误响应，浏览器无法把它当成正常 `video/mp4` 流处理。

## 修复内容

### 1. 开发态 API 代理头统一修正

对 `__bili_api` / `__bili_passport` / `__bili_search` 的代理统一补了：

- `Origin: https://www.bilibili.com`
- `Referer: https://www.bilibili.com/`
- 桌面浏览器 `User-Agent`

这样 dev 浏览器访问真实 B 站接口时，不再因为 `localhost` 来源直接 403。

### 2. 图片改为浏览器友好的防盗链规避

对首页卡片、详情、历史、收藏、个人中心等图片统一加：

```tsx
referrerPolicy="no-referrer"
```

并在接口层把封面地址归一化为 `https`，修复了缩略图在浏览器 dev 下的 403。

### 3. `AppStore` 回调稳定化，切断重复鉴权

将以下动作改为 `useCallback` 稳定引用：

- `rememberSearch`
- `removeSearchHistory`
- `setWatchProgress`
- `setAuthGuest`
- `refreshAuth`

同时在 `set-progress` reducer 分支增加 no-op 判断，避免相同进度重复写入 state。

### 4. 播放页改成“候选线路 + 有界重试”，并切断更新环

播放页核心调整：

- 用 `ref` 保存恢复进度，避免把播放器初始化直接绑到最新 store 进度上。
- `timeupdate` 里只有在秒值真的变化时才持久化。
- 移除导致重新 `load()` 的错误依赖链。
- 接入 `candidateUrls`，线路报错时尝试 `backup_url`。
- 显示最后的播放错误，而不是静默黑屏。

### 5. dev 媒体中转改成显式中间件

不再把视频流托付给普通 proxy 配置，而是在 `vite.config.ts` 里新增显式 middleware：

- 匹配 `/__bili_media/<encoded-url>`
- 服务端 `fetch()` 真实 bilivideo 地址
- 透传 `Range`
- 覆写 `Origin` / `Referer` / `User-Agent`
- 过滤会干扰浏览器媒体管线的头
- 直接把上游响应体 pipe 回浏览器

这样浏览器 `<video>` 能拿到可消费的 `206 video/mp4`。

## 安卓参考项目带来的启发

参考了 `F:\\CodeProjects\\bilibili_tv_android\\PiliPlus` 的播放实现，关键不是“照抄”，而是确认了一个方向：

- 安卓端并不是只用第一条 `durl.url`
- 会把 `backup_url` 作为候选
- 会结合 CDN 做线路选择

因此 web 版 MVP 也不应把播放逻辑简化成“只拿一条地址直接播”。

## 验证结果

修复后已完成这些验证：

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- 本地浏览器自动化实测：首页 -> 详情 -> 播放器，视频已成功起播

实测时 `<video>` 状态满足：

- `readyState = 4`
- `paused = false`
- `currentTime` 持续增长
- 媒体请求返回 `206 video/mp4`

## 后续约束

后续继续做播放器和 webOS 真机联调时，优先遵守这些规则：

1. 不要把高频状态写入重新接回播放器初始化 effect。
2. 浏览器 dev 与真机播放链路分开思考，浏览器优先保证可调试性，真机再单独验证 webOS 差异。
3. 视频地址不要只信任单条 `durl.url`，至少保留候选线路能力。
4. 涉及 bilibili 防盗链的图片或媒体资源，先确认 `Origin` / `Referer` / `referrerPolicy`。

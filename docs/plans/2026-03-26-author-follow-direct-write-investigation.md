# 2026-03-26 作者页关注直连写接口调研

## 背景

当前任务原本想在 TV 端作者页补上“关注 / 取关”能力，并优先评估是否可以不依赖 Relay，直接从 webOS 前端调用哔哩哔哩的关系写接口。

调研过程中，用户对“关注为什么要走 Relay”提出了明确质疑，因此本次工作重点转成两件事：

1. 对照 Android 参考项目，确认它为什么可以直连写关注。
2. 在当前 webOS 项目里验证：问题到底是“没拿到登录材料”，还是“浏览器 / 容器来源本身就不被 B 站写接口接受”。

本文档只记录调研结论与证据，不保留这次分支上的实验性实现。

## 结论摘要

### 1. Android 参考项目能写关注，不是因为“只要 csrf”

参考项目 `F:\CodeProjects\bilibili_tv_android\PiliPlus` 的结论很明确：

- 它维护的是完整、持久化的 B 站 CookieJar。
- 每次请求前都会把完整 Cookie 注入请求。
- 每次响应后还会把 `Set-Cookie` 回写 CookieJar。
- 关系写接口除了 `fid / act / csrf` 之外，还会补 Web 端期望的来源参数与表单字段。

也就是说，Android 端能直连写关注，本质上依赖的是“完整会话能力”，而不是只拿到一个 `csrf` 就够了。

### 2. 当前 webOS 项目里，重新扫码后登录 Cookie 已经真实落进 simulator

本次调研直接读取了 webOS Simulator 的 Chromium Cookie 数据库，确认以下关键 Cookie 已存在：

- `SESSDATA`
- `bili_jct`
- `DedeUserID`

这说明“重新扫码后 Cookie 没落进容器”不是当前 403 的主因。

### 3. 当前 webOS app 在 simulator 里运行于 `file://` 页面来源

本次调研还直接查看了 simulator 的本地存储元数据，发现存储记录中包含 `META:file://`。

这说明当前 app 在 simulator 中是以本地页面上下文运行的，而不是运行在 `https://www.bilibili.com` 或 `https://space.bilibili.com` 这样的同站网页来源下。

### 4. 关注接口 403 的更可信根因是“来源 / 容器限制”，而不是“缺 Cookie”

综合上面两条事实：

- Cookie 已存在。
- 页面来源是 `file://`。
- 重新扫码后再次点击关注，仍然稳定返回 `403`。

因此，当前更可信的结论是：

> 在现有“webOS 前端页面直接 `fetch` B 站写接口”的架构下，`/x/relation/modify` 更可能是因为请求来源来自 `file://` 容器，而不是因为登录材料缺失，最终拒绝了这类写请求。

换句话说，这条路当前不是简单的“参数还没补全”，而更接近“浏览器容器层面不被接受”。

## Android 参考项目证据

### 1. 账号对象直接持有完整 CookieJar

文件：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\utils\accounts\account.dart`

关键信息：

- `LoginAccount` 内部直接保存 `DefaultCookieJar`
- `csrf` 直接从 `bili_jct` 读取
- `mid` 直接从 `DedeUserID` 读取
- Cookie 会被持久化到本地存储

这说明 Android 侧维护的是完整 Cookie 会话，而不是只缓存一个 `csrf` 字段。

### 2. 请求前自动注入 Cookie，请求后继续回写 Cookie

文件：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\utils\accounts\account_manager\account_mgr.dart`

关键信息：

- `onRequest()` 会从 `cookieJar.loadForRequest()` 取 Cookie，并写入 `Cookie` header
- `onResponse()` / `onError()` 会处理 `Set-Cookie` 并保存回 `cookieJar`

这说明 Android 项目拥有持续更新的会话能力。

### 3. 关系写接口会补 Web 端来源参数

文件：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\video.dart`

关键信息：

- 直连 `/x/relation/modify`
- 表单中除了 `fid / act / re_src / csrf`，还包含 `gaia_source / spmid / extend_content`
- 请求头里还补了：
  - `origin: https://space.bilibili.com`
  - `referer: https://space.bilibili.com/$mid/dynamic`
  - `user-agent: BrowserUa.pc`

### 4. 关系读取也是直接调用 B 站接口

文件：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\user.dart`

关键信息：

- `hasFollow(mid)` -> `GET /x/relation?fid=<mid>`

## webOS 项目调研证据

### 1. 重新扫码后，Simulator Cookie 库中已存在关键登录 Cookie

调研方式：

- 直接复制并读取 simulator 的 Chromium `Cookies` SQLite 数据库

实际观察到的 Cookie 包括：

- `.bilibili.com / SESSDATA`
- `.bilibili.com / bili_jct`
- `.bilibili.com / DedeUserID`
- 以及 `DedeUserID__ckMd5 / sid / buvid3`

结论：

- TV 端扫码后，至少在 simulator 容器里，关键登录 Cookie 已经存在。

### 2. Local Storage 元数据中出现 `META:file://`

调研方式：

- 直接扫描 simulator 的 `Local Storage/leveldb`

实际观察：

- leveldb 数据中存在 `META:file://`

结论：

- 当前 app 的页面来源是 `file://`

### 3. 重新扫码后再次点关注，仍稳定返回 `网络请求失败（403）`

用户与本次调研都复现了同样结果：

- 作者页点击“关注”
- 页面提示：`网络请求失败（403）`

结论：

- 在 Cookie 已存在的前提下，单纯重新扫码并不能解决问题。

## 技术判断

### 当前不建议继续在“纯前端直连写接口”这条路上投入更多时间

原因不是“还差最后一个参数”，而是当前证据更支持：

- 前端页面来源本身不被 B 站写接口接受
- 或者 `file://` 容器下的跨站写请求在 B 站风控 / 来源校验上天然处于不可信上下文

因此，即使继续在前端层补：

- `csrf`
- `origin / referer`
- `gaia_source / spmid / extend_content`
- 重新扫码

也不太可能把成功率从 0 提升到可交付水平。

## 后续可行路线

### 路线 A：Relay / 服务端代理写接口

优点：

- 成功率最高
- 不受 `file://` 页面来源限制
- 与当前仓库已有的播放 / 历史上报代理模式一致

缺点：

- 需要修改并重新部署 Relay

### 路线 B：平台原生代理，而不是浏览器 `fetch`

含义：

- 不再让前端页面直接请求 B 站写接口
- 改成通过 webOS 平台侧 / 本机服务能力中转请求

优点：

- 仍然可以坚持“不走远端 Relay”

缺点：

- 工作量明显更大
- 平台专项更重
- 比改 Relay 更复杂，且当前仓库没有现成基础设施

## 当前决策

本次任务先不继续实现作者页关注能力。

原因：

- 现有证据已经表明，当前架构下“纯前端直连写接口”不可作为稳定交付方案。
- 在没有明确决定走 Relay 或平台原生代理前，继续在当前分支上堆实验性代码意义不大。

因此本次收口策略是：

1. 保留调研文档
2. 丢弃本次分支上的实验性实现
3. 回到 `main`
4. 以后再基于本结论重新规划正式方案

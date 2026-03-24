# 播放完成后未进入观看历史的专项方案

## 1. 背景

当前 `bilibili_webos` 已经有两个“看起来都像历史”的能力，但它们其实并没有形成闭环：

- 播放器里会持续写本地 `watchProgress`
- 历史页会读取哔哩哔哩云端历史

这意味着用户在 App 内把视频完整看完后，即使播放器本地记住了进度，也不代表该视频一定会出现在“历史记录”页面里。  
用户这次反馈的“播放完之后不会出现在历史记录里”，本质上不是历史页渲染问题，而是**播放器缺少服务端历史上报链路**。

## 2. 调研结论

## 2.1 当前 webOS 仓库的真实现状

先说结论：当前仓库只有“本地播放进度缓存”，没有“服务端历史上报”。

### 2.1.1 播放器当前只写本地进度

`src/features/player/PlayerPage.tsx` 在视频 `timeupdate` 时会调用 `setWatchProgress()`，把：

- `bvid`
- `cid`
- `title`
- `progress`
- `duration`

写入 `AppStore`。

`src/app/AppStore.tsx` 会把这些数据持久化到本地存储键：

- `bilibili_webos.watch_progress`

这条链路的作用是：

- 让播放器下次进入时可以从本地恢复进度
- 给当前播放器 UI 显示“已同步本地播放记录”

它并不会把记录提交到哔哩哔哩账号历史。

### 2.1.2 历史页当前只读云端历史

`src/features/history/HistoryPage.tsx` 使用 `fetchHistoryPage()` 拉取云端历史。  
`src/services/api/bilibili.ts` 当前接的是：

- `/x/web-interface/history/cursor`

也就是说，历史页展示的是账号云端历史，而不是本地 `watchProgress`。

### 2.1.3 当前仓库缺少历史上报 API

目前 `src/services/api/bilibili.ts` 里已经有：

- 播放地址
- 详情
- 推荐
- 历史读取
- 收藏/稍后再看等读取能力

但没有看到：

- `/x/v2/history/report`
- `/x/click-interface/web/heartbeat`

对应的封装。

### 2.1.4 当前播放器路由还丢了 `aid`

这是后续实现里非常关键的一点。

当前 `src/app/routes.ts` 里的 `player` 路由只传：

- `bvid`
- `cid`
- `title`
- `part`

`src/features/shared/videoListItems.ts` 返回的 `PlayerRoutePayload` 也是同样结构。  
但参考安卓实现里的历史上报接口需要 `aid`。这意味着：

- 仅靠当前播放器收到的路由参数，无法直接完整拼出历史上报请求
- 后续必须在“进入播放器前就带上 `aid`”和“播放器内部补查 `aid`”之间选一种

如果不先解决这个数据缺口，后面的历史上报逻辑就只能继续绕路。

## 2.2 参考项目 PiliPlus 的做法

这次最有价值的参考项目是 `PiliPlus`。

### 2.2.1 明确存在两条历史相关接口

`F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\api.dart` 定义了：

- `heartBeat = /x/click-interface/web/heartbeat`
- `historyReport = /x/v2/history/report`

说明安卓参考项目并不是“只靠本地缓存进度”，而是有真实的服务端记录能力。

### 2.2.2 `historyReport` 与 `heartBeat` 都已封装

`F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\video.dart` 中：

- `historyReport(aid, type)` 会调用 `/x/v2/history/report`
- `heartBeat(...)` 会调用 `/x/click-interface/web/heartbeat`
- `heartBeat` 请求里会提交 `played_time`

这说明参考项目把“历史出现”和“进度更新”视为服务端状态，而不是纯本地状态。

### 2.2.3 播放器里按事件持续上报

`F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\plugin\pl_player\controller.dart` 的 `makeHeartBeat()` 是核心：

- `position.listen` 中持续调用
- `status.listen` 在播放状态变化时调用
- `completed.listen` 在播放完成时调用

具体节奏是：

- 普通播放中，进度每前进约 `5s` 上报一次
- 状态变化时，进度前进约 `2s` 会补一次
- 播放完成时，会再走一轮 `completed`

并且 `completed` 分支会在满足“确实播完”的前提下，把 `progress` 改成 `-1` 再提交。  
这说明参考项目会显式把“已完成观看”同步到服务端，而不是只停留在本地播放器状态。

### 2.2.4 有登录态与开关门槛

同一个控制器里还明确限制了以下情况不再上报：

- 未登录
- 用户主动暂停历史记录功能
- 播放进度还是 `0`

这个做法对 webOS 也很重要，因为它说明“历史记录是否同步”不是播放器的纯 UI 行为，而是和账号态、用户设置、有效播放进度一起判断的。

## 2.3 参考项目 JKVideo 的情况

在本地 `JKVideo` 参考仓库中，没有检索到与：

- `/x/v2/history/report`
- `/x/click-interface/web/heartbeat`
- `played_time`

对应的明确实现入口。  
因此这一轮“历史记录为什么没有写回服务端”的方案，应该以 `PiliPlus` 为主要参考，而不是 `JKVideo`。

## 3. 问题本质

这次用户看到的表象是：

- 视频播完了
- 但历史页里没有这条视频

真正的根因更接近下面这条链路断裂：

1. 播放器只在本地存 `watchProgress`
2. 历史页只读云端历史
3. 中间缺了“播放行为上报给哔哩哔哩服务端”的桥

因此问题不应定义成“历史页刷新逻辑不对”，而应定义成：

**播放器缺少服务端历史上报闭环，导致本地播放行为不会沉淀到账号历史。**

## 4. 推荐方案

## 4.1 本轮目标

本轮先补齐最小闭环：

- 登录用户在 App 内开始正常播放后，服务器能收到播放进度
- 视频播完后，服务器能收到完成态
- 随后历史页重新加载时，可以看到这条视频

这里要特别强调：

- 本轮目标是“补齐云端历史闭环”
- 不是把历史页改成直接读取本地 `watchProgress`

后者虽然能暂时“看到记录”，但会把本地进度缓存和账号历史语义混在一起，不符合当前页面定位。

## 4.2 建议的实施拆分

### 4.2.1 先补 API 层能力

在 `src/services/api/*` 新增两类能力：

- 读取 `bili_jct` / `csrf` 的通用方法
- 对 `/x/v2/history/report` 和 `/x/click-interface/web/heartbeat` 的封装

当前 `src/services/api/http.ts` 基本只有 `GET + fetchJson()` 能力，缺少：

- 表单 POST
- 带 `csrf` 的请求约定
- 与登录态写接口对应的统一辅助函数

这部分最好先补在 API 层，不要在播放器组件里直接散落拼 `fetch`。

### 4.2.2 补齐播放器所需的标识字段

要让播放器稳定上报历史，至少要保证它拿得到：

- `aid`
- `bvid`
- `cid`

因此推荐优先把 `PlayerRoutePayload` 扩展为可携带 `aid`。  
对应影响点至少包括：

- `src/app/routes.ts`
- `src/App.tsx`
- `src/features/shared/videoListItems.ts`
- 各个进入播放器的列表页与详情页

如果短期内个别来源拿不到 `aid`，再评估是否由播放器内部补查详情。  
但主路径最好还是在进入播放器前就把主键带完整，避免每次进播放器都额外补一次详情请求。

### 4.2.3 在播放器里建立统一上报节奏

建议不要把上报逻辑散落在多个匿名回调里，而是抽成一个统一的历史上报模块，例如：

- `reportVideoHistoryView(...)`
- `reportVideoHeartbeat(...)`
- `flushVideoHeartbeatOnComplete(...)`

首期节奏建议参考 `PiliPlus`，但适度贴合当前 webOS 结构：

1. `timeupdate`
   - 继续保留本地 `watchProgress`
   - 同时对登录用户做节流后的 heartbeat 上报
2. `pause` / 状态变化
   - 若距离上次成功上报已有足够进度增量，补一次 heartbeat
3. `ended`
   - 在真正播完时补一次 completed 上报
   - 这个 completed 上报应独立于“自动续播下一条视频”逻辑，避免被跳转吞掉
4. 页面退出 / 切换视频
   - 如果当前已经产生有效播放进度，尝试再做一次收尾 heartbeat

### 4.2.4 完成态要优先于自动续播

当前播放器已经有“最后一 P 播完后自动续播下一条”的能力规划与实现。  
这里要特别注意顺序：

1. 先把当前视频的历史完成态上报出去
2. 再触发自动续播跳转

否则如果先跳到下一条播放器页，当前这一条视频的 `completed` 很容易丢失。

### 4.2.5 明确本轮不引入额外 fallback

按仓库规则，本轮不建议做“历史页把本地 `watchProgress` 混进云端历史列表”的 fallback。  
原因是这会带来几个副作用：

- 登录态与游客态的历史语义变混
- 历史页会出现“本地有、云端没有”的来源混杂卡片
- 后续再补真云端上报时，还要重做去重与排序规则

所以本轮应直接解决服务端上报本身，而不是靠页面层伪装成“历史已经有了”。

## 5. 推荐实施范围

### 5.1 API 与鉴权

- 新增 `csrf` 读取工具
- 新增带表单 POST 的 Bilibili 请求工具
- 新增历史上报与 heartbeat 封装

### 5.2 路由与数据模型

- 扩展 `PlayerRoutePayload`，补齐 `aid`
- 核对首页、搜索、历史、稍后、收藏、详情等入口的播放器跳转负载
- 确保播放器内无需额外猜测视频主键

### 5.3 播放器事件链

- 抽离历史上报节流状态
- 接入 `timeupdate / pause / ended / unmount`
- 保证 completed 上报不会被自动续播覆盖

### 5.4 验证与观测

- 为 API 层补单测
- 为上报时机补纯逻辑测试
- 在调试日志中增加“历史 heartbeat 已触发 / completed 已触发”的轻量可观测信息

## 6. 明确不做

- 历史页直接拼接本地 `watchProgress` 作为临时补丁
- 游客态伪造历史记录
- 历史暂停开关 UI
- 多端历史冲突合并策略
- 批量补偿旧播放记录

## 7. 验收标准

1. 登录用户在 App 内播放视频达到有效时长后，会触发服务端 heartbeat 上报。
2. 视频自然播放完成时，会触发完成态上报。
3. 播放完成后重新进入历史页，能看到刚刚播放的视频。
4. 历史页中的该条记录仍可继续进入播放器。
5. 自动续播开启时，不会因为跳下一条而漏掉当前视频的完成态上报。
6. 本地断点续播能力保持不退化。
7. 游客态不会误触发需要登录的历史写接口。

## 8. 验证要求

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

联调时建议再补一轮人工验证：

1. 登录账号
2. 打开一条普通 UGC 视频
3. 连续播放至少 `10s`
4. 退出播放器后进入历史页，确认新记录是否出现
5. 再完整播放到结束，确认历史中的进度/完成态是否更新

## 9. 风险提示

- `historyReport / heartbeat` 的 web 端请求参数、`csrf` 读取与 cookie 生效方式，需要先在当前仓库环境中确认。
- 当前很多进入播放器的路径只保留了 `bvid/cid/title`，没有 `aid`，这一层不补齐会直接卡住上报落地。
- 播放器已经存在自动续播、切线路、reload 等复杂事件链，历史上报必须做去重与节流，避免重复写接口或漏写完成态。
- 真机和浏览器容器在 cookie、生存周期、页面卸载时机上可能有差异，最终应以 webOS Simulator / 真机联调结果为准。

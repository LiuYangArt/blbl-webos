# [播放器] 播放完成后不会进入观看历史：补齐服务端历史上报闭环

GitHub Issue: `#14`

## 背景

当前 App 里，播放器会持续写本地 `watchProgress`，但历史页展示的是哔哩哔哩云端历史。  
现状导致一个明显断层：

- 用户在 App 内已经正常播放甚至完整播完视频
- 播放器本地也记住了进度
- 但“历史记录”页面里仍然看不到这条视频

这说明问题不在历史页本身，而在于播放器缺少把播放行为写回服务端的闭环。

## 需求目标

为登录用户补齐“播放器播放行为 -> 哔哩哔哩历史接口 -> 历史页可见”的完整链路。

首期至少要做到：

- 有效播放后会向服务端上报 heartbeat
- 播放完成后会提交完成态
- 历史页重新加载后能看到刚刚播放的视频

## 方案文档

详细方案见：

- `docs/plans/2026-03-24-player-history-report-plan.md`

安卓参考调研来源包括：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\api.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\video.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\plugin\pl_player\controller.dart`

当前仓库相关代码包括：

- `src/app/AppStore.tsx`
- `src/features/player/PlayerPage.tsx`
- `src/features/history/HistoryPage.tsx`
- `src/services/api/bilibili.ts`
- `src/app/routes.ts`
- `src/features/shared/videoListItems.ts`

## 推荐实现范围

### 1. API 与鉴权补齐

- 新增 `csrf` / `bili_jct` 读取能力
- 新增表单 POST 的 Bilibili 请求工具
- 封装历史上报接口与播放 heartbeat 接口

### 2. 播放器路由负载补齐

- 扩展 `PlayerRoutePayload`
- 让进入播放器的主路径能带上 `aid`
- 避免播放器里再临时猜测视频主键

### 3. 播放器历史上报链路

- `timeupdate` 里节流上报 heartbeat
- `pause` / 状态变化时补一次进度同步
- `ended` 时补完成态上报
- 页面退出或切视频前补一次收尾上报

### 4. 自动续播与历史上报顺序

- 先上报当前视频完成态
- 再进入下一条自动续播
- 避免因为跳转过快丢失当前视频历史

### 5. 测试与观测

- 为 API 层补单测
- 为节流/完成态判断补纯逻辑测试
- 增加轻量日志，方便确认 heartbeat 和 completed 是否真的触发

## 明确不做

- 历史页把本地 `watchProgress` 直接混进云端历史列表
- 游客态伪造历史记录
- 历史暂停开关 UI
- 旧播放记录批量补偿

## 验收标准

1. 登录用户播放视频达到有效时长后，会触发服务端 heartbeat 上报。
2. 视频自然播放完成时，会触发完成态上报。
3. 播放完成后重新进入历史页，能看到刚刚播放的视频。
4. 自动续播开启时，不会漏掉上一条视频的完成态上报。
5. 本地断点续播能力保持可用，不因服务端上报改造而退化。

## 验证要求

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

建议人工验证：

1. 登录账号
2. 随机播放一条普通视频至少 `10s`
3. 返回历史页确认是否出现新记录
4. 再完整播完一条视频，确认历史是否更新为完成态

## 风险提示

- 当前仓库还没有面向哔哩哔哩写接口的统一 POST / `csrf` 基建。
- 当前播放器路由缺少 `aid`，这是落地历史上报前必须先补齐的数据缺口。
- 自动续播、切线路、reload 可能导致重复上报或漏上报，需要在实现时做节流与去重。

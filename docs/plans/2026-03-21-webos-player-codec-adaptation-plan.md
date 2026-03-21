# webOS 播放器编码自适配与手动切换落地方案

## 0. 2026-03-21 补充结论

本计划在第一轮落地后，已经完成：

- DASH 元信息获取
- codec 策略与手动切换
- 播放器设置入口

但在 `webOS TV 6.0 Simulator` 中继续出现 `MEDIA_ELEMENT_ERROR: Format error`。

补充排障结论见：

- [2026-03-21-webos-simulator-format-error-postmortem.md](/F:/CodeProjects/bilibili_webos/docs/postmortems/2026-03-21-webos-simulator-format-error-postmortem.md)

当前已确认：

- 问题不只在 codec 选择
- 还在于 B 站媒体直链对 `Referer/User-Agent` 的要求，以及当前 HTML5 `<video>` 执行链路本身的限制

因此本计划后续实施优先级已补充为：

1. 保持当前 codec 策略与播放器 UI 的稳定基线
2. 暂停 `webOS JS Service + 本地媒体 relay` 原型
3. 再评估下一条播放链路方案

同日晚些时候，失败原型已经从仓库代码中撤掉，当前稳定基线重新验证通过：

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run build:webos`
- `npm run webos:simulator`

这意味着：

- 当前代码已回到“可以正常构建、可以重新启动 Simulator”的状态
- 但这不等于“Simulator 已具备 B 站视频可播能力”
- 后续真机联调应先确认 UI 正常显示，再继续验证播放链路

## 1. 目标

本方案用于把当前播放器从“单条直链 MP4 直接喂给 `<video>`”升级为“面向 LG webOS TV 的可用编码自动适配播放器”。

本轮必须同时满足以下目标：

- 在 `LG C1` 真机上优先保证普通视频可播放。
- 在 `webOS Simulator` 中尽量可验证，但不把 Simulator 当成最终媒体能力判定标准。
- 播放器支持自动选择可用编码格式。
- 播放器提供用户可见、可聚焦、可持久化的“编码格式设置”入口。
- 设置入口放在当前播放器底部控制区右下角，即用户标注的红框位置。

本方案不追求一次性覆盖 HDR、杜比视界、会员特供、DRM 和所有稀有边界流，只优先保证 MVP 播放闭环。

## 2. 当前问题与根因

当前项目在 [bilibili.ts](/F:/CodeProjects/bilibili_webos/src/services/api/bilibili.ts) 的 `fetchPlaySource()` 中，仍然使用：

- `/x/player/playurl?...&fnval=0&otype=json`
- 读取 `durl[0].url`
- 最终在 [PlayerPage.tsx](/F:/CodeProjects/bilibili_webos/src/features/player/PlayerPage.tsx) 中直接执行 `video.src = sourceUrl`

这条链路的问题是：

- 没有拿到 DASH 视频流与音频流拆分信息。
- 没有拿到每条视频流的 `codecs`、`width`、`height`、`bandwidth`、`frameRate`。
- 没有按 `AVC / HEVC / AV1` 做选择。
- 没有同画质下的编码回退。
- 没有针对 webOS / LG TV 的能力探测。

因此网页端能播，不代表当前 webOS `<video>` 直喂单条 `durl` 流也能播。当前 `MEDIA_ELEMENT_ERROR: Format error` 更像是“当前返回的直链流不适合 webOS 当前播放链路”，而不是简单的“视频地址失效”。

## 3. 设备与平台结论

### 3.1 最终目标设备

目标电视为 `LG C1`，对应 `2021` 年平台，官方平台基线为 `webOS TV 6.0`。

### 3.2 C1 支持结论

基于 LG 官方规格与 webOS TV 6.0 音视频文档，可确认：

- `LG C1` 支持 `AVC`
- `LG C1` 支持 `HEVC`
- `LG C1` 支持 `AV1`

但“支持”不等于“当前随便一条网页流都能直接播”。最终是否成功，仍取决于：

- 容器类型
- 音频编码
- 视频编码 profile / level
- 是否为 DASH / fMP4 / durl 直链
- webOS `<video>` 的兼容边界

### 3.3 本轮编码优先级

虽然 `LG C1` 三种编码都支持，但 MVP 阶段不建议走“最先进编码优先”，而应走“电视稳定优先”。

本轮默认优先级定为：

1. `AVC`
2. `HEVC`
3. `AV1`

原因：

- `AVC` 在 webOS HTML5 `<video>` 路径下通常最稳。
- `HEVC` 可作为同画质下的增强回退。
- `AV1` 虽然 C1 支持，但在网页流、Simulator、不同封装组合上的不确定性更高。

后续如果真机联调证明 `HEVC` 在 C1 上稳定且收益明显，可以把 `Auto` 的设备画像策略升级为 `HEVC > AVC > AV1`。本轮先不这样做。

## 4. 对 Android 参考项目的结论

本仓库参考了 `F:\CodeProjects\bilibili_tv_android` 下的三个项目，结论如下：

### 4.1 `BT`

最值得借鉴。

它已经实现了：

- 请求 DASH 全格式 `fnval=4048`
- 从 `dash.video[].codecs` 中识别 `AVC / HEVC / AV1`
- 依据设备硬解能力和用户设置选 codec
- 采用“画质外层、codec 内层”的回退顺序
- 所有 DASH 失败后，再回退 `durl/mp4`

对 webOS 最有价值的不是它的 Android ExoPlayer 细节，而是它的“取流与回退策略”。

### 4.2 `PiliPlus`

也值得参考。

它已经实现了：

- 优先走 `dash.video + dash.audio`
- 先选画质，再在该画质下按 codec 偏好选流
- 无 DASH 时退回 `durl`

### 4.3 `bilitv`

可参考其 DASH 基础接入方式，但 codec 回退逻辑较弱，不适合作为主方案。

## 5. 本轮总体方案

### 5.1 核心思路

把当前播放器升级为四层结构：

1. **播放源获取层**
   从 B 站接口拿到 DASH + codec 元信息，而不是只拿 `durl`
2. **能力判定层**
   在 webOS 环境里判断当前设备更适合哪些编码
3. **策略选择层**
   根据用户设置和自动策略，从 `AVC / HEVC / AV1` 中选择当前最合适的流
4. **播放器执行层**
   将选中的流喂给 `<video>`，失败后执行同画质 codec 回退、再降画质、最后兼容流兜底

### 5.2 本轮不做的事情

- 不接 DRM
- 不做会员独占内容特殊适配
- 不做 HDR / 杜比视界完整链路
- 不引入重型播放器库
- 不在本轮做 MSE + 自定义 MPD 服务端拼装

本轮优先利用 B 站现有接口和 webOS 原生 `<video>` 跑通 TV 端最小闭环。

## 6. 数据结构升级

### 6.1 新的播放源模型

建议在 [types.ts](/F:/CodeProjects\bilibili_webos/src/services/api/types.ts) 中扩展如下模型：

```ts
export type VideoCodecPreference = 'auto' | 'avc' | 'hevc' | 'av1';

export type ParsedVideoCodec = 'avc' | 'hevc' | 'av1' | 'unknown';

export type PlayVideoStream = {
  id: number;
  quality: number;
  qualityLabel: string;
  codec: ParsedVideoCodec;
  codecs: string;
  url: string;
  backupUrls: string[];
  width: number;
  height: number;
  bandwidth: number;
  frameRate: number;
};

export type PlayAudioStream = {
  id: number;
  url: string;
  backupUrls: string[];
  bandwidth: number;
  codecs: string;
};

export type PlaySource = {
  mode: 'dash' | 'durl';
  durationMs: number;
  currentQuality: number;
  qualityLabel: string;
  qualities: Array<{
    qn: number;
    label: string;
    limitReason: number;
    codecs: ParsedVideoCodec[];
  }>;
  videoStreams: PlayVideoStream[];
  audioStreams: PlayAudioStream[];
  candidateUrls: string[];
};
```

### 6.2 codec 解析规则

建议新增一个轻量工具文件，例如：

- [src/features/player/playerCodec.ts](/F:/CodeProjects/bilibili_webos/src/features/player/playerCodec.ts)

解析规则：

- `codecs` 以 `avc` 开头 -> `avc`
- `codecs` 以 `hev` 或 `hvc` 开头 -> `hevc`
- `codecs` 以 `av01` 开头 -> `av1`
- 其他 -> `unknown`

## 7. B 站接口策略

### 7.1 首选接口

播放器首选改为请求：

- `/x/player/playurl`
- 参数使用 `fnval=4048`

目的：

- 获取 `dash.video`
- 获取 `dash.audio`
- 获取 `support_formats`
- 获取 `accept_quality`
- 获取每条视频流的 `codecs`

### 7.2 回退接口

如果 `fnval=4048` 返回异常或拿不到可用 DASH，再尝试：

1. `fnval=16`
2. `fnval=0`

这样做的原因是：

- 先争取拿到最完整的 DASH/codec 信息
- 不把所有失败都压到最终播放阶段
- 便于后续做兼容流兜底

### 7.3 音频策略

本轮优先规则：

- 如果 DASH 有 `audio`，优先取普通 `audio` 中最高码率音频
- 暂不处理杜比音频和 FLAC 的复杂分支

理由：

- 先保证普通视频可播
- 减少 webOS 首轮联调变量

## 8. webOS 能力判定策略

### 8.1 基础原则

webOS 与 PC 浏览器、Simulator 都不是同一套媒体能力。

因此自动策略不能简单写死为：

- Chrome 能播 -> TV 一定能播

也不能简单写死为：

- C1 官方支持 AV1 -> 当前页面一定先走 AV1

### 8.2 本轮判定方式

本轮采用“设备画像 + 浏览器能力探测 + 实播结果缓存”的组合方式。

#### A. 设备画像

通过 [webos.ts](/F:/CodeProjects/bilibili_webos/src/platform/webos.ts) 里已有的 `readDeviceInfo()` 扩展出：

- `modelName`
- `sdkVersion`
- `platformVersion`

并增加一个轻量判断：

- `LG C1 / webOS 6.x` 归类为 `webos-2021`

#### B. `canPlayType` 探测

播放器初始化时，对一个临时 `video` 元素执行：

```ts
video.canPlayType('video/mp4; codecs="avc1.640028, mp4a.40.2"')
video.canPlayType('video/mp4; codecs="hvc1.1.6.L120.B0, mp4a.40.2"')
video.canPlayType('video/mp4; codecs="av01.0.08M.08, mp4a.40.2"')
```

注意：

- 结果只作为“候选能力”参考
- 不作为最终成功保证

#### C. 实播结果缓存

建议新增本地持久化设置，例如：

- `lastSuccessfulCodecByDevice`
- `lastFailedCodecByDevice`

如果某台设备最近一次真实播放中：

- `AVC` 连续成功
- `AV1` 连续失败

那么 `Auto` 模式后续优先稳定成功的 codec，而不是每次重新试错。

## 9. 自动适配策略

### 9.1 用户设置项

播放器增加新的编码策略设置：

- `自动`
- `AVC`
- `HEVC`
- `AV1`

其中：

- `自动` 是默认值
- 其他三项是“强制偏好”

### 9.2 自动模式规则

针对 `LG C1` 的 MVP 自动策略：

1. 先在目标画质中找 `AVC`
2. 没有可用 `AVC` 再试 `HEVC`
3. 还没有再试 `AV1`
4. 都没有则同画质任意首条流

如果设备画像或实播缓存已经确认某 codec 不稳定，可在排序时提前降级。

### 9.3 手动模式规则

如果用户手动选择：

- `AVC`
- `HEVC`
- `AV1`

则同画质下优先只选该 codec 的流。

若当前画质没有该 codec：

- 显示提示：`当前清晰度没有 {codec} 编码，已自动切换到可用线路`
- 再按自动策略回退

### 9.4 回退顺序

必须采用与 `BT` 同方向的回退顺序：

1. 固定目标画质
2. 在该画质下遍历 codec 候选
3. 同画质所有 codec 都失败后，再降画质
4. 所有 DASH 都失败后，再退 `durl/mp4`

推荐画质降级序列：

- `120 -> 116 -> 112 -> 80 -> 64 -> 32 -> 16`

本轮可先从当前项目常用档位开始：

- `80 -> 64 -> 32 -> 16`

### 9.5 最终兜底

当 DASH 全部失败时：

- 请求 `durl/mp4`
- 优先 `qn=32`
- 作为“兼容保底线路”

提示文案建议：

- `当前编码线路不可用，已切到兼容模式`

## 10. 播放器设置入口设计

### 10.1 入口位置

入口放在当前播放器底部控制条右下角，即用户截图红框位置。

对应现有组件：

- [PlayerControlBar.tsx](/F:/CodeProjects/bilibili_webos/src/components/PlayerControlBar.tsx)

建议新增一个最右侧按钮：

- 图标：设置 / 调节
- 文案：`设置`

### 10.2 焦点布局

当前控制条是横向链路：

- 返回
- -10 秒
- 播放/暂停
- +10 秒
- 重载播放源

新增后变为：

- 返回
- -10 秒
- 播放/暂停
- +10 秒
- 重载播放源
- 设置

建议设置按钮的 `col` 放到 `15`，保持在最右端。

### 10.3 打开方式

设置按钮点击后，在播放器右侧弹出轻量面板，不建议本轮做全屏大弹窗。

原因：

- 电视端右侧抽屉更符合“边看边改设置”的习惯
- 返回链路更简单
- 不会遮挡进度条和主视频区域太多

### 10.4 设置项

本轮只放与播放闭环强相关的设置，避免过度设计。

建议面板包含：

1. `编码策略`
   - 自动
   - AVC
   - HEVC
   - AV1

2. `当前线路信息`
   - 当前画质
   - 当前 codec
   - 当前分辨率
   - 是否兼容流

3. `重新加载当前编码`
   - 用户修改后立刻按新策略重载

4. `恢复自动策略`
   - 一键回到 Auto

## 11. 状态管理与持久化

### 11.1 建议新增本地设置服务

建议新增：

- [src/features/player/playerSettings.ts](/F:/CodeProjects/bilibili_webos/src/features/player/playerSettings.ts)

建议存储项：

```ts
type StoredPlayerSettings = {
  codecPreference: 'auto' | 'avc' | 'hevc' | 'av1';
};
```

可以先用 `localStorage`，不必上复杂全局状态。

### 11.2 页面内状态

在 [PlayerPage.tsx](/F:/CodeProjects/bilibili_webos/src/features/player/PlayerPage.tsx) 中建议新增：

- `codecPreference`
- `selectedStream`
- `availableCodecsForCurrentQuality`
- `isSettingsOpen`
- `streamInfo`
- `retryState`

## 12. 文件落点建议

### 12.1 API 层

- [src/services/api/bilibili.ts](/F:/CodeProjects/bilibili_webos/src/services/api/bilibili.ts)
- [src/services/api/types.ts](/F:/CodeProjects/bilibili_webos/src/services/api/types.ts)

职责：

- 获取 DASH 播放信息
- 解析 `support_formats`
- 解析 `dash.video/audio`
- 输出统一 `PlaySource`

### 12.2 平台层

- [src/platform/webos.ts](/F:/CodeProjects/bilibili_webos/src/platform/webos.ts)

职责：

- 读取设备信息
- 输出基础设备画像

### 12.3 播放策略层

建议新增：

- [src/features/player/playerCodec.ts](/F:/CodeProjects/bilibili_webos/src/features/player/playerCodec.ts)
- [src/features/player/playerSettings.ts](/F:/CodeProjects/bilibili_webos/src/features/player/playerSettings.ts)

职责：

- codec 解析
- 自动排序
- 回退策略
- 本地设置读写

### 12.4 播放器 UI

- [src/features/player/PlayerPage.tsx](/F:/CodeProjects/bilibili_webos/src/features/player/PlayerPage.tsx)
- [src/components/PlayerControlBar.tsx](/F:/CodeProjects/bilibili_webos/src/components/PlayerControlBar.tsx)
- [src/styles/app.css](/F:/CodeProjects/bilibili_webos/src/styles/app.css)

职责：

- 设置按钮入口
- 右侧设置面板
- 当前流信息展示
- 焦点流与返回链路

## 13. 实施阶段

### Phase 1：数据与策略层

目标：

- 从 `durl` 升级到 `dash + codecs`
- 能在内存中完成 codec 选择

完成标准：

- `fetchPlaySource()` 能返回 `videoStreams/audioStreams/qualities`
- 能正确识别 `AVC / HEVC / AV1`
- `Auto` 模式能给出确定的候选顺序

### Phase 2：播放器接线

目标：

- `PlayerPage` 改为使用“选中流”播放
- 实现同画质 codec 回退
- 实现 DASH 失败后的 `durl/mp4` 兼容回退

完成标准：

- 当前格式不支持时，不再直接停在 `Format error`
- 能自动切换下一条 codec / 下一档质量 / 兼容流

### Phase 3：设置面板

目标：

- 在右下角接入设置入口
- 支持用户手动切编码

完成标准：

- 设置按钮可聚焦
- 设置面板可打开、关闭、返回
- 编码切换后能重载播放源
- 设置能持久化

### Phase 4：真机校准

目标：

- 用 `LG C1` 真机验证默认自动策略

完成标准：

- 至少验证 `AVC`
- 尝试验证 `HEVC`
- 记录 `AV1` 在 C1 上的真实表现
- 根据结果调整 `Auto` 的优先级

## 14. 错误处理与提示文案

建议区分三类错误：

### 14.1 取流失败

提示：

- `播放源获取失败，请稍后重试`

### 14.2 当前 codec 不可播

提示：

- `当前编码格式不可用，正在切换兼容线路`

### 14.3 所有线路失败

提示：

- `当前视频暂时无法在此设备播放，可尝试切换 AVC 或降低清晰度`

播放器页上保留详细错误短文案，方便后续排障，但避免直接暴露底层技术噪音给普通用户。

## 15. 验证方案

### 15.1 开发态验证

每次实现后至少执行：

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run webos:simulator`

### 15.2 Simulator 验证

验证目标：

- 设置入口是否可聚焦
- 手动切 `AVC / HEVC / AV1` 时 UI 是否正确
- 自动回退是否能触发

注意：

- Simulator 不作为最终“格式是否支持”的真值来源

### 15.3 LG C1 真机验证

必须验证：

1. 默认 `Auto`
2. 手动 `AVC`
3. 手动 `HEVC`
4. 手动 `AV1`

每个模式至少确认：

- 是否起播
- 是否有画面
- 是否有声音
- 拖动/暂停/恢复是否正常
- 返回链路是否稳定

## 16. 最终建议

本项目后续不应继续沿用“单条 durl 直链 + `<video>.src`”作为主播放方案。

面向 `LG C1 / webOS TV` 的最小可行正确方向应当是：

- **以 DASH + codec 识别为主**
- **以 AVC 为 MVP 默认优先**
- **同画质下先换 codec，再降画质**
- **全部失败后退 durl/mp4 兼容流**
- **播放器提供可见的用户设置入口**

这条路线已经被 `BT` 与 `PiliPlus` 两个 Android 项目从策略层面验证过，适合作为当前 webOS 播放器重构的直接落地方向。

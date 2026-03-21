# webOS 官方推荐播放路径与 B 站适配实施方案

## 1. 结论

本项目后续播放器实施，应明确切换到下面这条路线：

- **服务端侧**：把 B 站原始媒体地址整理成 webOS 友好的可控播放地址
- **TV 端侧**：按 LG 官方推荐路径，使用 `HTML5 <video>` / `<source>` + `mediaOption` + 平台支持的协议播放

换句话说，后续目标不是继续优化“`B 站原始直链 -> 当前 `<video>` 直接播放`”这条链路，而是：

1. 先在服务端解决 `Referer / User-Agent / Range` 与音视频整理问题
2. 再让 webOS 播放我们自己的 `MP4` 或 `HLS` 地址

这是当前最符合 **LG 官方推荐方案**、也最符合我们仓库既有排障结论的实施方向。

## 2. 官方推荐方案总结

## 2.1 对 Web App 的官方推荐入口

LG 官方并没有像三星 `AVPlay` 那样，为 webOS TV Web App 单独开放一套“专有原生播放器对象”。

官方推荐的入口仍然是：

- `HTML5 <video>` / `<audio>`
- `source[type="...;mediaOption=..."]`
- 平台支持的流协议
- 必要时配合 `DRM Service`、`MSE/EME`

官方资料可以归纳为两条主线：

- **普通非 DRM 媒体**
  - 推荐用 `HTTP/HTTPS` 或 `HLS`
  - 需要给 Media Pipeline 传额外播放参数时，用 `mediaOption`
- **DRM 媒体**
  - `PlayReady`：配合 `DRM Service` + `mediaOption`
  - `Widevine`：按 `HTML5 MSE/EME` 路线实现

这说明 webOS 的“原生播放”并不是一个单独 JS 对象，而是 **网页媒体元素和 Media Pipeline 的协作模式**。

## 2.2 官方明确支持的播放协议

根据 LG 官方 `Streaming Protocol and DRM`：

- `HTTP/HTTPS`：设备支持，模拟器也支持
- `HLS`：设备支持，`Emulator 5.0 - 6.0` 支持
- **未写在文档中的媒体/DRM 格式，不支持或不推荐使用**

这对我们很关键，因为它直接意味着：

- **不能把 “native player 直接支持 DASH” 当成前提**
- 如果要用 DASH，应视为 **HTML5 MSE/EME 播放器自己处理 DASH**
- 这时 webOS 只保证标准浏览器能力，不替我们兜底

## 2.3 官方对 mediaOption 的定位

官方 `mediaOption` 文档和续播文档说明：

- `mediaOption` 是 web app 层和 Media Pipeline 协作的扩展接口
- 可以把播放起点等播放参数直接交给 Media Player
- 对 `HLS`，`mediaOption` 在 webOS TV 3.0 及以后支持

对我们来说，这意味着：

- **真机上应该优先把续播点、播放模式等信息通过 `mediaOption` 传递**
- 不要把所有恢复播放逻辑都留在 JS 层 `loadedmetadata -> currentTime = ...` 之后再打补丁

## 2.4 官方对模拟器的边界说明

根据 `Simulator Introduction`，Simulator 有几个和本项目强相关的限制：

- 视频和音频规格与真实电视不同
- **不支持 DRM**
- **不支持 `mediaOption`**

因此后续任何实施文档都必须把两条验证链路拆开：

- **模拟器验证**
  - 验证基础协议可播性
  - 验证 UI、错误提示、遥控器操作、基础起播闭环
- **真机验证**
  - 验证 `mediaOption`
  - 验证实际 Media Pipeline 行为
  - 验证真实网络与解码边界

不能再把“模拟器不支持”误判成“真机也一定不支持”。

## 2.5 官方对平台播放能力的其他约束

官方资料还明确给出若干边界：

- 同时使用两个 `<video>`，或 `<video>` 与 `<audio>` 并行播放，不受官方支持
- 不支持快进/快退语义上的原生 `Fast Forward & Reverse`
- 不支持 `1.0` 以外倍速的原生保证
- 对 HLS 标签支持存在限制
- 音视频分段时长需要一致

这意味着：

- 我们不能用“双媒体元素 + 一个播视频一个播音频”的方式在 webOS 上做主播放链路
- 也不能把 B 站 DASH 的音视频分离流直接当成 webOS native pipeline 会自动接住

## 3. 我们之前遇到的问题总结

结合仓库内已有计划和复盘，当前问题已经不是“选错 codec”这么简单，而是更底层的播放链路不匹配。

已确认事实如下：

### 3.1 当前执行链路仍然是 HTML5 直连

我们当前播放器虽然已经补上：

- DASH 元信息获取
- `AVC / HEVC / AV1` 识别
- 自动策略与手动切换
- 同画质 codec 回退
- 兼容流回退

但执行层依然是：

- `HTMLVideoElement`
- `video.src = 某条候选地址`

这条链路没有触达官方推荐路径中的“可控协议整理”和“Media Pipeline 友好播放源”。

### 3.2 B 站媒体地址依赖请求头

已有复盘已经确认：

- B 站媒体直链在很多情况下需要：
  - `Referer: https://www.bilibili.com/`
  - PC `User-Agent`
- 缺少这些请求头时，可能返回 `403` 或非媒体内容

这会在 webOS 上表现成：

- `MEDIA_ELEMENT_ERROR: Format error`
- 黑屏
- 看起来像编码或格式问题，实际根因可能是请求链路不对

### 3.3 B 站 DASH 是音视频分离流

已有排障记录表明：

- `fnval=4048` 返回 `dash.video[] + dash.audio[]`
- 视频和音频是分离的

这意味着如果我们只把 `dash.video.baseUrl` 喂给 `<video>`：

- 不能保证有声音
- 也不能保证 webOS 会把它当成可直接播的完整媒体

### 3.4 之前“本机 JS Service relay”原型已经失败过

仓库文档里已经记录：

- 之前尝试过在 webOS app 内引入 `JS Service + 本地 relay`
- 结果是：
  - Simulator 仍然不可播
  - 真机上还一度影响 UI 启动基线

因此这条路线不能直接复活，至少不该作为主分支下一轮实施方向。

### 3.5 参考项目能播，不代表当前链路可行

参考项目 `PiliPlus` 能播的关键不是 codec 本身，而是：

- 使用更底层的原生播放器内核
- 可以显式设置媒体请求头
- 可以同时处理音视频流

因此它最多能证明：

- “更底层或更可控的播放执行层”是正确方向

它不能证明：

- “继续给 webOS `<video>` 喂 B 站原始地址，只要再多补一点 codec/回退逻辑就能播”

## 4. 为什么官方推荐方案和我们当前实现冲突

当前实现和官方推荐方案之间，主要有四个结构性错位：

### 4.1 我们在吃源站地址，官方推荐吃平台友好协议

官方推荐的稳定路径是：

- `HTTP/HTTPS`
- `HLS`
- DRM 时走 `DRM Service` 或 `MSE/EME`

而我们当前执行层吃的是：

- B 站原始直链
- 其中还包括需要额外请求头的兼容流
- 以及音视频分离的 DASH 数据

这不是平台最友好的输入形态。

### 4.2 我们把“选流”和“执行层”绑得太死

当前代码里已经开始把选流策略、兼容流回退、播放器执行混在一条链路里。

这导致：

- 一旦源地址形态变化
- 或后续引入 `HLS / relay / 外部媒体网关`

我们就得同时改：

- 接口层
- codec 层
- 执行层

后续架构应把它拆成：

1. 播放源决策层
2. 媒体地址整理层
3. TV 播放执行层

### 4.3 我们把模拟器和真机当成了一条验证链

这是此前排障里反复造成误判的原因之一。

但官方明确说明：

- Simulator 不支持 `mediaOption`
- Simulator 媒体规格与真机不同

所以后续任何验证都必须显式写清：

- 这个结论是“模拟器结论”
- 还是“真机结论”

### 4.4 我们还没有一个可控的媒体出口

只要 TV 端直接拉 B 站媒体地址，后续就始终会被下面这些问题牵制：

- 请求头
- Range
- CDN 线路
- DASH 音视频整理
- MIME / 封装差异

没有可控媒体出口，TV 端就永远在被动试错。

## 5. 推荐实施路线

## 5.1 最终推荐路线

推荐后续正式实施采用：

**外部媒体网关 + webOS 官方播放路径**

具体形态为：

1. **媒体网关层**
   - 部署在外部服务，不放在 TV 设备内
   - 负责请求 B 站媒体时补齐：
     - `Referer`
     - `User-Agent`
     - `Range`
   - 负责把上游媒体整理成 webOS 更容易消费的输出

2. **TV 播放层**
   - 使用 `HTML5 <video>` / `<source>`
   - 在真机上接入 `mediaOption`
   - 优先消费：
     - 稳定 `MP4`
     - 或稳定 `HLS`

3. **策略层**
   - 继续保留当前项目已经做好的：
     - codec 偏好
     - 画质回退
     - 用户可见设置项
   - 但它不再直接决定“最终把哪个 B 站地址塞给 `<video>`”

## 5.2 为什么推荐“外部网关”而不是“TV 本地 relay”

### 外部网关的优点

- 不影响 TV 端 UI 启动基线
- 不依赖 JS Service 在模拟器/真机上的复杂差异
- 网络层、请求头、Range 都更容易控制
- 便于用桌面工具单独验证返回内容是否真的是 `video/mp4` 或 `HLS`
- 后续可以独立演进转封装策略

### TV 本地 relay 的问题

- 仓库里已经做过失败原型
- 容易拖累打包和启动链路
- 模拟器与真机表现差异更大
- 不适合作为下一轮主分支方案

## 5.3 为什么推荐“MP4/HLS 输出”而不是“直接喂 DASH”

### `MP4` 输出适合 Phase 1

优点：

- 最容易验证
- 最接近“先让模拟器播起来”
- 有助于先确认：问题是不是主要来自源地址与请求头

缺点：

- 自适应码率能力弱
- 后续多档位切换体验不如 HLS

### `HLS` 输出适合 Phase 2

优点：

- 更贴近 webOS 官方推荐协议
- 更适合后续真机优化
- 模拟器 5.0 - 6.0 也支持 HLS

缺点：

- HLS 标签和分段组织必须遵守 LG 文档限制
- 媒体网关实现复杂度高于简单 MP4 relay

### 不建议把“直接 DASH + webOS native”作为主路线

原因：

- 官方明确说明 `native player` 并不直接支持 DASH
- 如果使用 DASH，那是播放器自己的 MSE/EME 处理，不是 webOS 在兜底
- 我们当前核心问题又不只是 DASH 本身，还包括请求头和音视频整理

## 6. 分阶段实施方案

## 6.1 Phase A：文档与架构收口

目标：

- 停止继续扩展“B 站原始直链 + `<video>` 直接播放”路线
- 明确未来接口模型以“可控媒体地址”为中心

动作：

- 保留现有 codec 选择与 UI 设置项
- 在播放模型中明确区分：
  - 原始候选流
  - 媒体网关输出地址
  - TV 最终播放地址
- 明确模拟器和真机的不同验证标准

交付结果：

- 当前文档
- 后续代码改造清单

## 6.2 Phase B：外部媒体网关最小验证

目标：

- 先验证“只要播放的不是 B 站原始直链，webOS 播放链路是否明显改善”

建议最小能力：

- 输入：
  - `bvid`
  - `cid`
  - `quality`
  - `codec`
- 输出：
  - 单条稳定 `MP4` 地址
- 服务端处理：
  - 补齐请求头
  - 透传 Range
  - 返回正确 MIME

验收：

- 桌面浏览器中可直接访问返回的媒体地址
- `curl` 或浏览器 Network 中能看到正确 `206` / `Content-Type`
- 模拟器能开始起播或至少进入更明确的媒体错误，而不再是源站 403 伪装成格式错误

## 6.3 Phase C：TV 端接入“官方播放路径”

目标：

- 真机按官方推荐路径播放可控媒体地址

改造点：

- webOS 环境下用 `<source>` 而不是只写 `video.src`
- 根据媒体类型设置：
  - `video/mp4`
  - `application/vnd.apple.mpegurl`
- 真机上补 `mediaOption`
  - 续播点
  - 传输相关参数
- 设置抽屉增加运行时可见信息：
  - 当前播放协议
  - MIME
  - 是否走媒体网关
  - Native media error

模拟器特殊处理：

- 不启用 `mediaOption`
- 保持同一套 UI 和错误提示
- 只验证基础可播性与错误暴露

## 6.4 Phase D：HLS 化与真机优化

目标：

- 从“能播”升级到“更符合 webOS 习惯的稳定播放”

动作：

- 媒体网关输出 HLS
- 确保：
  - 音视频分段时长一致
  - 不使用 LG 文档标记为不支持的 HLS 标签组合
- 保留 MP4 输出作为保底回退线路

验收：

- 模拟器 6.0 可验证 HLS 起播
- LG C1 真机可完成：
  - 进入播放器
  - 自动续播
  - 暂停/继续
  - 返回

## 7. 不建议继续投入的方向

以下方向不建议再作为主线投入：

### 7.1 继续在当前直连链路上堆 codec/回退逻辑

原因：

- 已有文档证明根因不只 codec
- 继续堆逻辑只会让执行层更复杂，不能解决请求头与流形态问题

### 7.2 立即复活仓内 JS Service relay 原型

原因：

- 该原型已有失败记录
- 对 UI 启动基线有副作用
- 不适合作为下一轮主分支实施方向

### 7.3 直接押注 MSE/DASH 成为主实现

原因：

- 技术复杂度最高
- 仍未解决 B 站源站请求头问题
- 不符合当前 MVP 优先级

## 8. 验证策略

## 8.1 模拟器验证

只验证：

- UI 正常进入播放页
- 媒体地址可请求
- 基础起播是否成功
- 错误信息是否更明确

不把以下结果当成最终否决依据：

- `mediaOption` 相关行为
- DRM
- 真机专属的 Media Pipeline 表现

## 8.2 真机验证

必须验证：

- `mediaOption` 是否生效
- 续播点是否正确
- 遥控器主链路是否稳定
- LG C1 上 `MP4/HLS` 的真实可播性

## 8.3 必跑命令

每轮实施后至少执行：

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run build:webos`

涉及模拟器联调时执行：

- `npm run webos:simulator`

涉及真机联调时执行：

- `npm run webos:package`
- `npm run webos:install -- --device <deviceName>`
- `npm run webos:launch -- --device <deviceName>`

## 9. 下一步任务清单

1. 在播放器数据模型中增加“媒体网关输出地址”字段，和“原始 B 站地址”彻底解耦。
2. 设计并实现一个最小外部媒体网关，先输出可直播的 `MP4`。
3. TV 端播放器改成：
   - 支持 `<source type="...">`
   - 为后续 `mediaOption` 预留结构
4. 在模拟器上先验证“可控 MP4 地址”是否可播。
5. 再在真机上验证 `mediaOption + MP4/HLS`。

## 10. 参考资料

### 官方资料

- [Streaming Protocol and DRM](https://webostv.developer.lge.com/develop/specifications/streaming-protocol-drm)
- [mediaOption Parameters](https://webostv.developer.lge.com/develop/guides/mediaoption-parameter)
- [Resuming Media Quickly with mediaOption](https://webostv.developer.lge.com/develop/guides/resuming-media-with-mediaoption)
- [DRM Content Playback](https://webostv.developer.lge.com/develop/guides/drm-content-playback)
- [Simulator Introduction](https://webostv.developer.lge.com/develop/tools/simulator-introduction)
- [Technical FAQ](https://webostv.developer.lge.com/faq)
- [Issue: The Accept-Language request HTTP header cannot be set on webOS TV 5.0](https://webostv.developer.lge.com/faq/2022-11-15-the-accept-language-request-http-header-cannot-be-set-on-webos-tv-5.0)
- [Custom headers to DRM license server request](https://forum.webostv.developer.lge.com/t/custom-headers-to-drm-license-server-request/11091)

### 仓库内资料

- [2026-03-21-webos-player-codec-adaptation-plan.md](/F:/CodeProjects/bilibili_webos/docs/plans/2026-03-21-webos-player-codec-adaptation-plan.md)
- [2026-03-21-webos-simulator-format-error-postmortem.md](/F:/CodeProjects/bilibili_webos/docs/postmortems/2026-03-21-webos-simulator-format-error-postmortem.md)

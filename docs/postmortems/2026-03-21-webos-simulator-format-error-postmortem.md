# 2026-03-21 webOS Simulator `Format error` 排障记录

## 结论

本次 `webOS TV 6.0 Simulator` 上的播放器黑屏与 `MEDIA_ELEMENT_ERROR: Format error`，根因已经从“单纯 codec 选择错误”收敛为“**媒体请求链路与播放器内核能力不匹配**”。

当前仓库已经补上：

- DASH 元信息获取
- `AVC / HEVC / AV1` 识别
- 自动策略与手动策略
- 同画质与降画质回退
- 播放器右下角设置入口

但这些只解决了“选哪条流”的问题，没有解决“**webOS 当前播放链路是否真的能把这条流拉下来并正确解码**”的问题。

## 复现现象

在 `webOS TV 6.0 Simulator` 中：

- 播放器页面可以正常打开
- 顶部可以看到当前策略、画质与 codec 提示
- 兼容流切换逻辑会触发
- 最终仍可能停在：
  - `当前线路不可用，正在切换 360P 流畅 备选地址`
  - `MEDIA_ELEMENT_ERROR: Format error`

说明问题不是“没有做回退”，而是“回退后的媒体资源仍然没有被当前链路正确消费”。

在 `LG C1 / webOS TV 6.0` 真机上，修复 UI 启动链路之后也完成了同类验证，现象与 Simulator 高度一致：

- 应用 UI 已能正常显示
- 播放器页可打开
- codec 策略、画质与错误提示都能显示
- 在切到 `360P 流畅` 兼容流后，仍会停在：
  - `当前线路不可用，正在切换 360P 流畅 备选地址`
  - `MEDIA_ELEMENT_ERROR: Format error`

这说明：

- **“真机 UI 启动问题”已经被单独解决**
- **“视频仍然播不出来”是独立的第二个问题**
- 不能再把“页面不显示”和“播放失败”混为同一个根因

## 已确认事实

### 1. B 站 `playurl` 的 DASH 是音视频分离流

对真实接口样本做了验证：

- `fnval=4048` 返回 `dash.video[] + dash.audio[]`
- 视频通常是 `.m4s`
- 音频通常是独立 `audio/mp4`

这意味着如果只把 `dash.video.baseUrl` 塞给 HTML `<video>`：

- 不能保证有声音
- 也不能保证 webOS HTML5 播放器路径能正确消费

### 2. `durl/mp4` 兼容流也依赖正确请求头

对真实 B 站媒体直链做了请求验证，结论是：

- 不带 `Referer/User-Agent` 时，很多媒体直链会返回 `403`
- 带上 `Referer: https://www.bilibili.com/` 与桌面 `User-Agent` 后，可以返回 `206 video/mp4`

因此表面上的 `Format error`，有较大概率其实是：

- `<video>` 收到了 HTML/403 页面
- 或收到了当前环境无法直接消费的媒体响应

### 3. `PiliPlus` 可播的关键不只是 codec 选择

参考项目 [PiliPlus](F:/CodeProjects/bilibili_tv_android/PiliPlus) 的核心结论：

- 它确实使用 `fnval=4048`
- 也确实按画质内 codec 做选择
- 但真正决定“能播”的关键在于：
  - 使用 `media_kit/mpv` 原生播放器内核，而不是浏览器 `<video>`
  - 显式设置媒体请求头：
    - `Referer: https://www.bilibili.com`
    - PC `User-Agent`
  - DASH 场景下把视频流和音频流一起交给播放器内核处理

也就是说，`PiliPlus` 成功播放并不能证明“webOS HTML5 `<video>` + 直连 B 站媒体地址”一定可行。

## 为什么此前方案还不够

当前仓库的播放器虽然已经升级为“带 codec 策略的播放器”，但执行层仍然是：

- `HTMLVideoElement`
- `video.src = 某条候选地址`

这条执行路径和 `PiliPlus` 的真实播放路径有两个本质差异：

1. 无法稳定给媒体请求附加 `Referer/User-Agent`
2. 无法像原生播放器内核一样优雅处理 DASH 分离流

因此只优化“选流顺序”并不能彻底解决问题。

## 两条后续路线

### 路线 1：webOS 侧媒体中继层

思路：

- 在 webOS app 内新增 JS Service
- Service 在本机启动一个本地 HTTP relay
- 由 relay 去请求真实 B 站媒体地址，并补齐：
  - `Referer`
  - `User-Agent`
  - `Range`
- 前端 `<video>` 不再直接播放 B 站地址，而是播放 `127.0.0.1` 上的 relay 地址

效果：

- 保留当前 React + `<video>` 架构
- 改动范围可控
- 优先解决“媒体请求头导致 403/格式错误”的问题

风险：

- 需要在 webOS 打包链路中引入 JS Service
- Simulator 的“目录直启模式”不一定天然带服务，需要额外验证
- webOS 官方社区对“把 TV 设备当作 HTTP 服务器”持保留态度，因此这条路线当前只能视为实验性原型，不能提前当作平台保证能力

### 路线 2：改走更接近原生播放器的方案

思路：

- 不再继续依赖 HTML5 `<video>`
- 改用 webOS 原生媒体能力或更底层的播放器方案

效果：

- 更接近 `PiliPlus` 的真实播放路径
- 对 DASH 音视频分离流更友好

风险：

- 改造面更大
- 与当前前端架构耦合更深
- MVP 阶段实现与调试成本显著更高

## 决策

当日下午的初始决策，确实是先按 **路线 1：webOS 侧媒体中继层** 做原型推进。

当时的判断依据是：

- 更符合当前仓库的 MVP 状态
- 能最小化复用现有 React + `<video>` 架构
- 最有希望优先解决“B 站媒体请求头 + webOS 兼容流拉取失败”的主问题

但这个决策只代表“当时先做哪条试验线”，不代表路线 1 已被验证可行。

## 2026-03-21 晚间补充

路线 1 已做过一轮原型接入：

- 新增 JS Service
- 修改 webOS 打包，把 service 一起打进 IPK
- 前端尝试通过 Luna / PalmServiceBridge 启动 relay

实测结果：

- Simulator 仍无法播放
- 打包安装到电视后，UI 本身也出现异常，不能作为可继续演进的基线

因此当前结论更新为：

- **路线 1 的这版原型实现已暂停使用**
- 文档中的分析结论保留
- 仓库代码回退到“不包含 media relay service”的稳定状态后，再继续寻找下一条可行路线

同日晚些时候，回退后的稳定基线已经重新验证通过：

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run build:webos`

同日晚些时候，又补上了一轮真机启动链路修复：

- webOS 打包产物改为强制走 legacy 非 module 入口
- `LG C1` 真机 UI 已恢复显示

这轮修复带来的新增结论是：

- 当前仓库已具备“Simulator UI 正常 + 真机 UI 正常”的启动基线
- 但播放器在真机上仍然是 `MEDIA_ELEMENT_ERROR: Format error`
- 因此后续工作可以明确聚焦到“媒体请求头 / DASH 分离流 / 播放器执行层”本身，而不是继续怀疑 UI 启动链路

## 直接行动项

1. 保留当前 codec 策略、播放器设置入口和兼容流回退逻辑，作为后续联调基线。
2. 保留当前真机 legacy 启动链路修复，不要再把“页面不显示”和“媒体不可播”混成一个问题排查。
3. 不再继续复活这版 `JS Service + media relay` 原型，避免再次把 UI 启动链路带坏。
4. 后续新的播放链路方案，必须同时满足两个前提：
   - 不影响电视端 UI 正常启动和显示
   - 能明确解释 `Referer/User-Agent` 与 DASH 分离流的处理方式
5. 下一条路线在真正落地前，先做更小范围的技术验证，再决定是否接入主分支代码。

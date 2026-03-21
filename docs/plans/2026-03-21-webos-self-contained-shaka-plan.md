# 2026-03-21 webOS 自包含播放器重构方案

## 1. 直接结论

当前仓库原先那条 `HTML5 <video> + 外部 media-gateway + B 站兼容流 MP4` 主链路，已经判定为错误方向。

新的主方案改为：

1. 在 **电视 App 内** 直接请求 B 站 `playurl`
2. 解析 `dash.video[] / dash.audio[] / segment_base`
3. 在前端内存中生成 **标准 MPEG-DASH MPD**
4. 使用 **Shaka Player + MSE** 驱动 `HTMLVideoElement`
5. 保留播放器里的编码选择能力，但**不再自动降级到更低画质**

这条路线的目标是：

- **不依赖另一台电脑上的常驻服务**
- 尽量贴近 LG 官方 Web App 播放建议
- 让 B 站的音视频分离流走标准 DASH 播放路径，而不是继续把任意 MP4 直链硬塞给 `<video>`

## 2. 为什么旧方案必须废弃

旧方案的核心问题不是“少写了一点兼容代码”，而是**执行层选错了**。

旧方案做了很多“选流策略”工作：

- codec 识别
- 画质回退
- 兼容流回退
- 外部网关补地址

但真正执行时仍然是：

- 前端拿到某条地址
- 直接喂给 `<video>`

这会带来三个根问题：

1. **B 站 DASH 本质是音视频分离轨**
   - 只拿单条视频地址或单条兼容流地址，不代表就是最适合 TV 的播放形态。

2. **外部 media-gateway 产品形态不可接受**
   - 用户已经明确否决“另一台电脑常驻服务”的方案。
   - 即使技术上能救火，也不满足最终产品要求。

3. **LG TV 官方示例并不推荐“任意 MP4 直连”作为主路线**
   - 官方示例更接近“标准 DASH/HLS + Web App 播放器”。

## 3. 官方推荐路径整理

### 3.1 LG 官方文档的关键结论

结合 LG 官方文档与官方论坛结论，可以把 webOS TV Web App 播放建议收敛成下面三点：

1. **Web App 正常路线是 HTML5 视频能力 + MSE/EME**
   - 不是提供一个“任意格式万能播放器内核”。
   - App 自己需要按平台支持的协议和媒体形态接入。

2. **标准流媒体协议优先**
   - 官方规格文档长期围绕 `MPEG-DASH / HLS / DRM` 展开。
   - 官方 GitHub 示例 `MediaPlayback` 直接使用 **Shaka Player + DASH/HLS URL**。

3. **webOS TV 6.0（LG C1 所在世代）本身支持主流视频编码**
   - H.264/AVC
   - HEVC
   - AV1
   - 说明问题重点不在“电视完全不支持这些 codec”，而在于**我们如何把 B 站流喂成平台真正推荐的播放形态**。

### 3.2 GitHub 示例项目对我们的启发

#### `webOS-TV-app-samples/MediaPlayback`

- 这是 LG 官方示例。
- README 明确写的是：
  - Web App
  - Shaka Player
  - DASH URL / HLS URL
- 启发：
  - 官方推荐的 Web App 方向，是**标准流媒体协议 + Web 播放器**。
  - 不是“继续堆各种 proxy 和直链兜底逻辑”。

#### `radiantmediaplayer/rmp-webos`

- 这是商业播放器在 webOS 上的示例。
- 支持形态也是：
  - MPEG-DASH
  - HLS
- 启发：
  - 第三方成熟播放器在 webOS TV 上，也是在走**标准 DASH/HLS**。

#### `webosose/com.webos.app.videoplayer`

- 这个项目更偏 **本地媒体文件播放器**。
- 代码里主要是通过 media indexer 列本地视频，再把 `file_path` 喂给播放器组件。
- 启发：
  - 它证明了 `<source src="本地文件">` 这类本地媒体场景是成立的。
  - 但它**不能证明**“远程 B 站媒体直链”也应该按这个方式做。

## 4. 两个参考项目的真实意义

### 4.1 `youtube-webos`

- 它本质上是对 YouTube 官方 TV 页面/官方播放器体系做增强与重定向。
- 它不是一个“第三方通用视频播放器”。
- 所以它能播，**不等于**我们也能继续依赖裸 `<video>` 去播任意 B 站地址。

### 4.2 `PiliPlus`

- 它走的是 `media_kit / mpv` 路线。
- 它的本质是：
  - 先从 B 站接口拿 DASH 元信息
  - 再把选中的视频轨和音频轨交给原生播放器内核
- 所以它能播，证明的是：
  - **B 站 DASH 音视频分离轨是正确源数据**
  - 不是“兼容流 MP4 直连”才是唯一方案

对我们最有价值的不是照抄 `PiliPlus` 的 Flutter 实现，而是学习它的播放事实：

- B 站播放应以 `dash.video + dash.audio` 为主
- codec 选择应该发生在**轨道选择层**
- 执行层应该是“真正支持 DASH/分离轨”的播放器

## 5. 新架构设计

## 5.1 总体链路

```text
B 站 playurl
  -> 解析 dash.video / dash.audio / segment_base
  -> 按当前质量与 codec 偏好选中一组视频轨 + 音频轨
  -> 在前端生成临时 MPD Blob URL
  -> Shaka Player 加载 MPD
  -> MSE 驱动 HTMLVideoElement
```

## 5.2 设计原则

1. **电视端自包含**
   - 不依赖外部 PC 服务
   - 打包后 App 自己就能工作

2. **标准协议优先**
   - 不再把兼容流 MP4 直连当作主路径
   - 主路径改为 DASH

3. **不自动降级画质**
   - 用户已经明确不接受播放几秒后自动掉到 360P
   - 当前阶段只做：
     - 当前清晰度下的 codec 选择
     - 同轨备选地址切换
   - 不做自动降到更低质量

4. **编码选择仍然可用**
   - 播放器设置里的 `Auto / AVC / HEVC / AV1` 继续保留
   - 但含义变成：
     - 选择哪条 DASH 视频轨
     - 而不是对兼容流做“伪 codec 切换”

## 5.3 本次落地的代码改动

### A. 补齐播放源数据结构

- `src/services/api/types.ts`
- `src/services/api/bilibili.ts`

新增并接入：

- `mimeType`
- `segmentBase`
- 独立音频轨信息

这一步是为了让前端有足够数据生成标准 MPD。

### B. 新增前端 DASH 清单生成器

- `src/features/player/playerDashManifest.ts`

职责：

- 把当前选中的视频轨/音频轨转换成临时 MPD 文本
- 生成 `Blob URL`
- 播放完成或切换线路后主动回收 URL

### C. 新增 Shaka 执行层

- `src/features/player/playerShaka.ts`

职责：

- 安装 Shaka polyfill
- 检查浏览器/MSE 支持
- 加载前端生成的 MPD
- 将错误统一回传给播放器页

### D. 播放器页切换到新主链路

- `src/features/player/PlayerPage.tsx`

变化：

- DASH 成为主路径
- `<video>` 不再直接接 B 站视频轨
- 优先使用 `Shaka + MPD Blob`
- 兼容流只在没有 DASH 时作为保底路径
- 取消“自动降级到更低画质”的逻辑

### E. webOS 构建与旧媒体网关彻底脱钩

- `scripts/build-webos.mjs`

变化：

- `build:webos` 不再读取旧媒体网关相关配置
- 这样可以避免新方案落地后仍被旧代理残留误导

## 6. 当前实施边界

本次重构先只保证：

1. 普通视频走 **DASH + Shaka** 主链路
2. 编码切换按钮能正常工作
3. 不再依赖外部媒体网关
4. 保留基本的播放记录、重载和备选地址切换

本次**暂不做**：

- 自动画质切换
- 复杂 ABR 策略
- 会员/版权内容专项处理
- 额外 JS Service / 本地 relay

## 7. 验证方式

## 7.1 已完成的静态验证

已经通过：

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run build:webos`

## 7.2 接下来要做的人工验证

### Simulator

1. 打开一个普通可播视频
2. 进入播放器页
3. 观察是否能正常出图像与声音
4. 打开设置面板
5. 在 `Auto / AVC / HEVC / AV1` 之间切换
6. 确认：
   - 切换后播放器会重新加载
   - 不会自动掉到更低画质
   - 能看到当前执行 codec

### LG C1 真机

1. 安装最新 IPK

## 8. 2026-03-21 补充记录

### 8.1 关于“有些视频没有 AVC”的现阶段结论

今天补做了一轮公开样本排查：

- 抽样了 80 条热门公开视频
- 其中 78 条返回了 DASH 视频轨
- 在这批样本里，**没有发现“完全没有 AVC 轨”的公开视频**

这说明：

1. “B 站很多视频根本不提供 AVC” 目前**不是主结论**
2. 更常见的情况是：
   - 接口宣称某个清晰度支持多种 codec
   - 但这次实际返回的 `dash.video[]` 分轨档位可能更低，或和宣称信息不完全一致

所以播放器后续判断必须区分两层信息：

- **接口宣称编码**：`support_formats[].codecs`
- **实际返回编码**：本次 `dash.video[]` 里真正拿到的轨道

### 8.2 本次补充修正

针对上面的结论，播放器已经补了两项修正：

1. 设置面板里把：
   - `实际返回编码`
   - `接口宣称编码`
   分开显示，避免误判

2. 编码切换按钮改为只允许切到**本次实际返回**的 codec
   - 不再把本次没有返回的 codec 展示成可切换状态
   - 避免用户误以为“AVC 可切但播放失败”

### 8.3 Shaka 接入补充

`playerShaka.ts` 已改成 Shaka 官方建议的 `attach()` 方式：

- 先创建 `new shaka.Player()`
- 再 `attach(video)`
- 最后 `load(manifestUrl)`

这样可以减少接入层告警，后续更方便判断真机上究竟是：

- codec/分轨问题
- 还是 MSE/解码链路问题
2. 打开同一条普通视频
3. 先测 `Auto`
4. 再强制切到 `AVC`
5. 确认：
   - 不需要电脑上额外跑服务
   - 真机有图像
   - 切 codec 后行为符合预期

## 8. 后续建议

如果这条 `Shaka + 前端 MPD` 主链路在真机上成立，下一步建议按下面顺序继续：

1. 真机实测确认 `AVC` 为最稳基线
2. 再逐步验证 `HEVC / AV1`
3. 若有个别内容仍失败，再基于失败样本分析：
   - 是否缺少可用 `segment_base`
   - 是否音频轨选择不对
   - 是否个别 codec 对当前设备不稳定

如果这条路线依然失败，那么下一层结论会非常明确：

- **不是继续修 Web App 选流逻辑**
- 而是需要认真评估“是否必须切到原生播放器内核路线”

但在当前阶段，`Shaka + DASH` 是最符合 LG 官方建议、同时又满足“电视端自包含”的唯一合理主方案。

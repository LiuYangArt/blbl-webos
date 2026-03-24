# 2026-03-24 播放器 1080P 请求被兼容流 720P 语义污染 Postmortem

## 结论

这次问题的真正根因，不是“B 站接口不给 1080P”，也不是“Simulator 天生只能播到 720P”，而是：

1. 接口其实已经返回了 `1080P DASH` 分轨
2. 仓库内部又继续请求了一组兼容流
3. 旧逻辑把兼容流里最高可回退的档位，误当成了“当前实际画质”
4. 后续播放器选轨、诊断面板、状态文案都继续消费了这个被污染的字段

最终用户看到的就像：

- 明明请求了 `1080P`
- 诊断里却长期显示 `720P`
- 实际播放尝试也可能被带到兼容流优先

这次修复的关键不是继续猜会员权限或 CDN host，而是把四件事彻底拆开：

1. 请求画质
2. 接口实际返回画质
3. 兼容流最高回退画质
4. 当前执行画质

## 用户可见现象

Issue `#9` 与后续联调中，用户反馈的核心现象是：

1. 明确选择 `1080P` 后，页面仍然显示接近 `720P`
2. 即使接口限制码是 `0`，也会出现“像是被降档”的体感
3. 本地 `webOS Simulator` 里也能复现，不只是电视真机单点问题

用户还进一步强调了一个很重要的产品约束：

- **Simulator 和电视最终都是为电视端播放服务，高层播放策略必须保持一致**

这直接否掉了“Simulator 单独走一套兼容流优先策略”的方向。

## 已确认事实

### 1. 接口并没有一开始就拒绝 1080P

针对样本视频抓到的 telemetry 说明：

1. `requestDashPlaySource()` 可以拿到 `quality=80`
2. `dash.video` 中存在 `1080P AVC` 分轨
3. `compatibleSources` 里同时可能只有 `720P`

也就是说：

- `DASH` 已经给到 `1080P`
- 兼容流只是兜底层，不该反过来定义“当前实际画质”

### 2. 旧数据模型把两层语义混在了一起

旧逻辑中：

1. `currentQuality` 既被页面当成“接口实际返回档位”
2. 又被播放器当成“当前要拿来选轨的档位”
3. 还会被兼容流的首个可用档位覆盖

一旦兼容流只有 `720P`：

1. `currentQuality` 会从 `1080P` 变成 `720P`
2. `getResolvedDashStreams()` 也会开始按 `720P` 过滤分轨
3. 诊断面板与设置页同时一起误报

所以这不是单纯“文案显示不准”，而是**真实决策也可能被带偏**。

### 3. Simulator 曾经被误识别成真实 webOS 设备

排查过程中又确认了另一层问题：

1. `WebAppManager` UA 的 Simulator 会话没有被稳定识别成 `webos-simulator`
2. 旧逻辑里，Simulator 可能落入 `webos-6` 之类的真实设备分类
3. 这样会让我们误判播放优先级和回退顺序

这个问题单独看会让人以为“是设备分类错了”，但它不是全部根因，只是让排查更混乱。

### 4. 即使识别正确，排序器也可能重新把兼容流顶上来

在修正设备分类后，继续抓 telemetry 发现：

1. `codecMemory.lastSuccessfulMode` 可能保留着 `compatible`
2. 排序器会给兼容流较高历史加分
3. 即使 `DASH` 已满足请求档位，也可能被重新压到后面

这说明只修 `deviceClass` 还不够，必须把排序规则也改掉。

## 根因

本次问题可以概括为：

> 播放器把“兼容流最高可回退画质”错误复用了“接口实际返回画质”的字段，导致 DASH 选轨、调试信息和播放排序同时被低档兼容流污染；同时 Simulator 设备识别与排序启发式又放大了这种误判。

## 修复方案

### 1. 拆分播放源质量语义

在 `PlaySource` 中明确拆出：

1. `returnedQuality / returnedQualityLabel`
2. `compatibleQuality / compatibleQualityLabel`
3. `qualityReason`
4. `requestTrace`

这样之后：

1. `returnedQuality` 只表示接口这次真正返回的主要档位
2. `compatibleQuality` 只表示兼容流可回退的最高档位
3. 两者不再互相覆盖

### 2. DASH 选轨只尊重 DASH 实际返回档位

播放器侧改成：

1. `getResolvedDashStreams()` 优先按 `returnedQuality` 选轨
2. `buildCompatibleAttempts()` 只按 `compatibleQuality` 取兜底兼容流
3. 不再共享同一个“当前画质”字段

这样当接口已返回 `1080P DASH`、兼容流最高只有 `720P` 时：

1. 首选依然是 `1080P DASH`
2. `720P compatible` 只会留在回退链路里

### 3. Simulator 与电视统一高层播放策略

本次明确收敛成一个规则：

1. `Simulator` 不再单独走“兼容流优先”的高层策略
2. `Simulator` 和真机共用同一套播放尝试排序
3. 唯一保留的差异只在底层媒体代理补头，用于解决 `file://` 环境下对 bilivideo CDN 的请求限制

这满足了用户“Simulator 和电视体验必须一致”的要求，也避免后续再出现“两边表现像两套产品”的问题。

### 4. 当 DASH 已满足请求档位时，排序器强力偏向 DASH

排序规则新增一条硬约束：

1. 如果 `playSource.mode === 'dash'`
2. 且 `bestDashQuality >= requestedQuality`
3. 则兼容流会被显著降权

这样历史 `codecMemory` 依然能参与细调，但不能再把已经满足请求档位的 DASH 路线轻易挤掉。

### 5. 诊断面板改成展示真实决策链

播放器页现在明确区分展示：

1. 请求画质
2. 接口实际返回
3. 兼容流最高回退
4. 当前执行画质
5. 画质决策说明
6. 请求参数追踪

这样以后再看到“用户说还是 720P”时，可以第一时间判断：

1. 是接口没给到
2. 还是播放器误选
3. 还是只有兼容流可播

## 验证结果

本次修复后，重新在 Simulator 上验证了以下样本：

1. `BV1Sf4y1q7H9`
2. `BV1wqoGYxEox`
3. `BV1YsApzLEmw`

关键结果一致：

1. `deviceClass = webos-simulator`
2. `playbackAttemptModes = ["dash", "dash", "compatible"]`
3. 首个 `attemptMode = "dash"`
4. 事件链路达到 `loadedmetadata -> play -> progress`
5. 分辨率恢复到对应样本的高清分档，例如 `1920 x 1080`

同时完成了：

1. `npm run lint`
2. `npm run test`
3. `npm run typecheck`
4. `npm run build`

## 追加：真机联调补记

在后续 LG C1 真机联调里，又补上了两条之前没有完全看清的事实：

### 1. telemetry 一度“失效”并不是前端上报逻辑坏了

真机曾出现过只看到旧 telemetry 或完全收不到播放器事件的现象。最终确认根因是：

1. 启动真机 debug 时，之前的 app 进程没有真正关闭
2. 后续虽然重新 launch 了新参数，但电视端运行时并没有冷启动
3. `debugTelemetryUrl` 等 launch params 没有真正进入当前会话

对应修复是：

1. `scripts/webos-debug-player.mjs` 默认在 launch 前先关闭正在运行的 app
2. 只保留 `--keep-running-app` 作为显式例外

这条经验很重要，因为它说明：

- 真机 telemetry “失效”时，先查冷启动和 launch params 是否真的生效
- 不要第一时间怀疑前端 telemetry 代码本身

### 2. 这条视频在真机登录态下，`1080 compatible` 和 `720 compatible` 不是同一种链接形态

针对测试视频 `BV1Sf4y1q7H9` 的真机 telemetry，最终看到了更细的兼容流事实：

1. `compatible 1080P` 对这台真机当前登录态返回的是 `platform=pc + f=u_0_0`
2. `compatible 720P` 返回的是 `platform=html5 + f=T_0_0`
3. 旧播放器逻辑只保留“最高兼容档位”这一条 attempt
4. 于是它会一直卡在 `1080 compatible (pc)` 上尝试，最后超时
5. 真正更容易起播的 `720 compatible (html5)` 根本没有机会执行

这解释了为什么：

1. 同一条视频历史上可能出现过 `1080 compatible` 能播
2. 但这次真机登录态下又完全播不出来

问题不再是简单的“接口有没有给 1080”，而是：

- **同一视频、同一设备，在不同上下文下，兼容流的“档位”与“可播形态”并不总是绑定在一起**

### 3. 最终真机修复不是“强保 1080 compatible”，而是“允许稳定 compatible attempt 先被尝试”

在看清上面这条事实后，播放器策略继续收敛为：

1. `compatible` 不再只保留一条最高档位 attempt
2. 而是把多个兼容档位都保留下来
3. 真机 webOS 上，对 `platform=html5 / f=T_0_0` 这类更稳定的 compatible 链接给予更高优先级
4. 对 `platform=pc / f=u_0_0` 的 compatible 链接降权，并减少单个 attempt 的候选数量

这样做之后，真机上这条视频的执行链路变成了：

1. 先尝试 `DASH`
2. `DASH` 失败后
3. 转到 `720P compatible (html5)`
4. 收到 `loadedmetadata + play`

结果是：

1. 这条视频从“真机完全起不来”恢复为“真机稳定起播”
2. 代价是当前回退到 `720P compatible`
3. 但它比卡死在 `1080 compatible (pc)` 要更符合真实用户可用性

### 4. 另一条公开视频也验证了同一策略

补测 `BV1wqoGYxEox` 时，真机上也出现了相同模式：

1. `DASH 1080P` 先尝试
2. 失败后回退到 `720P compatible (html5)`
3. 收到 `loadedmetadata + play`

这说明本次改动不是只对单个视频硬编码，而是对“真机上 compatible 高档位不可播、低一档 html5 可播”的一类问题都有帮助。

## 经验沉淀

以后处理播放器画质相关问题时，优先遵守下面几条：

1. 不要再用一个字段同时承载“接口返回画质”“兼容流回退画质”“当前执行画质”
2. 只要 `DASH` 和 `兼容流` 同时存在，就必须把两层语义拆开记录
3. 当用户反馈“明明请求 1080P，却总像 720P”时，先检查是否是内部语义污染，而不是先去猜会员权限
4. Simulator 和电视可以有底层媒介接入差异，但高层播放优先级不能分叉成两套
5. 历史成功记忆只能做启发式微调，不能压过“接口这次已经明确返回了更高档位”这个事实
6. 任何播放器诊断面板都必须直接反映真实决策链，不能再依赖模糊聚合字段
7. 真机 debug 脚本必须确保 app 真正冷启动，否则 launch params 和 telemetry 结论都不可信
8. 在真机上看 compatible 能否播放时，不能只看“档位更高”，还要同时看 URL 形态是不是 `html5` 还是 `pc`

## 后续约束

后续继续改播放器时，至少坚持两条：

1. 只要新增播放质量字段，就先问清它描述的是“请求”“返回”“回退”还是“执行”
2. 只要改播放排序，就必须同时验证：
   - DASH 已满足请求档位时，是否仍然首选 DASH
   - 历史记忆是否会错误压过本次接口真实返回

---
name: lg-webos-real-tv-debug
description: Use this skill when debugging the bilibili_webos app on a real LG webOS TV, especially for black screen playback, stale installs, Shaka errors, telemetry collection, Developer Mode disconnects, or TV sleep/session issues. It is specific to this repo and complements lg-webos-deploy.
---

# LG webOS 真机调试技能

## 适用范围

只在以下场景使用：

- 真机安装后看起来还是旧包
- 电视端黑屏、只有 UI 没有视频
- 播放器出现 `Shaka Error 1002`、`Failed to fetch`、一直切换候选地址
- 需要确认当前电视实际运行的是哪一个前端产物
- 需要抓取播放器 telemetry
- Developer Mode 会话过期、电视待机后 SSH/安装连接断开

不用于：

- Simulator 调试
- 普通前端功能开发
- Android TV 或其他平台

## 先决边界

### 1. 真机与 Simulator 必须分开判断

- `Simulator` 允许使用本机媒体代理补请求头做验证
- `真机` 默认必须保持自包含运行
- **不要**把电脑上的媒体代理混进真机正式方案

### 2. 优先使用仓库脚本

部署与连接优先使用：

```bash
npm run webos:doctor
npm run build:webos
npm run webos:package
npm run webos:install -- --device <deviceName>
npm run webos:launch -- --device <deviceName>
npm run webos:list -- --device <deviceName>
npm run webos:remove -- --device <deviceName>
```

设备名默认从：

- `_dev/dev-menu.config.bat`

读取；当前仓库通常是：

- `lgtv`

## 真机调试标准流程

### 1. 先确认连接与会话

按下面顺序检查：

```bash
npm run webos:list -- --device lgtv
```

如果超时，再看：

- `%APPDATA%\.webos\tv\novacom-devices.json` 中 `lgtv` 的 `host/port/passphrase`
- `Test-NetConnection <tv-ip> -Port 9922`

如果 Developer Mode 会话失效：

- 在电视上重新打开 `Developer Mode` App
- 确认电视联网
- 点击 `EXTEND`
- 如需要重新取 key，再执行：

```bash
ares-novacom --device lgtv --getkey
```

### 2. 重新部署后，不要立刻判定结果

真机安装存在落盘延迟。正确顺序是：

1. `npm run webos:install -- --device lgtv`
2. 等 `8` 秒左右
3. `npm run webos:launch -- --device lgtv`

### 3. 必须核对电视上实际运行的前端入口

不要只看 CLI 输出“Success”，而要直接在电视文件系统确认：

```bash
npx -y -p node@16 node %APPDATA%\npm\node_modules\@webos-tools\cli\bin\ares-novacom.js --device lgtv --run "cat /media/developer/apps/usr/palm/applications/com.liuyang.app.bilibiliwebos/index.html | grep index-legacy"
```

如果电视上的 `index-legacy-*.js` 和本地刚打出的包不一致，说明还不是新包。

## Telemetry 工作流

### 1. 只在需要远程判因时注入 telemetry

构建前设置：

```bash
$env:VITE_DEBUG_TELEMETRY_URL='http://<your-pc-ip>:19080/telemetry'
```

然后：

```bash
npm run webos:package
npm run webos:install -- --device lgtv
npm run webos:launch -- --device lgtv
```

本仓库已有服务：

- `scripts/player-telemetry-server.mjs`
- `npm run webos:debug:player -- --url <bilibili-url>`
- `npm run webos:debug:player:macos -- --url <bilibili-url>`
- `npm run webos:debug:player:windows -- --url <bilibili-url>`

其中 `webos:debug:player` 会自动：

- 解析 `BVID / cid / title / part`
- 为电视生成 `player` 启动参数
- 自动给真机注入 `debugTelemetryUrl`
- 在本机临时起 telemetry server，并输出本轮总结到 `_dev/real-tv-debug/*.summary.json`

平台约定：

- 默认优先用 `npm run webos:debug:player`
- 在 `macOS` 上如果你想显式使用独立入口，可用 `npm run webos:debug:player:macos`
- 在 `Windows` 上如果你想显式使用独立入口，可用 `npm run webos:debug:player:windows`
- 三者的业务逻辑保持一致，区别只是为后续平台排障保留独立入口名，避免再次把某一端脚本覆盖掉

### 2. 如何读事件

- 只有 `environment + attempt-switch`，没有 `loadedmetadata/play/progress`
  说明媒体执行层根本没起播
- `loadedmetadata` 有了但没 `play`
  说明元信息拿到了，自动播放或后续执行层失败
- `Shaka Error 1002`
  重点看 error message 里失败的真实 URL
- `媒体加载超时`
  说明既没拿到元信息，也没抛出可读的底层错误
- `attempt-failure`
  说明当前候选已经失败，重点看：
  - `failureStage`
  - `resolvedVideoHost / resolvedAudioHost`
  - `runtime.readyState / runtime.networkState`

## 真机播放问题快速分类

### 1. 兼容 MP4 黑屏

如果 telemetry 显示：

- `sourceTypeLabel = HTML5 Video`
- 多个 `candidate` 都在切换
- 最后是 `媒体加载超时`

优先怀疑：

- bilivideo 防盗链请求头不满足
- 真机直连媒体地址被 CDN 拒绝

这种情况可以临时用代理验证根因，但**不要**把电脑代理当最终方案。

如果当前仓库已经启用了 relay `/media`，则应优先看：

- `resolvedVideoHost` 是否已经变成 relay 地址
- relay 本机是否能对同一条媒体 URL 返回 `206 Partial Content`

### 2. DASH 黑屏且出现 `Shaka Error 1002`

优先看错误 URL：

- 如果落到 `mcdn.bilivideo.cn:8082`
  重点排查音频轨或分片地址选择
- 如果是某条 `audio` 轨失败
  优先尝试更保守的 `AAC` 音频轨
- 如果同一视频轨不断切候选
  优先检查候选 host 排序与回退逻辑

如果错误里已经明确出现 `403`，不要再把它简单解释成“电视不支持 HEVC”。
先判断：

1. `playurl` 是不是已经来自 relay
2. 媒体分片是不是仍然由电视直连 bilivideo
3. 是否需要把高码率媒体请求也接到 relay `/media`

### 3. 收藏夹点开后报错

先检查收藏入口传的 `cid` 是否可信。

当前仓库约定：

- 收藏视频进入播放器前，应先用 `bvid` 补拉详情并确认真实 `cid`

## 当前仓库已验证的经验

### 1. 真机设备识别不可靠

- `readDeviceInfo()` 可能返回 `null`
- 不能只依赖 `modelName`
- 同时要结合 `navigator.userAgent`

### 2. webOS 启动环境容易误判

`public/webOSTV.js` 不能把真机错误伪装成 `browser-dev`，否则会把真机错带到 Simulator 分支。

### 3. 旧包残留经常是假象

安装成功不代表电视已经实际跑到新代码。

必须同时确认：

- `npm run webos:list -- --device lgtv`
- 真机文件系统里的 `index-legacy-*.js`
- 运行时 telemetry 是否来自当前版本

### 4. `playurl relay` 不等于“高清一定能播”

当前仓库已经验证过一类非常关键的真机问题：

1. relay 账号同步正常
2. `playurl` 已经返回 `1080P / HEVC`
3. 但电视直连这些高码率媒体 URL 仍然会遇到 `403` 或超时

所以以后再看到：

- `latestEnvironment` 里已经是 `1080P + HEVC`
- 但 `attempt-failure` 仍然持续出现

不要只盯着 `playurl` 这一层，而要继续核对媒体请求是否已经走 relay `/media`。

## 电视待机 / 断连处理

### 1. Developer Mode 会话

LG 官方文档说明：

- Developer Mode 只有有限时长
- 电视联网时，可以在 `Developer Mode` App 内点击 `EXTEND`
- 如果剩余时间耗尽，Developer Mode 会失效，开发应用会被卸载

因此每次长时间真机调试前都应先：

1. 打开 `Developer Mode` App
2. 查看 `Remain Session`
3. 点击 `EXTEND`

### 2. 电视自动省电

不同 webOS 版本菜单路径略有差异，但优先排查这几项：

- `All Settings -> General -> System -> Time & Timer -> Timers -> 4 Hours Auto Power Off`
- `All Settings -> Support -> OLED Care -> Device Self Care -> Energy Saving Steps`
- 某些机型在 `Picture -> Energy Saving`

调试时建议：

- 关闭 `4 Hours Auto Power Off`
- 把 `Energy Saving` 调到 `Off`
- 保持电视和电脑在同一网络，不要断网待机

### 3. 现实建议

如果电视已经待机并导致 `9922` 断连：

1. 先唤醒电视
2. 重新打开 `Developer Mode` App
3. 检查 `EXTEND`
4. 再执行一次：

```bash
npm run webos:list -- --device lgtv
```

只有连通后再继续安装/启动，不要直接盲目重试部署。

## 输出要求

每次真机调试结束时，至少明确给出：

- 当前目标设备
- 当前电视实际运行的入口 JS
- 是否抓到了 telemetry
- 问题属于哪一层：
  - 安装覆盖
  - Developer Mode 会话
  - 兼容 MP4
  - DASH 视频轨
  - DASH 音频轨
  - 候选地址排序
- 下一步最小验证动作

# webOS 真机 1080P 播放诊断与 Mac Relay 接力方案

日期：2026-08-02

目标设备：LG C1 / webOS 6

TV 设备名：`lgtv`（诊断时 IP：`192.168.50.175`）

## 1. 结论

电视硬件和播放器具备 1080P 播放能力，B 站接口也确实返回了 1080P 视频流。

当前实际表现是：

1. 模拟器通过本机媒体代理，可以稳定播放 1080P AVC。
2. 真机直接访问 B 站高清 DASH 地址时，多个 CDN 候选连续超时。
3. 真机随后回退到 720P HTML5 兼容流；用户已现场确认这条 720P 链路实际能够播放。
4. 真机本轮没有使用 relay：`playurlSource=direct`，原因是 `relay not configured`。
5. B 站返回的候选中出现了新的 CDN：`*.edge.mountaintoys.cn:4483`。当前 relay 媒体白名单只接受 `*.bilivideo.com` 和 `*.bilivideo.cn`，直接代理该候选会被拒绝。

因此要在电视上稳定播放 1080P，正确链路是：

```text
LG TV -> Mac relay /api/playurl -> B 站播放地址
LG TV -> Mac relay /media -> B 站 1080P 视频/音频分片
```

不能只让 relay 获取播放地址后仍由电视直连高清 CDN；已有历史验证表明，这样仍可能出现 `403` 或超时。

## 2. 本次实测证据

### 2.1 模拟器

执行：

```powershell
npm run verify:simulator-playback
```

结果：成功。

- 视频：`BV1Nr3s6rE79`
- 清晰度：1080P
- 编码：AVC
- 播放方式：DASH / Shaka Player
- `videoWidth=1706`、`videoHeight=960`（该视频 1080P 档实际返回的画面尺寸）
- 收到 `progress`，`currentTime=2`
- `decodedVideoFrames=65`
- 视频和音频请求均被改写到 `127.0.0.1:19033/media`

这证明应用的 1080P 解析、DASH 清单生成、Shaka 播放和模拟器解码链路成立。

### 2.2 真机

真机先更新到与本地一致的入口：

- 应用：`com.liuyang.app.bilibiliwebos`
- 本地入口：`index-legacy-DbWcQyeL.js`
- 电视入口：`index-legacy-DbWcQyeL.js`

随后对同一视频执行真机 telemetry：

```powershell
npm run webos:debug:player -- --device lgtv --bvid BV1Nr3s6rE79 --wait-ms 45000
```

摘要文件（本机调试产物，不提交敏感原始 URL）：

```text
_dev/real-tv-debug/2026-08-02_08-36-38-599-BV1Nr3s6rE79.summary.json
```

结果：

- 接口返回 1080P DASH，视频流 8 条、音频流 3 条。
- 1080P AVC/HEVC 候选发生 6 次 `load-timeout`。
- 候选包含：
  - `*.bilivideo.com`
  - `*.mcdn.bilivideo.cn:8082`
  - `*.edge.mountaintoys.cn:4483`
- 最后回退到 `720P / HTML5 Video / platform=html5 / f=T_0_0`。
- telemetry 收到 `loadedmetadata` 和 `play`；用户现场确认电视画面正在播放。
- 没收到 `progress` 是采集窗口在回退刚起播后结束，不代表 720P 没播放。

最关键的环境字段：

```text
playurlSource = direct
playurlFallbackReason = relay not configured
relayStatus.configured = false
```

所以这次真机测试验证的是“电视直连”，尚未验证 Mac relay 的 1080P 完整链路。

## 3. 为什么模拟器可以，电视却回退到 720P

模拟器不是直接访问 B 站媒体地址。仓库脚本会启动 `simulator-media-proxy.mjs`，代理补充：

- `Referer: https://www.bilibili.com/`
- `Origin: https://www.bilibili.com`
- 桌面浏览器 `User-Agent`
- `Range` 分段请求

真机没有配置 relay 时，会直接访问 B 站 CDN。webOS 的媒体元素和 Shaka 无法像受控服务端那样稳定附加这些请求信息，所以高码率 DASH 更容易超时或被拒绝。

这不是电视不支持 1080P，也不是前端只请求了 720P，而是 1080P 媒体文件的网络请求上下文不完整。

## 4. Mac 上需要完成的修复

### 4.1 更新仓库并建立基线

在运行 Docker relay 的 Mac 上：

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
cd relay
go test ./...
cd ..
```

确认工作区干净后再修改。

### 4.2 扩展媒体 CDN 白名单

修改：

```text
relay/media_proxy.go
```

当前 `isAllowedMediaHost()` 仅允许：

- `*.bilivideo.com`
- `*.bilivideo.cn`
- 本机测试地址

需要额外允许本次接口真实返回的：

```text
*.edge.mountaintoys.cn
```

安全要求：

1. 只允许精确后缀 `.edge.mountaintoys.cn`，不要放开整个 `.cn`、任意 URL 或任意主机。
2. 仍只允许 `http/https`。
3. 每次重定向后也重新校验目标主机，避免白名单地址重定向到任意第三方地址。
4. 不把带签名的完整媒体 URL、Cookie 或 token 写入日志。

建议增加表格测试覆盖：

```text
允许：upos-sz-xxx.bilivideo.com
允许：xxx.mcdn.bilivideo.cn
允许：b-xxx.edge.mountaintoys.cn
拒绝：edge.mountaintoys.cn.evil.example
拒绝：mountaintoys.cn
拒绝：example.com
```

### 4.3 检查 relay token 与媒体 URL

当前 `/media` 支持 token 校验，但视频元素不能自行添加 `X-Relay-Token` 请求头。

如果 Mac 的 `RELAY_ACCESS_TOKEN` 非空，需要确认前端生成的 `/media` URL 带有：

```text
token=<与 relay 相同的 token>
```

相关位置：

- `src/features/player/playerMediaProxy.ts`
- `src/services/relay/settings.ts`
- `relay/server.go` 的 `isAuthorized()`

推荐规则：

1. `buildMediaProxyUrl()` 在选用 relay 时，把已保存的 `accessToken` 写入查询参数。
2. 模拟器本机代理不加 token。
3. 单测覆盖“relay 有 token”和“relay 无 token”两种情况。
4. telemetry 和日志不得输出完整 token。

如果当前家庭局域网部署明确没有设置 `RELAY_ACCESS_TOKEN`，这项不会阻塞本次验证，但仍建议补齐，避免以后开启 token 后 1080P 突然全部变成 401。

### 4.4 保持媒体改写条件不变

前端现有逻辑只有在以下条件同时成立时才将媒体 URL 改写到 relay：

```text
playurlSource = relay
relayStatus.authState = synced
```

不要改成无条件代理。这样 relay 故障时仍能回退到现有可用的 720P 直连链路。

## 5. Mac Docker 更新流程

修改和测试通过后，在仓库根目录执行：

```bash
docker compose --env-file relay/.env.local -f relay/compose.yaml down
docker compose --env-file relay/.env.local -f relay/compose.yaml up -d --build
docker compose --env-file relay/.env.local -f relay/compose.yaml ps
docker compose --env-file relay/.env.local -f relay/compose.yaml logs --tail=100
```

注意：

- `relay/.env.local` 不提交 Git。
- `bilibili-relay-data` volume 保存登录会话；不要随意删除 volume。
- 日志中不应出现 Cookie、完整播放 URL 或 token。

基础验活：

```bash
curl http://127.0.0.1:19091/health
```

如果配置了 token：

```bash
curl -H 'X-Relay-Token: <token>' http://127.0.0.1:19091/api/auth/status
```

预期：

```text
health.ok = true
auth.status.loggedIn = true
auth.status.mid = TV 当前账号 mid
```

如果 `loggedIn=false`、账号不一致或 TV 没有旧的同步材料，需要在 TV 上重新扫码登录一次。

## 6. TV 配置与验证

### 6.1 配置

在 TV App 的 relay 设置中填写：

- 服务器 IP：Mac 的局域网 IP
- 端口：默认 `19091`
- Token：与 Mac 的 `RELAY_ACCESS_TOKEN` 一致；未设置则留空

确认设置页显示：

- relay 在线
- relay 已登录
- relay 账号与 TV 当前账号一致

### 6.2 首次最小验证

先在 Mac 上确认 `/media` 能处理 B 站 Range 请求并返回 `206 Partial Content`。测试 URL应从当次 `/api/playurl` 响应临时提取，不要写入文档或日志。

然后在 TV 上播放同一测试视频：

```text
BV1Nr3s6rE79
```

从开发机采集：

```powershell
npm run webos:debug:player -- --device lgtv --bvid BV1Nr3s6rE79 --wait-ms 60000
```

### 6.3 1080P 验收标准

必须同时满足：

```text
quality = 1080P 高清
playurlSource = relay
relayStatus.authState = synced
resolvedVideoHost = <Mac-IP>:19091
resolvedAudioHost = <Mac-IP>:19091
videoWidth >= 1700（样本实际尺寸）
decodedVideoFrames > 0
收到 progress，currentTime > 0
没有持续 attempt-failure
```

不能只凭播放器界面显示“1080P”判定成功。必须确认实际解码帧和播放进度都在增加。

## 7. 如果仍失败，按层判断

### A. `playurlSource=direct`

说明 TV 仍未使用 relay。检查：

- relay host 是否保存
- `/health` 是否可达
- relay 账号是否同步
- TV 与 relay 的账号 `mid` 是否一致

### B. `playurlSource=relay`，但 `resolvedVideoHost` 仍是 B 站 CDN

说明只代理了播放地址，没有代理媒体。检查 `preferRelayProxy` 条件和 `playerMediaProxy.ts` 的 URL 改写。

### C. `/media` 返回 400

优先检查目标 CDN 是否不在白名单，特别是：

```text
*.edge.mountaintoys.cn
```

### D. `/media` 返回 401

检查 `RELAY_ACCESS_TOKEN` 与媒体 URL 的 `token` 查询参数是否一致。

### E. `/media` 返回 502 或超时

在 Mac 上直接对同一目标做小范围 Range 请求，区分：

- Mac 到 B 站 CDN 的网络问题
- 上游 403
- DNS/IPv6 路由问题
- 请求超时过短

只有确认是慢响应后才调整 `RELAY_REQUEST_TIMEOUT_MS`，不要用加长超时掩盖 403 或白名单错误。

### F. `/media` 返回 206，但 TV 没有画面

再检查：

- DASH 音频轨是否也经过 relay
- `Content-Range`、`Content-Length`、`Accept-Ranges` 是否完整转发
- Shaka 错误码
- 真机当前选择的 AVC/HEVC 编码

## 8. 参考项目更新结论

本次已更新并检查：

- `PiliPlus`
- `JKVideo`
- LG `MediaPlayback`

没有发现近期可直接复制的“B 站协议变更修复”。

- PiliPlus TV 路线仍使用签名后的 `/x/tv/playurl`，属于原生客户端能力，不能直接移植到纯 webOS Web App。
- JKVideo Web 路线仍依赖本地代理，并没有解决电视媒体请求头问题的新实现。
- LG MediaPlayback 示例只负责 Shaka 播放，不处理 B 站鉴权和防盗链。

因此当前项目已有的 `playurl relay + media relay` 仍是最小且可验证的正确方案。

## 9. 修复完成后的提交建议

Mac 上完成代码修复与真机验证后，提交应至少包含：

- `relay/media_proxy.go`：新增受限 CDN 白名单与重定向复检
- `relay/*_test.go`：白名单、重定向和 Range 测试
- 如启用了 token：`playerMediaProxy.ts` 及对应测试
- 新的真机验证摘要（清除敏感完整 URL 后再决定是否提交）

提交前至少运行：

```bash
cd relay && go test ./... && cd ..
npm run lint
npm run test
npm run typecheck
npm run build
```

最终结论应以真机 telemetry 中的 `1080P + relay host + decoded frames + progress` 为准。

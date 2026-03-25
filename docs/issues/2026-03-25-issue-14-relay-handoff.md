# Issue #14 接力说明：另一台电脑上的 Relay 如何继续操作

GitHub Issue: `#14`

当前分支：`codex/fix/14-issue-14`

## 当前代码状态

这一轮已经把历史同步链路补成了“两条路并行可用”的结构：

- `Relay` 作为主路径：
  - 播放器历史 heartbeat 优先走 relay
  - 播放器历史 progress/report 优先走 relay
- 本地直写作为兜底：
  - 如果 relay 没配置、不可达、会话失效，前端会自动回退到直连 B 站写接口
- 为了兼容 `file://` 的 webOS / Simulator 环境：
  - 扫码登录成功后，会把 `loginUrl` 里的 `bili_jct` 提取并持久化
  - 这样即使没连上 relay，只要本地保存过这份登录材料，也能继续写历史

## 这一轮主要改动

前端：

- `src/services/api/bilibili.ts`
  - 新增 `readBiliCsrfToken`
  - 新增 `reportVideoHeartbeat`
  - 新增 `reportVideoHistoryProgress`
  - `csrf` 读取顺序变成：`document.cookie -> 已保存的 relay 登录材料`
- `src/services/relay/settings.ts`
  - `RelayAuthMaterial` 增加 `csrfToken`
  - 从扫码完成 `loginUrl` 里提取 `bili_jct`
- `src/services/relay/client.ts`
  - 新增 `reportRelayHeartbeat`
  - 新增 `reportRelayHistoryProgress`
- `src/features/player/PlayerPage.tsx`
  - 接入播放器 heartbeat / flush / completed 的历史同步
  - 记录 runtime diagnostics，便于 Simulator 里直接排查
- `src/features/player/playerHistorySync.ts`
  - 统一封装“relay 优先，本地兜底”的调用策略

Relay：

- `relay/server.go`
  - 新增：
    - `POST /api/history/heartbeat`
    - `POST /api/history/report`
- `relay/bilibili.go`
  - 新增：
    - `ReportVideoHeartbeat`
    - `ReportHistoryProgress`
  - 共用 cookie / referer / origin / user-agent 头
  - 从 relay 已保存 cookies 里读取 `bili_jct`
- `relay/main_test.go`
  - 新增 relay 历史接口测试

## 当前已完成验证

本机已跑通：

- `cd relay && go test ./...`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm run build:webos`

已确认：

- 前端单测通过，包含：
  - cookie 读不到 csrf 时，从已保存登录材料回退
  - relay 优先、失败回退本地直写
- webOS 构建产物已更新到 `build/webos`
- 当前机器上的 relay Docker 已重启并验活：
  - `/health` 返回 `ok: true`
  - `/api/auth/status` 返回已登录账号状态
  - `/api/history/heartbeat`、`/api/history/report` 已确认存在，新接口返回 `bad_request` 而不是 `404`

当前还没在本机完成的部分：

- webOS 真机安装联调
  - 原因：默认设备 `lgtv` 当前连接超时，`ares-install` 无法连上电视

## 如果 relay 就跑在当前开发机

当前机器已经按下面步骤完成重启；以后如果需要再次重启，直接在仓库根目录执行即可。

### 路径 A：当前机器有完整仓库

推荐直接这样做。

1. 进入仓库目录。
2. 拉取最新分支：

```bash
git fetch origin
git checkout codex/fix/14-issue-14
git pull --ff-only origin codex/fix/14-issue-14
```

3. 如果那台电脑装了 Go，先跑：

```bash
cd relay
go test ./...
cd ..
```

4. 按你那台机器的 relay 启动方式重启服务。

### 路径 B：当前机器只跑 relay，没有完整前端环境

至少把这些文件同步过去：

- `relay/server.go`
- `relay/bilibili.go`
- `relay/main_test.go`
- `relay/go.mod` 不需要改，这次没动

更推荐还是直接更新整个仓库分支，避免后面版本不一致。

## 如何重启 relay

### 方案 1：Docker Compose

仓库里已经有 `relay/compose.yaml`，优先用这个。

在仓库根目录执行：

```bash
docker compose --env-file relay/.env.local -f relay/compose.yaml down
docker compose --env-file relay/.env.local -f relay/compose.yaml up -d --build
docker compose --env-file relay/.env.local -f relay/compose.yaml ps
docker compose --env-file relay/.env.local -f relay/compose.yaml logs -f
```

预期：

- 容器名是 `bilibili-relay`
- 端口默认是 `19091`
- 日志里不应该出现编译失败或启动失败

### 方案 2：直接本地跑 Go 程序

如果你不是用 Docker，而是在那台电脑直接跑 relay：

```bash
cd relay
go test ./...
go build -o playurl-relay .
```

然后停止旧进程，再用你原来的方式重新启动新的 `playurl-relay`。

如果你是手工设置环境变量，至少确认这些值还在：

- `RELAY_HOST`
- `RELAY_PORT`
- `RELAY_ACCESS_TOKEN`
- `RELAY_STATE_DIR`
- `RELAY_REQUEST_TIMEOUT_MS`

## 重启后怎么确认 relay 是新的

在 relay 那台电脑或同局域网机器上访问：

```bash
curl http://<relay-ip>:19091/health
```

预期至少返回：

```json
{"ok":true,...}
```

如果配置了 token，再补查：

```bash
curl -H "X-Relay-Token: <token>" http://<relay-ip>:19091/api/auth/status
```

如果之前 relay 已经同步过登录态，这里应该能看到：

- `loggedIn: true`
- `mid`
- `lastSyncedAt`

## TV / Simulator 这边接下来怎么接

等 relay 重启好后，在当前这台开发机继续：

1. 打开 App 设置里的 relay 配置。
2. 把 host 改成那台 relay 机器的局域网 IP。
3. 端口填 `19091`，如果你改过就填实际端口。
4. 如果 relay 配了 token，把 token 一起填上。
5. 回播放器随便播一条普通视频至少 `10s`。
6. 返回历史页，确认是否出现这条记录。

如果想确认到底走的是 relay 还是本地兜底，可以继续看本地 diagnostics：

- `heartbeat-sent`
- `progress-flush`
- `progress-completed`

这些事件现在会额外带上：

- `path`
- `relayAttempted`
- `relayFallbackReason`

## 两个很关键的现实限制

### 1. 如果当前登录材料里没有 `bili_jct`

即使这次代码已经支持“无 relay 也写历史”，也可能还是需要重新扫码一次。

原因不是代码没生效，而是旧会话里根本没有保存过可复用的 csrf 材料。

### 2. relay 主路径是否可用，取决于那台电脑是否真的完成重启

前端现在已经支持 relay 历史接口，但只有远端 relay 用上这次的新代码后：

- `/api/history/heartbeat`
- `/api/history/report`

这两条路径才会真正存在。

## 建议的接力顺序

最稳的顺序是：

1. 在另一台电脑更新并重启 relay。
2. 确认 `/health` 正常。
3. 回到当前开发机，把 App 的 relay host 指到那台电脑。
4. 先测“relay 主路径”。
5. 再临时关闭 relay 或清空 host，测“本地兜底路径”。
6. 如果本地兜底仍提示缺 csrf，再重新扫码一次补登录材料。

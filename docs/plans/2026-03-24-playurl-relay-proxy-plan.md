# 最小 playurl relay 方案设计（TV 优先走 relay，失败回退直连，账号强同步）

## 1. 目标

本方案的目标只有一个：

- 让 `LG webOS TV App` 在保持当前可用 `720P` 直连 fallback 的前提下，优先通过一台本地小服务器获取更可控的 `playurl` 响应，争取稳定拿到更高质量播放地址。

这里的“更可控”重点不是改播放器 UI，而是把下面这些东西从 `webOS Web App` 挪到一个我们能完全掌控的服务里：

1. `Cookie`
2. `User-Agent`
3. `Referer`
4. `Origin`
5. `playurl` 请求参数组合

同时新增一个强约束：

- **App 里登录的是哪个 B 站账号，relay 就必须使用同一个账号状态。**

不接受下面这种状态：

1. TV 上登录账号 A
2. relay 实际在用账号 B
3. 最后播放权限、会员等级、可用清晰度全部对不上

## 2. 范围

### 本期要做

1. 在 `Mac mini + Docker` 上跑一个最小 relay 服务
2. relay 只代理 `playurl`
3. App 内新增 relay 设置页，可填写服务器 `IP / 端口`
4. TV 端先探测 relay 是否可用
5. App 登录态与 relay 账号状态做强同步
6. relay 可用时，优先通过 relay 拿播放地址
7. relay 不可用、超时、返回异常时，自动退回当前直连逻辑
8. 确保现有 `720P` 可播能力不被破坏

### 本期不做

1. 不代理视频媒体文件本身
2. 不代理整套 B 站 API
3. 不代理视频上传、评论、点赞等非播放核心能力
4. 不在本期直接做 `HEVC / AV1` 默认编码持久化

## 3. 为什么这样拆

这样拆的好处很明确：

1. 改动小
2. 验证快
3. 失败成本低
4. 不会把当前能播的链路一起拖下水

真正需要受控的，其实只有“向 B 站拿播放地址”这一步。

一旦拿到地址：

- 电视仍然可以直连 CDN 播放
- 不需要把整段视频先绕过小服务器

这样不会把 `Mac mini` 变成视频中转机，也不会造成大带宽压力。

## 4. 参考项目启发

### `JKVideo`

`JKVideo` 的 Web 侧已经证明了一件事：

- 浏览器/Web 前端环境并不适合自己硬控 `Cookie / Referer / Origin`
- 所以它直接通过本地 relay 去拿 B 站 API

我们这次的方案，本质上就是把这个思路从“本机 localhost”换成：

- `局域网内一台固定可访问的小机器`

## 5. 目标架构

```text
LG TV App
  -> 设置页填写 relay IP/端口
  -> 登录 / 刷新登录 / 退出登录
       -> POST http://<relay-host>:<port>/api/auth/sync
       -> relay 保存与 TV 当前账号一致的登录态
  -> GET http://<relay-host>:<port>/api/auth/status
  -> GET http://<relay-host>:<port>/health
  -> GET http://<relay-host>:<port>/api/playurl?...
       -> relay 带受控头和同步过来的账号 Cookie 请求 B 站 playurl
       -> relay 返回原始或近原始 JSON
  -> TV 继续用现有解析逻辑生成 PlaySource
  -> TV 直接请求 B 站 CDN 媒体地址播放

relay 不可用 / 超时 / 5xx / 数据异常
  -> TV 自动退回现有直连 B 站逻辑

relay 账号缺失 / 过期 / 与 TV 不一致
  -> TV 提示“代理服务器未同步当前登录账号”
  -> 本次播放自动退回直连
```

## 6. 服务端最小设计

### 6.1 技术选型

建议：

1. `Go`
2. 标准库 `net/http`
3. `Docker` 单容器部署

理由：

1. 这次 relay 只是最小 HTTP 服务，不需要额外运行时
2. 常驻在 `Mac mini + Docker` 上时，空载内存与镜像体积更友好
3. 单二进制部署更稳，重启与迁移成本低
4. 对 TV 端来说后端语言透明，不影响接口协议

### 6.2 API 设计

#### `GET /health`

用途：

- 给 TV 端做快速探活

返回：

```json
{ "ok": true }
```

#### `GET /api/auth/status`

用途：

- 让 TV 确认 relay 当前是否已同步账号
- 返回 relay 当前账号摘要，避免 TV 和 relay 出现“看起来连上了，实际账号不一致”

返回示例：

```json
{
  "ok": true,
  "loggedIn": true,
  "mid": 123456,
  "uname": "xxx",
  "vip": true,
  "cookieExpired": false,
  "lastSyncedAt": 1710000000000
}
```

#### `POST /api/auth/sync`

用途：

- TV 扫码登录成功后，把当前账号的认证数据同步到 relay
- relay 后续所有 `playurl` 请求都基于这份同步过来的账号状态执行

第一版建议同步内容：

1. Web 扫码登录成功后，`poll` 响应返回的登录完成 `url`
2. `refresh_token`
3. 登录完成时间戳
4. 账号摘要信息：`mid / uname / vip label`

实现约束：

1. 当前 webOS Web App 没有现成能力直接读取 `SESSDATA / bili_jct / DedeUserID` 这些 cookie 值
2. 因此第一期不要求 TV 把原始 cookie 明文同步给 relay
3. relay 收到登录完成 `url` 后，自行建立一次 Web 登录会话，并从响应 cookie jar 中提取后续 `playurl` 所需 cookie
4. relay 再把筛选后的 cookie 本地持久化，供后续 `/api/playurl` 使用

要求：

1. relay 只保留最后一次 TV 主动同步的账号状态
2. 同一时间只服务一个当前账号，不做多用户切换设计
3. TV 登出时必须调用同步清空或显式登出接口
4. 只要 TV 刷新登录态，也要重新同步一次
5. relay 本地要把账号摘要和 cookie 持久化到 Docker volume，避免容器重启后丢状态

#### `POST /api/auth/logout`

用途：

- TV 主动退出登录时，通知 relay 删除已同步的账号状态

#### `GET /api/playurl`

入参尽量贴近 B 站原接口：

1. `bvid`
2. `cid`
3. `qn`
4. `fnval`
5. `fnver`
6. `fourk`
7. `platform`
8. `high_quality`
9. `otype`

第一期建议先不发明自己的复杂协议，优先保持“透传 B 站 playurl 参数”的风格。

### 6.3 relay 对 B 站请求时要控制的东西

固定控制：

1. 同步过来的账号 Cookie
2. `User-Agent`
3. `Referer: https://www.bilibili.com`
4. `Origin: https://www.bilibili.com`
5. 超时
6. 重试策略

日志里禁止打印：

1. 完整 Cookie
2. 完整 token
3. 完整原始响应

最多只打印：

1. `bvid`
2. `cid`
3. `qn`
4. `fnval`
5. `quality`
6. `format`
7. 首个候选 host

### 6.4 账号与 Cookie 管理

这次不再采用“relay 自己单独配置 Cookie”的方案。

固定原则：

1. TV 登录哪个账号
2. relay 就使用哪个账号
3. TV 登出后，relay 也必须一起清空

也就是说，relay 的登录态来源只能是：

- **TV App 主动同步扫码登录结果**

而不能是：

- relay 自己私下维护另一份独立账号

这样才能保证：

1. 会员权限一致
2. 清晰度权限一致
3. 视频可见性判断一致
4. 用户不会搞不清“现在到底是谁的账号在起作用”

安全约束：

1. relay 本地持久化时，Cookie 至少做文件级隔离
2. 日志中绝不能打印完整 Cookie
3. `auth/sync` 必须校验访问 token
4. relay 只监听局域网，不开放公网
5. TV 端本地只保存“可用于 relay 建立会话的登录完成信息”，不在前端日志里打印完整 `url` 或 `refresh_token`

## 7. TV 端改造设计

### 7.1 设置页

建议新增一组配置：

1. `relayEnabled`
2. `relayBaseUrl`
3. `relayAccessToken`
4. `relayHealthTimeoutMs`
5. `relayRequestTimeoutMs`

设置页至少提供：

1. 服务器 `IP`
2. 端口
3. 连接测试按钮
4. 当前 relay 状态：`在线 / 离线`
5. 当前 relay 账号：`未登录 / 已登录 / 已过期`
6. relay 当前账号昵称与 `mid`
7. relay 当前账号会员状态
8. “重新同步当前登录账号”按钮

开发调试时，仍可保留：

1. `launch params`
2. 本地持久化

但用户真正可见、可操作的入口必须是设置页。

### 7.2 登录同步时机

TV 端需要在下面几个时机主动调用 `auth/sync`：

1. 扫码登录成功后
2. App 启动时发现本地已有有效登录态后
3. 登录态刷新后
4. 用户手动点击“重新同步当前登录账号”时

补充说明：

1. 第一优先级同步来源，是扫码登录成功时拿到的登录完成 `url`
2. 如果用户是在本功能上线前就已经登录，且本地没有这份同步材料，那么首次使用 relay 时需要重新扫码一次，建立 relay 会话

TV 端需要在下面几个时机主动调用 `auth/logout`：

1. 用户退出登录
2. App 发现本地登录态已失效并被清空

### 7.3 服务器重启后的保险同步

这里需要一个明确的“自愈机制”，避免下面这种常见情况：

1. TV App 之前已经登录
2. relay 服务器刚重启
3. relay 本地暂时没有当前账号状态
4. 用户一播放视频就发现又退回直连

推荐方案是：

- **以 App 主动补传为主，不做 relay 反向向 App 拉登录态。**

原因：

1. TV App 主动请求 relay 更稳定
2. relay 反向找 TV 很麻烦，TV 也不适合当服务端
3. 主动推送模型更容易做安全控制

具体规则：

1. App 本地始终保留当前登录态摘要，以及最近一次可用于 relay 建立会话的同步材料
2. 每次 App 启动后，如果本地是已登录状态，就自动执行：
   - `GET /health`
   - `GET /api/auth/status`
3. 如果发现 relay 属于下面任一种情况，就立刻自动补一次 `POST /api/auth/sync`：
   - 未登录
   - `mid` 不一致
   - 登录态已过期
   - `lastSyncedAt` 比 App 本地记录更旧
4. 如果 App 从后台恢复，且距离上次同步已超过一段阈值，也要再做一次轻量校验
5. 如果 relay 刚刚从离线恢复在线，也要自动再补一次同步

一句话说：

- `App 已登录 + 本地还持有最近一次登录完成材料 + relay 没状态 = App 自动补传`

这样即使服务器重启，只要本地仍保留最近一次同步材料，用户也不需要重新扫码一次。

### 7.4 播放前自愈校验

TV 端拿播放源时，顺序建议如下：

1. 如果 `relayEnabled=false`，直接走现有直连逻辑
2. 如果 `relayEnabled=true`，先做一次轻量探活
3. 探活成功后，再拉 `auth/status`
4. 只有当 relay 账号状态与 TV 当前账号一致时，`playurl` 才走 relay
5. 如果 relay 未登录、已过期、账号不一致，则立即触发一次同步
6. 同步成功后，后续 `playurl` 请求优先走 relay
7. relay 返回非 2xx、超时、格式不合法时，立即回退到直连逻辑
8. 回退时写明 telemetry：
   - `relay unavailable`
   - `relay auth missing`
   - `relay auth expired`
   - `relay auth mismatch`
   - `relay timeout`
   - `relay bad payload`
   - `relay request failed`

另外再加一层保险：

1. 每次真正请求 `playurl` 前，再做一次轻量账号状态校验
2. 如果 relay 返回：
   - `auth missing`
   - `auth expired`
   - `auth mismatch`
3. 则 TV 先自动补一次 `auth/sync`
4. 补传成功后，再重试一次 `playurl`
5. 只有补传后仍失败，才真正 fallback 到直连

这样即使出现“服务器刚重启，App 还没来得及预同步”的窗口，也能在真正播放时自愈一次。

如果 TV 当前已登录，但本地已经没有可复用的登录完成材料，则：

1. 本次播放直接 fallback 到直连
2. telemetry 明确记录 `relay sync material missing`
3. 设置页提示“需要重新扫码一次以建立 relay 会话”

### 7.5 fallback 原则

这里必须明确两个原则：

1. `fallback` 是正式设计的一部分
2. 只要 relay 账号状态不对，就宁可 fallback，也不能偷偷用错账号继续拿播放地址

所以用户体感应该是：

1. 有 relay 且账号同步成功时，更清晰
2. relay 不可用或账号未同步时，退回老方案，但不至于完全坏掉

### 7.6 TV 端数据结构建议

TV 端不一定需要新增一整套新模型。

建议第一期保持当前 `fetchPlaySource()` 主体不变，只做：

1. 把 `requestPlaySource()` 的底层来源抽象成：
   - `direct playurl requester`
   - `relay playurl requester`
2. 增加 relay 账号状态检查与同步逻辑
3. `fetchPlaySource()` 仍然组装当前 `PlaySource`

换句话说：

- 这次优先替换“拿原始 playurl 的人”
- 暂时不重写“消费 playurl 的人”

## 8. 错误处理与 telemetry

relay 接入后，需要新增几类 telemetry，方便以后判断是不是 relay 真起作用了。

建议记录：

1. 当前请求来源：`relay` 还是 `direct`
2. relay 健康探测结果
3. relay 账号状态检查结果
4. 是否触发了自动补传
5. 自动补传触发原因
6. TV 当前账号 `mid`
7. relay 当前账号 `mid`
8. relay 响应耗时
9. relay 返回的 `quality / format / host / platform hint`
10. fallback 是否发生
11. fallback 原因

这样以后用户说“怎么又回到 720P”时，我们可以很快分辨：

1. relay 压根没连上
2. relay 连上了，但账号没同步成功
3. relay 连上了，账号也一致，但 B 站还是没给更高质量
4. relay 给了更高质量，但媒体播放链路仍然没跑通

## 9. 安全与部署约束

### 9.1 部署约束

建议默认约束：

1. relay 只监听局域网地址
2. 不做公网映射
3. Docker 容器重启自动恢复
4. relay 认证数据只保存在本机

### 9.2 安全约束

建议至少做两件事：

1. TV 请求 relay 时带一个轻量 `access token`
2. relay 默认拒绝没有 token 的请求

原因不是防黑客，而是避免：

- 家里局域网内其他设备误用这个服务

## 10. 分阶段实施计划

### Phase 1：relay 骨架

目标：

1. 跑起 Docker 服务
2. `/health` 可用
3. `/api/auth/status` 可用
4. `/api/auth/sync` 可用
5. `/api/playurl` 能正确转发到 B 站
6. 本机 curl 可测通

验收：

1. 本机请求 relay，能通过登录完成 `url` 建立一份测试账号 Web 会话
2. 同步后 `auth/status` 能正确返回账号摘要
3. 本机请求 relay，能拿到和直接请求 B 站一致或更优的 `playurl` 数据
4. 响应中可看到 `quality / format / host`

### Phase 2：TV 接入 relay

目标：

1. TV 端新增 relay 配置
2. TV 端新增 relay 设置页
3. TV 登录、刷新登录、退出登录时同步 relay 账号状态
4. `requestPlaySource()` 支持走 relay
5. 失败时自动 fallback 到直连

验收：

1. relay 在线且账号同步成功时，TV telemetry 能明确显示 `playurlSource = relay`
2. TV 端能看到 relay 当前账号摘要
3. relay 断掉时，TV 仍能回退直连并维持当前可播能力
4. relay 账号失效或不一致时，TV 不会误用错误账号，而是回退直连并提示同步失败

### Phase 3：真机验证

目标：

1. 用固定测试视频在 LG C1 上实测
2. 对比 relay 前后 `quality / format / host / playable result`

验收：

1. 至少一个当前只能稳定 `720P` 的样本，在 relay 打开后稳定拿到更高质量
2. 如果仍失败，telemetry 能明确指出卡在：
   - `playurl`
   - `manifest`
   - `segment`
   - `decode`

## 11. 风险

### 风险 1：relay 也未必能直接解决所有视频

原因：

1. B 站不同视频策略不同
2. 有些视频可能仍受账号、版权、设备或媒体链路影响

应对：

- 把目标定义为“显著提高成功率”，不是“承诺所有视频都 4K”。

### 风险 2：同步 TV 登录态到 relay 涉及敏感 Cookie

应对：

1. 只允许局域网使用
2. 必须带 relay access token
3. relay 只做本地私有部署
4. 禁止日志泄露 Cookie

### 风险 3：拿到更高质量地址后，真机媒体链路仍可能失败

这时至少能帮助我们把问题继续收敛：

1. 如果 relay 后 `playurl` 明显变好了，问题就更集中在媒体播放链路
2. 如果 relay 后 `playurl` 也没变，问题就更集中在账号/参数/站点策略

## 12. 验收标准

本方案完成后，至少要满足：

1. relay 服务能在 `Mac mini Docker` 上稳定运行
2. TV 端支持 `relay 优先，直连 fallback`
3. TV 登录账号与 relay 账号保持一致
4. relay 不可用时，不影响当前 `720P` 直连播放
5. telemetry 能明确记录本次到底走的是 relay 还是 direct，以及账号是否同步成功
6. 至少在一批测试视频上，relay 方案能比当前纯前端方案更稳定拿到高清播放地址

## 13. 后续扩展

等 relay 基线跑通后，再做下面两项会更稳：

1. `HEVC / AV1` 优先策略
2. 用户手动切换编码后记住为默认编码

因为那时我们拿到的播放地址质量会更稳定，编码偏好才有真正发挥空间。

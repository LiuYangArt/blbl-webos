# 最小 playurl relay 方案设计（TV 优先走 relay，失败回退直连）

## 1. 目标

本方案的目标只有一个：

- 让 `LG webOS TV App` 在保持当前可用 `720P` 直连 fallback 的前提下，优先通过一台本地小服务器获取更可控的 `playurl` 响应，争取稳定拿到更高质量播放地址。

这里的“更可控”重点不是改播放器 UI，而是把下面这些东西从 `webOS Web App` 挪到一个我们能完全掌控的服务里：

1. `Cookie`
2. `User-Agent`
3. `Referer`
4. `Origin`
5. `playurl` 请求参数组合

## 2. 范围

### 本期要做

1. 在 `Mac mini + Docker` 上跑一个最小 relay 服务
2. relay 只代理 `playurl`
3. TV 端先探测 relay 是否可用
4. relay 可用时，优先通过 relay 拿播放地址
5. relay 不可用、超时、返回异常时，自动退回当前直连逻辑
6. 确保现有 `720P` 可播能力不被破坏

### 本期不做

1. 不代理视频媒体文件本身
2. 不代理整套 B 站 API
3. 不重做 TV 登录系统
4. 不在本期实现“TV 登录态和 relay 登录态自动同步”
5. 不在本期直接做 `HEVC / AV1` 默认编码持久化

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
  -> GET http://<relay-host>:<port>/health
  -> GET http://<relay-host>:<port>/api/playurl?... 
       -> relay 带受控头和 Cookie 请求 B 站 playurl
       -> relay 返回原始或近原始 JSON
  -> TV 继续用现有解析逻辑生成 PlaySource
  -> TV 直接请求 B 站 CDN 媒体地址播放

relay 不可用 / 超时 / 5xx / 数据异常
  -> TV 自动退回现有直连 B 站逻辑
```

## 6. 服务端最小设计

### 6.1 技术选型

建议：

1. `Node.js + TypeScript`
2. `Express` 或 `Fastify`
3. `Docker` 单容器部署

理由：

1. 和当前仓库技术栈接近
2. 好调试
3. 好部署
4. 后续真要扩展也不费劲

### 6.2 API 设计

#### `GET /health`

用途：

- 给 TV 端做快速探活

返回：

```json
{ "ok": true }
```

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

可选附加参数：

1. `codecPreference`
2. `deviceProfile=webos-tv`

但第一期建议先不发明自己的复杂协议，优先保持“透传 B 站 playurl 参数”的风格。

### 6.3 relay 对 B 站请求时要控制的东西

固定控制：

1. `Cookie`
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

### 6.4 Cookie 管理

第一期最小实现建议：

1. relay 启动时从环境变量读取 B 站 Cookie
2. Docker 用 `.env` 或 compose secret 注入
3. 只允许本地私有部署，不做公网暴露

例如：

- `BILI_COOKIE=SESSDATA=...; buvid3=...; ...`

后续二期再考虑：

1. 管理页录入 Cookie
2. 和 TV 登录态打通
3. Cookie 过期提醒

## 7. TV 端改造设计

## 7.1 配置项

建议新增一组轻量配置：

1. `relayEnabled`
2. `relayBaseUrl`
3. `relayAccessToken`（可选，但建议预留）
4. `relayHealthTimeoutMs`
5. `relayRequestTimeoutMs`

第一期可先放在：

1. `launch params`
2. 本地设置页
3. 或隐藏调试设置

建议先做：

- `launch params + 本地持久化`

这样开发和真机调试都方便。

## 7.2 调用顺序

TV 端拿播放源时，顺序建议如下：

1. 如果 `relayEnabled=false`，直接走现有直连逻辑
2. 如果 `relayEnabled=true`，先做一次轻量探活
3. 探活成功，则后续 `playurl` 请求优先走 relay
4. relay 返回非 2xx、超时、格式不合法时，立即回退到直连逻辑
5. 回退时写明 telemetry：
   - `relay unavailable`
   - `relay timeout`
   - `relay bad payload`
   - `relay request failed`

## 7.3 fallback 原则

这里必须明确一个原则：

- **fallback 不是备用功能，而是正式设计的一部分。**

因为你的目标不是“必须依赖 relay 才能播”，而是：

- relay 在时争取高清
- relay 不在时依然保底能播

也就是说，用户体感上应该是：

1. 有 relay 时更清晰
2. 没 relay 时退回老方案，但不至于完全坏掉

## 7.4 TV 端数据结构建议

TV 端不一定需要新增一整套新模型。

建议第一期保持当前 `fetchPlaySource()` 主体不变，只做：

1. 把 `requestPlaySource()` 的底层来源抽象成：
   - `direct playurl requester`
   - `relay playurl requester`
2. `fetchPlaySource()` 仍然组装当前 `PlaySource`
3. 这样上层播放器逻辑可以尽量少动

换句话说：

- 这次优先替换“拿原始 playurl 的人”
- 暂时不重写“消费 playurl 的人”

## 8. 错误处理与 telemetry

relay 接入后，需要新增几类 telemetry，方便以后判断是不是 relay 真起作用了。

建议记录：

1. 当前请求来源：`relay` 还是 `direct`
2. relay 健康探测结果
3. relay 响应耗时
4. relay 返回的 `quality / format / host / platform hint`
5. fallback 是否发生
6. fallback 原因

这样以后用户说“怎么又回到 720P”时，我们可以很快分辨：

1. relay 压根没连上
2. relay 连上了，但 B 站还是没给更高质量
3. relay 给了更高质量，但媒体播放链路仍然没跑通

## 9. 安全与部署约束

### 9.1 部署约束

建议默认约束：

1. relay 只监听局域网地址
2. 不做公网映射
3. Docker 容器重启自动恢复
4. Cookie 存在本地环境变量或 secret 文件里

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
3. `/api/playurl` 能正确转发到 B 站
4. 本机 curl 可测通

验收：

1. 本机请求 relay，能拿到和直接请求 B 站一致或更优的 `playurl` 数据
2. 响应中可看到 `quality / format / host`

### Phase 2：TV 接入 relay

目标：

1. TV 端新增 relay 配置
2. `requestPlaySource()` 支持走 relay
3. 失败时自动 fallback 到直连

验收：

1. relay 在线时，TV telemetry 能明确显示 `playurlSource = relay`
2. relay 断掉时，TV 仍能回退直连并维持当前可播能力

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

### 风险 2：relay 账号和 TV 账号不一致

第一期如果直接把 Cookie 配在 relay 上，就可能出现：

1. TV 上登录的是账号 A
2. relay 用的是账号 B

应对：

- 第一期开宗明义写清楚：这是本地私有增强方案，不先做账户同步

### 风险 3：拿到更高质量地址后，真机媒体链路仍可能失败

这时至少能帮助我们把问题继续收敛：

1. 如果 relay 后 `playurl` 明显变好了，问题就更集中在媒体播放链路
2. 如果 relay 后 `playurl` 也没变，问题就更集中在账号/参数/站点策略

## 12. 验收标准

本方案完成后，至少要满足：

1. relay 服务能在 `Mac mini Docker` 上稳定运行
2. TV 端支持 `relay 优先，直连 fallback`
3. relay 不可用时，不影响当前 `720P` 直连播放
4. telemetry 能明确记录本次到底走的是 relay 还是 direct
5. 至少在一批测试视频上，relay 方案能比当前纯前端方案更稳定拿到高清播放地址

## 13. 后续扩展

等 relay 基线跑通后，再做下面两项会更稳：

1. `HEVC / AV1` 优先策略
2. 用户手动切换编码后记住为默认编码

因为那时我们拿到的播放地址质量会更稳定，编码偏好才有真正发挥空间。

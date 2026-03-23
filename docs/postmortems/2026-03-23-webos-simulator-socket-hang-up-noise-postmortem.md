# 2026-03-23 webOS Simulator `socket hang up` 主进程弹窗 Postmortem

## 结论

这次 `webOS TV 6.0 Simulator` 弹出的：

- `A JavaScript error occurred in the main process`
- `Error: socket hang up`

最终没有证据表明它来自仓库业务代码，更像是 **Simulator 自己的 Electron 主进程后台网络请求在宿主网络环境下被对端重置**。

这次要沉淀的结论不是“永远忽略这个弹窗”，而是：

1. **如果弹窗不是在启动瞬间出现，而是在 Simulator 已运行一段时间后才出现，优先怀疑 Simulator / Electron / 宿主网络环境。**
2. **不要看到 `main process` 就立刻把锅甩给当前 App。**
3. **只有当弹窗与页面白屏、导航失效、播放中断、接口失败等业务症状能稳定关联时，才继续往 App 内部排查。**

另外，这次也顺手把一个低成本降噪动作固化进了脚本：

- `npm run webos:simulator` 启动前会主动把 Simulator profile 里的 `auto-inspector` 关闭

这不是“最终根因修复”，但可以减少一类启动期调试噪音。

## 用户可见现象

这次现象有两个很关键的特点：

1. Simulator 可以正常启动，App 也能进入页面。
2. 报错不是启动时立刻出现，而是运行了一段时间后才弹。

弹窗内容固定为：

- `A JavaScript error occurred in the main process`
- `Error: socket hang up`

从用户体感上，它更像：

- 模拟器自己后台有请求断了
- 弹窗打断调试体验

而不像：

- 当前页面一加载就执行崩溃
- React 入口挂载失败
- 播放器业务逻辑直接抛异常

## 排查过程

### 1. 先排除“当前 App 启动链路有问题”

这次第一轮先确认了：

1. `npm run webos:simulator` 可以正常完成 `build:webos`
2. Simulator 能正确打开 `build/webos`
3. 页面样式与交互都能实际跑起来

如果这三条成立，就说明至少不是“App 一启动就把 Simulator 主进程打崩”。

### 2. 再排除“本地媒体代理没有起来”

继续检查时确认：

1. `simulator-media-proxy` 监听端口仍在
2. `scripts/webos-cli.mjs` 的 Simulator 启动分支仍按预期执行
3. 旧 Simulator 会话和旧代理也有被清理

因此这次也不像是：

- 启动脚本直接把代理搞挂
- 代理端口没起来导致主进程立刻出错

### 3. 观察异常出现时机，缩小到“后台网络活动”

真正决定排查方向的，是这个现象：

- 报错不是启动时立刻出现
- 而是运行一段时间后才出现

这会明显改变判断：

1. 如果是入口脚本、页面注入、build 产物问题，通常会在启动阶段立刻暴露
2. 如果是过一段时间才出现，更像定时任务、自动更新、自动调试连接或其它后台 HTTP 请求

### 4. 进一步发现宿主网络本身也不稳定

排查过程中，本机还出现了一个重要旁证：

- `npx -y asar list ...` 请求 npm registry 时直接报了 `ECONNRESET`

这说明当时宿主机网络本身就存在连接被重置的现象，不只是 Simulator 单独报错。

后面用户也确认了：

- “好像是我这里网络环境的问题，现在又好了”

这个旁证非常关键，因为它把问题从“仓库业务代码”进一步收敛成了：

- **宿主网络环境 + Simulator Electron 主进程未兜底的后台请求异常**

## 根因判断

这次更合理的根因判断是：

1. `webOS TV 6.0 Simulator` 自身是一个 Electron 壳应用
2. 它的主进程里存在某些后台 HTTP/HTTPS 请求
3. 在当前宿主网络环境不稳定时，请求被对端重置，触发 `socket hang up`
4. 该异常没有被 Simulator 自己优雅处理，于是弹出主进程错误框

当前没有证据支持以下说法：

1. 是我们的 React 页面直接在主进程执行
2. 是仓库业务逻辑直接触发了这个异常
3. 是 `simulator-media-proxy` 本身导致的必现崩溃

## 为什么这次容易误判

这次很容易误判成“我们的 App 又把 Simulator 搞炸了”，原因有三层：

1. 弹窗写的是 `main process`，天然让人先怀疑当前项目代码
2. `socket hang up` 看上去像是我们本地代理或接口请求断了
3. 它出现在调试当前仓库时，很容易被误关联为“刚改的代码有锅”

但真正更有价值的判断信号是：

1. 弹窗出现前，App 已经稳定跑了一段时间
2. 没有出现稳定的页面白屏、焦点失效、播放器失效等业务症状
3. 宿主环境同时还出现了 npm registry 级别的 `ECONNRESET`

把这三条放在一起看，就不应该继续把主要精力砸在业务代码上。

## 这次做了什么

### 1. 保留 `auto-inspector` 关闭护栏

虽然它不是最终根因，但仍然保留了一个低成本防护：

- `scripts/webos-cli.mjs` 在 `simulator` 分支启动前，会尝试把 Simulator profile 中的 `auto-inspector` 设成 `false`

这样做的意义是：

1. 减少启动阶段额外调试连接带来的噪音
2. 让 `npm run webos:simulator` 更接近“纯启动 App”的稳定路径

需要明确的是：

- 这只是降噪，不是这次 `socket hang up` 的充分修复证明

### 2. 把经验写回调试文档

这次要正式写回的经验是：

1. 如果 Simulator 主进程弹 `socket hang up`，先看出现时机
2. 如果是运行一段时间后才出现，先查宿主网络和 Simulator 背景行为
3. 不要在没有业务症状的前提下，直接改 App 代码

## 后续排查顺序

以后再遇到类似弹窗，按这个顺序判断：

1. 弹窗是在启动瞬间出现，还是运行一段时间后才出现
2. 当前 App 是否同时出现白屏、焦点异常、播放失败、接口失败等业务症状
3. 宿主机其它网络请求是否也存在 `ECONNRESET` / `socket hang up`
4. `simulator-media-proxy` 是否仍在监听
5. 是否只是 Simulator 自己的后台连接失败

只有第 2 条也成立时，才继续把问题往仓库业务代码里深挖。

## 经验沉淀

1. `Simulator main process` 报错不等于当前仓库代码就是根因。
2. “出现时机”比错误文案本身更重要：启动即报，和运行一段时间后才报，排查方向完全不同。
3. 如果宿主网络同时也在报 `ECONNRESET`，要优先把它视为环境噪音源。
4. 对 `webOS Simulator` 这类 Electron 壳工具，先区分“工具自身异常”和“App 业务异常”，再决定改哪里。
5. 可以保留 `auto-inspector` 关闭这类低成本降噪措施，但不能把它误当成最终根因证明。

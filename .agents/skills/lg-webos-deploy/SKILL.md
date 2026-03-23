---
name: lg-webos-deploy
description: Use when you need to package, reinstall, verify the actual installed bundle, launch, or troubleshoot the LG webOS TV app on a real TV or the local webOS Simulator for this repository.
---

# LG webOS TV 打包与部署技能

## 适用范围

只在以下场景使用：
- 把本仓库的 webOS app 打包成 IPK
- 安装、重装、启动、卸载 LG 电视上的 app
- 核对电视实际安装内容是不是当前构建
- 首次接入新电视设备
- 排查 webOS CLI、Node 版本、旧包残留问题

不用于：
- 普通前端功能开发
- 与 LG webOS 部署无关的调试
- Android TV 或其他平台发布流程

## 仓库内标准命令

优先使用本仓库脚本，不要直接调用裸 `ares-package`、`ares-install`、`ares-launch`。

```bash
npm run webos:doctor
npm run webos:package
npm run webos:reinstall -- --device <deviceName>
npm run webos:verify-install -- --device <deviceName>
npm run webos:deploy -- --device <deviceName>
npm run webos:launch -- --device <deviceName>
npm run webos:list -- --device <deviceName>
npm run webos:remove -- --device <deviceName>
```

## 默认做法

真机联调时，默认直接执行：

```bash
npm run webos:deploy -- --device <deviceName>
```

这条命令会串行执行：

1. `build:webos`
2. `package`
3. `reinstall`
4. 等待电视写盘与索引刷新
5. `verify-install`
6. `launch`

只有在你明确要拆步骤排查时，才手动分开执行。

## Simulator 调试规则

如果当前是在本机 `webOS Simulator` 里验证 UI、焦点或播放器基础行为，统一走：

```bash
npm run webos:simulator
```

这条命令现在包含一条额外护栏：

1. 启动新 Simulator 之前，先清理旧 Simulator 进程树
2. 同时清理旧 `simulator-media-proxy` 进程
3. 等旧会话真正退出后，再拉起新的 Simulator

这样做的目的不是“强迫重启”，而是避免下面这些高频误判：

- 屏幕上看到的还是旧包
- 旧调试面板明明删掉了却还在
- 焦点/滚动行为像回到了旧代码
- 一次调试后残留多个 Simulator / DevTools 窗口

结论：

- 只要是重新验证最新构建，优先重新执行 `npm run webos:simulator`
- 不要在旧 Simulator 窗口还活着时继续叠开新实例

### 如果 Simulator 看起来还是旧包，按两层排查

这次仓库里已经踩到一个很具体的坑：

- `dist/assets` 是新的
- 但 `build/webos/index.html` 和 `build/webos/assets` 仍然可能还是旧入口

而 Simulator 实际加载的是 `build/webos`，不是 `dist`。

因此以后只要用户反馈“Simulator 里还是旧样式 / 旧调试面板 / 旧焦点行为”，必须按下面顺序判断：

1. 先确认 `npm run webos:simulator` 是否真的重新执行过 `build:webos`
2. 核对 `build/webos/index.html` 里的 legacy 入口脚本名
3. 再核对 `build/webos/assets/index-legacy-*.js` 是否与 `dist/assets` 最新入口一致
4. 只有在 `build/webos` 已确认是最新产物后，才继续怀疑旧 Simulator 会话残留

不要只看到 `dist` 变了，就直接下结论说 Simulator 一定拿到了新包。

### UI Debug 页的稳定打开方式

如果只是为了核对当前组件和样式，优先用下面两种方式进入 `UI Debug`：

- 浏览器 / Simulator 内按 `Ctrl + Alt + Shift + U`
- 浏览器地址栏使用 `?uiDebug=1`

不建议把 Windows 下的 `npm run ... -- --params '{"route":"ui-debug"}'` 当成唯一入口，因为 `cmd` 转义后 JSON 参数可读性很差，排查时容易误判。

## 绝对规则

### 1. 真机部署命令必须串行

以下命令禁止并行执行：

- `webos:package`
- `webos:reinstall`
- `webos:verify-install`
- `webos:list`
- `webos:launch`

原因：

- `webos:reinstall` 依赖刚刚生成的 IPK 文件
- 如果 `package` 和 `reinstall` 并行跑，`reinstall` 很可能在新 IPK 生成前就开始执行
- 即使 CLI 某一步显示成功，整个安装状态也会变得不可信

结论：

- 真机部署相关命令一律串行执行
- 需要稳定流程时优先 `webos:deploy`

### 2. 不要把 CLI 的 `Success` 当成最终真相

`ares-install` 成功，不等于电视一定运行了新前端代码。

真机判断前，必须执行：

```bash
npm run webos:verify-install -- --device <deviceName>
```

它会直接比对：

- 本地 `build/webos/index.html` 里的入口 JS
- 电视文件系统里已安装 app 的入口 JS

只有两边一致，才允许继续判断“修复有没有生效”。

### 3. 如果电视仍像旧包，先升版本，不要反复猜

当出现下面任一现象时：

- `verify-install` 显示电视入口 hash 与本地不一致
- 电视表现明显像旧代码
- 同版本号反复 `reinstall` 后仍不稳定

直接处理：

1. 提升 `appinfo.json.version`
2. 重新执行 `npm run webos:deploy -- --device <deviceName>`

不要继续反复覆盖同版本包。

### 4. 如果 Simulator 像旧包，先怀疑旧会话残留

当出现下面现象时：

- 页面看起来还是旧 UI
- 已删除的调试面板又出现
- 修好的焦点/滚动在新窗口里像没生效

优先判断：

1. 旧 Simulator 进程是否还没退出
2. 旧 DevTools 子窗口是否还挂在旧会话上
3. 旧 `simulator-media-proxy` 是否还在占用上一轮上下文
4. `build/webos` 的入口脚本是否真的已经同步到最新构建

不要第一时间就下结论说“构建没更新”或“代码回退了”。

## 这次为什么明明有 Skill 还是会失败

不是 Skill 完全没用，而是之前少了两道关键护栏：

1. 没把“真机命令必须串行”写成硬规则
2. 没把“核对电视实际入口 JS hash”做成正式脚本命令

结果就是：

- 人或 Agent 很容易把 `package` 和 `reinstall` 并行跑
- 也容易在 CLI 显示成功后，误以为电视已经装上新包

本次仓库已经补上：

- `npm run webos:verify-install`
- `npm run webos:deploy`

以后优先走这两个入口。

## 关键经验

### 1. Node 25 与 LG CLI 兼容性

本仓库已经验证：
- `@webos-tools/cli` 在当前机器的 `Node 25` 下可能出现异常
- 典型报错：`isDate is not a function`

因此本仓库的 `scripts/webos-cli.mjs` 已固定通过：

```bash
npx -p node@16 node <ares-xxx.js>
```

来执行 LG CLI。

结论：
- 优先跑仓库脚本
- 不要退回裸命令，除非明确验证过兼容版本的 Node 环境

### 2. 打包时禁用 minify

本项目曾遇到：

```text
Failed to minify code
```

因此仓库打包脚本统一使用：

```bash
ares-package --no-minify
```

不要恢复默认 minify，除非确认 LG CLI 已兼容当前产物。

### 3. 判断 Simulator 旧包时，以 `build/webos` 为准

这次实际踩到的现象是：

- `dist/assets/index-legacy-*.js` 已经更新
- 但 `build/webos/index.html` 仍然引用旧的 legacy 入口

结果是：即使重新拉起 Simulator，窗口里看起来仍然像旧版本。

结论：

- 当怀疑 Simulator 没刷新时，先看 `build/webos`
- `prepare-webos` / `build:webos` 没真正同步成功之前，不要把问题归因给缓存
- 只有 `build/webos` 确认是新入口后，Simulator 画面才具备排查价值

## 首次连接新电视

### 前置条件

- 电视已开启 Developer Mode
- 电视与电脑在同一局域网
- 已拿到电视 IP
- 已拿到 Developer Mode 界面的 passphrase
- Developer Mode 的 key server 已开启
- 电脑已安装官方 CLI：

```bash
npm install -g @webos-tools/cli
```

### 设备接入

```bash
ares-setup-device -a <deviceName> -i "username=prisoner" -i "host=<tv-ip>" -i "port=9922"
ares-setup-device -f <deviceName>
ares-novacom --device <deviceName> --getkey
```

按提示输入电视上显示的 passphrase。

### 连接验证

```bash
ares-novacom --device <deviceName> --run "uname -a"
```

如果能返回 Linux 系统信息，说明连接可用。

## 手动拆步骤时的标准顺序

### 1. 先确认工具链

```bash
npm run webos:doctor
```

### 2. 打包 IPK

```bash
npm run webos:package
```

### 3. 清洁重装到电视

```bash
npm run webos:reinstall -- --device <deviceName>
```

### 4. 等待电视完成写盘与索引刷新

默认等待 `8` 秒左右。

### 5. 核对电视实际安装内容

```bash
npm run webos:verify-install -- --device <deviceName>
```

### 6. 启动 app

```bash
npm run webos:launch -- --device <deviceName>
```

## 典型排障

### 报错：`isDate is not a function`

原因：高版本 Node 与 LG CLI 兼容性问题。

处理：
- 使用仓库脚本
- 不要直接运行裸 `ares-install` / `ares-launch`

### 报错：`Failed to minify code`

原因：LG CLI 的 minify 阶段处理当前产物失败。

处理：
- 使用仓库里的 `webos:package`
- 它已经自动走 `--no-minify`

### 报错：`Cannot parse privateKey: Encrypted OpenSSH private key detected, but no passphrase given`

说明 CLI 已拿到 key，但后续连接没有正确使用 passphrase。

处理方向：
- 重新执行 `ares-novacom --getkey`
- 检查 `%APPDATA%\\.webos\\tv\\novacom-devices.json` 中对应设备项是否有 `passphrase`
- 确认设备名、IP、key 文件名一致

### 安装成功但无法启动

依次检查：
- `npm run webos:list -- --device <deviceName>` 是否能看到 app ID
- `appinfo.json` 的 `id`、`main`、`icon` 是否正确
- `build/webos` 是否包含 `index.html`、`appinfo.json`、图标和 assets

### 安装成功但电视仍像旧版本

这是本仓库已经踩过的真问题。

优先按下面顺序排查：

1. 先跑 `npm run webos:verify-install -- --device <deviceName>`
2. 如果 hash 不一致，直接提升 `appinfo.json.version`
3. 再执行 `npm run webos:deploy -- --device <deviceName>`

结论：

- `reinstall` 能降低旧包残留概率，但不是最终保证
- 真正可信的依据仍然是电视文件系统中的实际入口 JS
- 当 LG 安装层对同版本号包表现异常时，升版本比反复覆盖更稳

## 执行时的输出要求

每次完成部署任务时，应明确返回：
- 目标设备名
- 使用的 app ID
- IPK 路径
- 本地入口 JS 与电视入口 JS 是否一致
- 安装是否成功
- 启动是否成功
- 如失败，给出具体报错与下一步处理建议

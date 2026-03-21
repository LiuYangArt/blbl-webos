---
name: lg-webos-deploy
description: Use this skill when you need to package, install, launch, relaunch, remove, or verify the LG webOS TV app from this repository on a real TV. It is specific to this repo's bilibili_webos project and should not be used for unrelated feature development.
---

# LG webOS TV 打包与部署技能

## 适用范围

只在以下场景使用：
- 把本仓库的 webOS app 打包成 IPK
- 安装到 LG 电视
- 启动、重装、卸载、核对安装状态
- 首次接入新电视设备
- 排查 webOS CLI 与 Node 版本兼容问题

不用于：
- 普通前端功能开发
- 与 LG webOS 部署无关的调试
- Android TV 或其他平台的发布流程

## 仓库内标准命令

优先使用本仓库脚本，不要直接调用裸 `ares-install` / `ares-launch`。

```bash
npm run webos:doctor
npm run build:webos
npm run webos:package
npm run webos:install -- --device <deviceName>
npm run webos:launch -- --device <deviceName>
npm run webos:list -- --device <deviceName>
npm run webos:remove -- --device <deviceName>
```

## 关键经验

### 1. Node 25 与 LG CLI 兼容性

本仓库已经验证：
- `@webos-tools/cli` 在当前机器的 `Node 25` 下可能出现异常
- 典型报错：`isDate is not a function`

因此本仓库的 `scripts/webos-cli.mjs` 已经固定通过：

```bash
npx -p node@16 node <ares-xxx.js>
```

来执行 LG CLI。

结论：
- 以后优先跑仓库脚本
- 不要重新退回裸命令，除非你明确在兼容版本的 Node 环境中

### 2. 打包时禁用 minify

本项目曾遇到：

```text
Failed to minify code
```

因此仓库包装脚本已经统一改为：

```bash
ares-package --no-minify
```

不要把这一步改回默认 minify，除非确认 LG CLI 已兼容当前构建产物。

## 首次连接新电视的步骤

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

先添加设备：

```bash
ares-setup-device -a <deviceName> -i "username=prisoner" -i "host=<tv-ip>" -i "port=9922"
ares-setup-device -f <deviceName>
```

再拉取 key：

```bash
ares-novacom --device <deviceName> --getkey
```

按提示输入电视上显示的 passphrase。

### 连接验证

```bash
ares-novacom --device <deviceName> --run "uname -a"
```

如果能返回 Linux 系统信息，说明连接可用。

## 标准部署流程

### 1. 先确认工具链

```bash
npm run webos:doctor
```

### 2. 构建并准备 webOS bundle

```bash
npm run build:webos
```

### 3. 打包 IPK

```bash
npm run webos:package
```

### 4. 安装到电视

```bash
npm run webos:install -- --device <deviceName>
```

### 5. 启动 app

```bash
npm run webos:launch -- --device <deviceName>
```

### 6. 验证是否已安装

```bash
npm run webos:list -- --device <deviceName>
```

确认列表中包含当前 app ID。

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

说明 CLI 已拿到 key，但没有把 passphrase 用在后续连接上。

处理方向：
- 重新执行 `ares-novacom --getkey`
- 检查 `%APPDATA%\.webos\tv\novacom-devices.json` 中对应设备项是否有 `passphrase`
- 确认设备名、IP、key 文件名一致

### 安装成功但无法启动

依次检查：
- `npm run webos:list -- --device <deviceName>` 是否能看到 app ID
- `appinfo.json` 的 `id`、`main`、`icon` 是否正确
- `build/webos` 是否包含 `index.html`、`appinfo.json`、图标和 assets

## 执行时的输出要求

每次完成部署任务时，应明确返回：
- 目标设备名
- 使用的 app ID
- IPK 路径
- 安装是否成功
- 启动是否成功
- 如失败，给出具体报错与下一步处理建议

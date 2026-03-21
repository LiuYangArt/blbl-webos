# AGENTS.md

## 项目目标

本项目是运行在 LG webOS TV 上的第三方哔哩哔哩电视客户端。

所有实现都必须优先满足：
- 遥控器 5-way 导航可用
- 电视端大屏交互习惯可用
- 真机 webOS 安装、调试、播放链路可验证

## UI参考
@ui_ref/

## 参考项目源码
F:\CodeProjects\bilibili_tv_android\PiliPlus

## 技术基线

- 前端栈：`React + TypeScript + Vite`
- 运行平台：`LG webOS TV`
- 分辨率目标：默认按 `1920x1080` 设计
- 输入模型：遥控器优先，Pointer 只是补充

## 代码与架构规则

### 目录职责

- `src/platform/*`：只放 webOS 平台能力封装、遥控器、焦点、生命周期
- `src/features/*`：业务模块，按功能拆分
- `src/components/*`：可复用的通用电视端组件
- `src/app/*`：应用壳、页面栈、全局状态、启动逻辑
- `scripts/*`：构建、打包、部署到 webOS 的脚本

### 平台边界

- 禁止在业务组件里直接散落使用 `window.webOS`、`PalmSystem` 或原始按键码
- 所有 webOS 能力必须先封装到 `src/platform/*`
- 所有遥控器按键必须通过统一 key map 处理

### 电视端 UI 规则

- 每个可操作元素必须有清晰的焦点态
- 不允许出现“看得见但无法通过遥控器聚焦”的主操作
- 默认优先支持方向键、确认键、返回键
- 播放页必须优先保证暂停、继续、返回、快进快退相关交互稳定
- 返回键行为统一遵循：`弹窗 > 面板 > 页面 > 退出应用`

### 性能规则

- 避免重动画、超大阴影、长列表整页渲染
- 长列表必须考虑虚拟化或渐进渲染
- 图片必须支持懒加载或分批加载
- 首屏先保证稳定和清晰，不追求复杂视觉效果

### 接口与安全规则

- 不把登录 token、cookie、敏感响应直接打印到日志
- 对哔哩哔哩接口变更保持防御式处理，所有关键请求要有失败态
- 登录、播放、鉴权逻辑必须与 UI 层分离

## 开发流程规则

- 新增功能前，先确认是否符合 TV 场景，而不是移动端习惯
- 改动前优先复用现有模式，不随意引入新库
- 如果引入新库，先确认项目里确实需要且收益明显
- 修改交互时，同时检查焦点流与返回链路

## 验证规则

完成改动后至少运行：
- `npm run lint`
- `npm run typecheck`
- `npm run build`

涉及 webOS 打包/真机联调时再运行：
- `npm run build:webos`
- `npm run webos:package`
- `npm run webos:install -- --device <deviceName>`
- `npm run webos:launch -- --device <deviceName>`

## webOS 部署规则

- 真实设备部署时，优先使用仓库脚本，不要直接调用裸 `ares-package`、`ares-install`、`ares-launch`
- `scripts/webos-cli.mjs` 已封装 Node 16 兼容层；除非明确验证通过，不要改回当前系统 Node 直接执行 LG CLI
- webOS 打包默认走 `--no-minify`，除非确认 LG CLI 已兼容当前产物，否则不要恢复默认 minify
- 设备名、IP、passphrase、私钥属于本机开发环境配置，不写入仓库业务代码
- 更完整的打包、安装、启动、排障流程，统一参考仓库 Skill：`.agents/skills/lg-webos-deploy/SKILL.md`

## 实施优先级

做功能时按这个优先级判断：
1. 播放链路是否成立
2. 遥控器操作是否顺手
3. 焦点是否稳定
4. 页面性能是否足够
5. UI 是否进一步精细化

## 当前阶段约束

- 先做 MVP，不预埋复杂功能
- 先保证普通视频播放闭环，不提前承诺会员/版权内容
- 先以真机验证为准，浏览器开发体验只作为辅助

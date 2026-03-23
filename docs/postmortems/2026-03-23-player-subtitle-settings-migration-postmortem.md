# 2026-03-23 播放器 CC 字幕设置迁移导致启动崩溃 Postmortem

## 结论

这次故障的直接触发条件是：

1. 新版本播放器设置新增了 `subtitleEnabled` 和 `subtitleStyle` 字段
2. 老用户本地 `localStorage` 里仍是旧结构（只有 `codecPreference` 与 `qualityPreference`）
3. 代码在运行期直接读取 `subtitleStyle.fontSize`，没有先做结构兼容

结果是在播放器初始化阶段抛出：

- `TypeError: Cannot read property 'fontSize' of undefined`

由于异常发生在首屏初始化链路，最终在 Simulator 上表现为：

- `startup-timeout`
- 前端主模块未完成加载
- 自动化播放验证 telemetry 为 `0`

这不是字幕接口本身失败，也不是字体渲染问题，而是**配置结构升级未做兼容迁移**。

## 用户可见现象

用户反馈主要有三条：

1. 视频打不开，播放器无法起播
2. 控制台出现 `fontSize` 相关 `TypeError`
3. Simulator 显示应用启动诊断 `startup-timeout`

这些现象容易被误判成：

- 字幕样式 CSS 问题
- 字体资源问题
- 播放链接问题

但真实根因是设置对象结构不完整导致的运行期空引用。

## 根因分析

问题位置：

- `src/features/player/playerSettings.ts`

核心问题：

1. `readPlayerSettings()` 直接把存储结果当作完整类型返回
2. 未对历史版本缺失字段做 `merge/default` 迁移
3. `PlayerPage` 在初始化时会读取 `subtitleStyle.fontSize` 生成样式变量
4. 旧配置中 `subtitleStyle` 不存在，触发空引用

这是典型的“前向新增字段，但缺少向后兼容读取层”的数据演进问题。

## 修复方案

### 1. 增加设置读取标准化层

在 `playerSettings.ts` 中引入显式标准化函数：

1. `normalizeCodecPreference`
2. `normalizeQualityPreference`
3. `normalizeSubtitleStyle`
4. `normalizeSubtitleFontSize / normalizeSubtitleBottomOffset / normalizeSubtitleBackgroundOpacity`

`readPlayerSettings()` 不再直接信任存储值，而是统一走标准化输出完整结构。

### 2. 保证旧数据自动回填默认值

兼容策略：

1. 字段缺失时回退 `DEFAULT_SETTINGS`
2. 非法枚举值回退到默认选项
3. 仅保留允许值集合，避免脏数据继续扩散到 UI 层

### 3. 增加回归单元测试

在 `playerSettings.test.ts` 增加两类迁移测试：

1. 旧结构缺少 `subtitle*` 字段时，能自动补默认值
2. `subtitleStyle` 存在但值非法时，能按字段粒度回退默认值

## 验证结果

本次修复后完成了下面验证：

1. `npm run typecheck` 通过
2. `npm run lint` 通过
3. `npm run test` 通过
4. 用指定视频 `BV1JXQDB6EvB` 重新执行 `verify:simulator-playback`，收到 `play/progress` 事件，自动验证成功

## 经验沉淀

以后所有本地持久化结构演进都遵守以下规则：

1. 读取层必须做 schema 标准化，不能直接把存储值强转为最终类型
2. 新增字段必须同步补迁移测试，至少覆盖“字段缺失”和“非法枚举”两种情况
3. 初始化路径使用到的配置字段，必须保证“无论存储内容如何都不会抛异常”
4. 对播放器这类首屏路径，优先保证“降级可用”而不是“严格失败”

## 后续约束

继续迭代字幕功能时，必须同时检查：

1. `playerSettings.ts` 的默认值与标准化逻辑是否同步更新
2. `playerSettings.test.ts` 是否覆盖新字段迁移
3. 自动化验证脚本是否仍能在旧存储场景下稳定起播

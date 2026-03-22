# 测试与维护说明

## 为什么现在补这批测试

当前 App 的首页、详情页、播放器主链路已经可以在电视上使用，接下来最怕的不是“大功能不存在”，而是：

- 启动参数一改，直达播放器或调试入口失效
- 首页缓存策略被改坏，导致弱网下没有兜底数据
- 播放回退策略或代理 URL 改坏，真机/模拟器再次出现“能进页但不能播”
- DASH manifest 生成细节回归，播放器重新出现黑屏或无声
- 播放偏好与设备记忆被改坏，编码回退顺序不稳定

所以首批单元测试优先覆盖这些“纯逻辑、高风险、低维护成本”的模块，而不是先去堆大量 DOM 或快照测试。

## 当前覆盖范围

- `src/app/launchParams.test.ts`
  - 启动参数解析
  - 播放器直达路由判定
  - `debugFocus` 与媒体代理参数读取
- `src/features/home/homeFeedCache.test.ts`
  - 首页公开源缓存读写
  - fresh / stale TTL 判断
  - 坏缓存清洗
- `src/features/player/playerMediaProxy.test.ts`
  - 模拟器媒体代理地址解析
  - 候选播放地址改写
- `src/features/player/playerDashManifest.test.ts`
  - DASH manifest 生成
  - XML 转义
  - 缺失 `SegmentBase` 的错误保护
- `src/features/player/playerCodec.test.ts`
  - 编码识别
  - 自动编码优先级
  - 真机 / 模拟器的回退策略
- `src/features/player/playerSettings.test.ts`
  - 播放偏好持久化
  - 设备播放记忆统计与上限
- `src/platform/focus/engine.test.ts`
  - 默认焦点进入
  - 同区几何寻路
  - 显式方向跳转
  - overlay 焦点捕获与释放恢复
  - 按下态点击反馈
- `src/app/routes.test.ts`
  - 页面到主导航高亮的映射
- `src/services/api/http.test.ts`
  - 请求封装、错误格式化、`unwrapData`
- `src/services/api/wbi.test.ts`
  - WBI 签名参数清洗
  - `wts` / `w_rid` 生成
  - 同日缓存与跨日刷新

## 运行方式

日常开发建议至少执行：

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

本地持续调试测试时可以用：

```bash
npm run test:watch
```

## 暂时没有优先补的测试

下面这些不是“不该测”，而是当前阶段更适合继续通过真机验证和更明确的抽象后再补：

- 遥控器焦点引擎的复杂 DOM 导航路径
- 播放器整页 UI 交互
- webOS 真机专有能力封装
- 依赖 B 站线上接口返回的集成链路

原因是这几类测试如果现在直接写，很容易和 DOM 结构、模拟环境或接口波动强耦合，维护成本会明显高于收益。

## 后续建议

后面如果继续补测试，优先级建议按这个顺序走：

1. `src/platform/focus/engine.ts` 中可抽离的几何评分与 section 选择逻辑
2. `src/services/api/*` 中更完整的响应清洗与异常分支
3. `src/features/player/*` 中更多画质/编码/音轨回退组合
4. 与真机脚本相关的 smoke test 或诊断脚本断言

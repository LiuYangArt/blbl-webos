# [作者页] UP 主页面补齐关注/取关闭环

GitHub Issue: `#22`

GitHub URL: `https://github.com/LiuYangArt/blbl-webos/issues/22`

## 背景

当前 `author-space` 页面已经能展示作者基础资料、关注/粉丝统计和投稿视频列表，但仍然缺少最关键的一步互动闭环：用户进入作者页后，不能直接关注或取消关注该 UP 主。

这会让当前体验停留在“可浏览、不可互动”：

- 用户已经进入作者页
- 页面已经拿到了登录态与作者统计信息
- 但无法在这个页面完成关注决策

对 TV 遥控器场景来说，这个断层会比移动端更明显，因为重新绕去其他页面完成关注操作的成本更高。

## 需求目标

为 `author-space` 页面补齐关注/取关能力，并保证：

- 关系状态能被准确读取
- 关注可以直接完成
- 取消关注有防误触确认
- 焦点流和返回链路符合 TV 端习惯

## 方案文档

详细方案见：

- `docs/plans/2026-03-26-author-space-follow-plan.md`

Android 参考调研来源包括：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\user.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\video.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\utils\request_utils.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\introduction\ugc\controller.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\member\controller.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\member\view.dart`

## 推荐实现范围

### 1. API 与类型补齐

- 新增当前 viewer 与作者关系状态类型
- 新增关系读取接口
- 新增关注 / 取关写接口
- 复用现有 `csrf + postForm` 基建

### 2. 作者页 Hero CTA

- 在作者页 Hero 区新增关注按钮
- 支持：
  - `登录后关注`
  - `关注`
  - `已关注`
  - `已互关`
  - `这是你自己`

### 3. 取关确认链路

- 已关注状态下按确认，先弹轻量确认层
- 不是直接 destructive toggle
- 返回键优先关闭确认层

### 4. 状态回写与刷新

- 关注成功后更新 CTA 状态
- 取消关注成功后更新 CTA 状态
- 后台刷新关系状态和作者统计，避免 UI 长时间停留在旧值

## 明确不做

- 特别关注
- 关注分组管理
- 黑名单编辑
- 粉丝页 / 关注页 / 动态页跳转
- 完整复刻 Android 的关注菜单

## 验收标准

1. 已登录用户进入作者页时，能看到正确的关系状态按钮文案。
2. 未关注状态下按确认，可成功关注当前作者。
3. 已关注状态下按确认，不会直接取关，而是先弹确认层。
4. 在确认层中确认取关后，能成功取消关注。
5. 关系状态读取失败时，不会导致整个作者页不可用。
6. 遥控器焦点流稳定，返回链路符合 `弹窗 > 页面` 规则。

## 验证要求

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

建议人工验证：

1. 进入任意作者页
2. 测试未关注 -> 关注
3. 测试已关注 -> 打开确认层 -> 取消关注
4. 测试确认层打开时的返回键行为
5. 测试 Hero 区与视频网格之间的焦点流

## 风险提示

- B 站关系接口返回的是细粒度状态，不是单一布尔值，类型设计需要避免过度简化。
- 取消关注属于破坏性操作，TV 端不能直接做无确认 toggle。
- 若本地登录态缺少 `csrf`，作者页应给出明确错误提示，而不是静默失败。

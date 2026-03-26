# 作者页关注/取关能力方案

## 1. 背景

当前 `bilibili_webos` 已经具备独立的 UP 主页面：

- `src/features/author-space/AuthorSpacePage.tsx`
- `src/services/api/bilibili.ts` 中的作者资料、统计与投稿分页接口

用户已经可以从播放器或其他入口进入作者页，查看：

- 作者头像、昵称、签名、等级
- 关注数、粉丝数
- 作者投稿视频列表
- `最新发布 / 最多播放` 排序

但页面仍缺少一个很关键的闭环能力：**在作者页直接关注 / 取关该 UP 主**。

这会导致当前体验存在明显断层：

1. 用户已经进入作者页，并且看到了作者信息
2. 页面也具备登录体系与作者统计数据
3. 但如果用户决定“以后继续关注这个作者”，仍然只能回到别处处理

对 TV 端来说，这类断层会更明显，因为遥控器输入成本高，用户不适合频繁退出页面再绕回其他入口。

因此，这次需要补的是一个**围绕 TV 作者页的最小互动闭环**：

- 能读到“我和当前作者的关系状态”
- 能在作者页直接发起关注
- 能在作者页直接取消关注
- 焦点、返回链路、确认风险都符合 TV 使用习惯

---

## 2. 当前仓库现状

### 2.1 已有能力

当前仓库已经具备这次需求最核心的基础设施：

1. 作者页壳已经存在
   - `src/features/author-space/AuthorSpacePage.tsx`
   - 已有 Hero 区 + 投稿列表 + 排序按钮 + 焦点分区

2. 作者基础资料与统计接口已经存在
   - `fetchUserSpaceProfile(mid)`
   - `fetchUserRelationStat(mid)`
   - `fetchUserArchivePage({ mid, page, pageSize, order })`

3. 登录与 `csrf` 材料已经可读
   - `readBiliCsrfToken()`
   - `readRelayAuthMaterial()`
   - 登录页已把扫码得到的 `csrfToken` 透传进本地存储

4. 表单 POST 基建已经存在
   - `src/services/api/bilibili.ts` 顶部已引入 `postForm`
   - 历史上报与 heartbeat 已经在同文件中复用这套能力

这说明作者页关注/取关不是“从零起步”的新体系，而是一次相对聚焦的补齐。

### 2.2 当前缺口

当前缺口主要集中在“关系状态”和“写操作”两块：

1. 只读作者统计，没有“当前登录用户与该作者的关系状态”
   - 现在作者页只拿了 `/x/relation/stat`
   - 只能知道作者有多少关注 / 粉丝
   - 不能知道“我是否已经关注他”

2. 还没有针对用户关系的写接口封装
   - 当前 API 层已有播放历史等写接口
   - 但没有用户关注关系的 POST 封装

3. 作者页 UI 没有 CTA 位置
   - Hero 区现在只有排序按钮
   - 没有 `关注 / 已关注` 按钮

4. 还没有 TV 端的取消关注确认链路
   - 遥控器误触成本高
   - 如果直接把“已关注”当成无确认 toggle，风险偏高

### 2.3 相关现状代码

当前作者页的关键信息如下：

- `src/features/author-space/AuthorSpacePage.tsx`
  - 通过 `useAsyncData` 并行请求：
    - `fetchUserSpaceProfile(mid)`
    - `fetchUserRelationStat(mid)`
  - Hero 区操作目前只有排序 chip

- `src/services/api/types.ts`
  - 目前仅有：
    - `SpaceUserProfile`
    - `SpaceRelationStat`
    - `SpaceArchivePage`
  - 尚未定义“当前 viewer 与作者关系”的类型

- `src/services/api/bilibili.ts`
  - 已有：
    - `readBiliCsrfToken()`
    - `reportVideoHistoryProgress()`
    - `reportVideoHeartbeat()`
  - 说明 form POST + `csrf` 路径可复用

---

## 3. Android 参考项目调研结论

这次主要参考：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus`

重点不是照搬 Flutter UI，而是抽出：

- 它如何读关系状态
- 它如何发起关注 / 取关
- 它如何处理不同关系态
- 它在作者页与视频详情里分别收敛到什么粒度

### 3.1 关系状态读取：单独查，不依赖统计接口猜

PiliPlus 在 UGC 视频详情页里，会先单独查询与作者的关系状态：

- `lib/http/user.dart`
  - `UserHttp.hasFollow(mid)` -> `GET /x/relation?fid=<mid>`

- `lib/pages/video/introduction/ugc/controller.dart`
  - `queryFollowStatus()`

它读取的不是单一布尔值，而是一个关系对象，核心字段包括：

- `attribute`
- `special`
- `tag`

其中代码里有一个显式映射：

- 如果 `special == 1`
- 则把 `attribute` 改写成 `-10`
- 用于 UI 统一展示“特别关注”

这说明 Android 实现并不是简单的 `true / false follow`，而是保留了原始关系态的细粒度表达。

### 3.2 写接口：统一走 `/x/relation/modify`

PiliPlus 的关注写操作走：

- `lib/http/video.dart`
  - `VideoHttp.relationMod({ mid, act, reSrc })`
- `lib/http/api.dart`
  - `Api.relationMod = '/x/relation/modify'`

请求特征：

- `POST`
- `application/x-www-form-urlencoded`
- 关键字段：
  - `fid`
  - `act`
  - `re_src`
  - `csrf`

在现有代码里可确认的动作值至少包括：

- `act = 1`：关注
- `act = 2`：取消关注

另外 Android 代码里还有 `act = 6` 的分支，用于处理特殊关系态，但这不是这次 TV MVP 的必要范围。

### 3.3 Android 的交互策略不是“简单 toggle”

PiliPlus 在视频详情页里，对按钮点击做了分流：

1. 未关注时
   - 直接请求 `act = 1`
   - 成功后 toast：`关注成功`

2. 已关注时
   - 不直接取消
   - 先弹出一个菜单
   - 菜单里再提供：
     - 加入 / 移除特别关注
     - 设置分组
     - 取消关注

这意味着 Android 团队实际上已经做了一个明确判断：

- “关注”是低风险操作，可以直接做
- “已关注后的后续操作”是高风险或多分支操作，不宜直接用一个 toggle 覆盖

### 3.4 横屏作者面板与完整作者主页的取舍

PiliPlus 横屏播放器里的作者面板控制器会并行拉：

- `memberInfo(mid)`
- `memberStat(mid)`
- `memberView(mid)`
- `spaceArchive(...)`

对应文件：

- `lib/pages/video/member/controller.dart`
- `lib/pages/video/member/view.dart`

它的 CTA 文案非常克制：

- `关注`
- `已关注`
- `查看主页`

虽然 Android 体系支持“特别关注 / 分组 / 互关 / 黑名单”等更复杂语义，但横屏作者面板本身并没有把所有能力都直接铺平，而是先收敛到用户最常用的路径。

这个取舍很适合 webOS 参考：**TV 端首期不需要照搬全部关系态编辑能力，只要把高频主路径补齐即可。**

---

## 4. 对 webOS 的推荐范围判断

### 4.1 方案选项

#### 方案 A：作者页只做简单 toggle

表现：

- `关注` -> 直接关注
- `已关注` -> 直接取消关注

优点：

- 实现最短
- UI 最简单

缺点：

- 遥控器误触风险高
- 取消关注没有缓冲
- 与 Android 参考项目的交互分层不一致

#### 方案 B：作者页首期做“关注直达，取关确认”

表现：

- 未关注时：
  - 按确认直接关注
- 已关注时：
  - 先弹一个轻量确认层
  - 确认后再执行取消关注

优点：

- 保持 MVP 简洁
- 同时降低取关误触风险
- 符合 TV 遥控器操作习惯
- 比 Android 的完整菜单更克制，符合当前阶段约束

缺点：

- 比纯 toggle 多一个小弹层

#### 方案 C：首期完整复刻 Android 菜单

表现：

- 已关注状态下弹菜单
- 菜单包含特别关注、分组、取消关注

优点：

- 与 Android 参考最接近

缺点：

- 需求范围明显扩大
- TV 焦点、弹层、返回链路复杂度会上升
- 当前仓库没有分组与特别关注的业务承接页

### 4.2 推荐方案

推荐采用 **方案 B：关注直达，取关确认**。

推荐原因：

1. 符合 TV 场景
   - 遥控器确认键误触代价高
   - 取关需要更明确的防误触机制

2. 收敛范围合理
   - 先只做 `关注 / 取消关注`
   - 不把 `特别关注 / 分组 / 黑名单` 一次打包

3. 与 Android 参考的一致性足够高
   - 沿用“已关注态不要直接 destructive toggle”的思路
   - 但把复杂菜单收敛为 TV 更轻的确认弹层

---

## 5. 推荐交互设计

### 5.1 Hero 区 CTA 布局

建议把作者页 Hero 区动作改为两段式：

1. 第一优先动作：`关注 / 已关注 / 登录后关注`
2. 第二优先动作：排序 chip

推荐顺序：

1. 关注按钮
2. `最新发布`
3. `最多播放`

原因：

- 排序只是浏览增强
- 关注/取关才是这个需求的主动作
- 在 TV 端，默认焦点优先落在用户最可能立即使用的主 CTA 上，更符合大屏习惯

### 5.2 按钮文案规则

建议规则如下：

1. 未登录
   - 文案：`登录后关注`
   - 按确认：
     - 进入登录页，或触发上层登录动作

2. 查看自己
   - 文案：`这是你自己`
   - 禁用态，不可提交

3. 未关注
   - 文案：`关注`
   - 按确认直接发起关注

4. 已关注
   - 文案：`已关注`
   - 按确认弹出“取消关注确认层”

5. 互关
   - 文案：`已互关`
   - 行为仍与已关注一致，按确认进入取消关注确认层

6. 特殊或暂不支持的关系态
   - 如黑名单、特别关注、异常 attribute
   - 首期不开放编辑
   - 文案保持保守，如：`当前关系暂不支持修改`

### 5.3 取消关注确认层

建议做一个很轻的 TV 弹层，而不是完整菜单：

- 标题：`取消关注该 UP 主？`
- 描述：`取消后，这位作者的新动态和更新将不再出现在你的关注流中。`
- 操作：
  - `保留关注`
  - `确认取消`

返回键优先级：

- 确认层 > 作者页 > 上一个页面

这样符合仓库既定规则：

- `弹窗 > 面板 > 页面 > 退出应用`

### 5.4 提交反馈

建议反馈策略：

1. 关注成功
   - 轻提示：`关注成功`
   - 按钮状态切到 `已关注`

2. 取消关注成功
   - 轻提示：`已取消关注`
   - 按钮状态切回 `关注`

3. 失败
   - 保持原状态
   - 给出明确提示：
     - `当前登录态缺少 csrf，请重新扫码登录`
     - `关注失败，请稍后重试`
     - `取消关注失败，请稍后重试`

---

## 6. 数据层设计

### 6.1 新增关系读取类型

建议在 `src/services/api/types.ts` 新增：

```ts
export type SpaceViewerRelation = {
  attribute: number;
  special: boolean;
  isFollowed: boolean;
  isMutual: boolean;
  isWhisper: boolean;
  isBlocked: boolean;
  tags: number[];
};
```

这里不要求一次穷举 B 站所有关系语义，但至少要把当前 UI 会用到的判断收敛出来。

### 6.2 新增关系读取接口

建议新增：

```ts
export async function fetchUserViewerRelation(mid: number): Promise<SpaceViewerRelation>
```

推荐直接沿用 Android 参考项目使用的接口：

- `GET /x/relation?fid=<mid>`

原因：

1. Android 已实证在真实项目中可用
2. 与 `/x/relation/modify` 属于同一业务域
3. 返回的是面向“当前 viewer 与目标用户关系”的真实状态，不需要自己猜

注意：

- 未登录时不要调用这个接口
- 查看自己时也不需要调用
- 如果接口失败，不应该拖垮整个作者页

### 6.3 新增写接口

建议新增：

```ts
export async function followUser(mid: number): Promise<void>
export async function unfollowUser(mid: number): Promise<void>
```

底层统一复用：

- `POST /x/relation/modify`
- `postForm(...)`
- `readBiliCsrfToken()`

推荐请求参数：

```ts
{
  fid: mid,
  act: 1 | 2,
  re_src: 11,
  csrf,
}
```

首期不引入 Android 那套额外埋点字段：

- `statistics`
- `x-bili-device-req-json`
- `gaia_source`
- `spmid`
- `extend_content`

原因：

- 当前仓库的核心目标是先打通 TV MVP
- 在没有证据表明这些字段是必需前，不主动放大复杂度
- 如真实联调发现接口必须带这些字段，再按最小补丁补齐

这符合仓库的 KISS 原则。

### 6.4 页面状态组织建议

建议把作者页顶部数据拆成三层：

1. `user`
   - 作者基础资料

2. `relationStat`
   - 关注数 / 粉丝数

3. `viewerRelation`
   - 当前 viewer 与该作者的关系

页面可以继续保留“并行请求”的思路，但不要把 `viewerRelation` 作为页面主数据成功的必要条件。

推荐策略：

- `user + relationStat` 是作者页 Hero 的基础必需数据
- `viewerRelation` 是 CTA 增强数据
- 即便 `viewerRelation` 失败，作者页也应继续可看

### 6.5 提交后的状态回写

推荐使用：

1. 本地即时更新按钮文案
2. 成功后后台重新拉：
   - `fetchUserViewerRelation(mid)`
   - `fetchUserRelationStat(mid)`

原因：

- 只做纯 optimistic 容易把 `粉丝数`、`互关态`、`特别关注态` 留成假数据
- 只做全量 reload 又会让按钮反馈显得迟钝

所以更稳的做法是：

- CTA 立即反馈
- 数据随后 revalidate

---

## 7. 页面与焦点设计

### 7.1 焦点顺序

Hero 区推荐焦点顺序：

1. 关注按钮
2. `最新发布`
3. `最多播放`

方向关系建议：

- `left` -> `@side-nav`
- `down` -> 作者投稿网格
- `up` -> 保持在 Hero 区内

这样可以让用户进入页面后：

- 先看作者信息
- 可以一键关注
- 再快速下探到投稿列表

### 7.2 弹层焦点规则

取消关注确认层打开后：

- 默认焦点落在 `保留关注`
  - 避免误触 destructive 按钮

按钮顺序建议：

1. `保留关注`
2. `确认取消`

返回键：

- 关闭确认层

### 7.3 与现有返回链路的关系

当前仓库已经有明确约束：

- `弹窗 > 面板 > 页面 > 退出应用`

所以这次实现时要保证：

1. 若确认层开启，返回键先关闭确认层
2. 若确认层未开启，返回键离开作者页
3. 不允许出现“确认层仍开着，却直接退回播放器”的行为

---

## 8. 错误处理与边界条件

### 8.1 未登录

行为建议：

- 不调用 `fetchUserViewerRelation`
- 按钮显示 `登录后关注`
- 按确认时走现有登录流程

### 8.2 缺少 `csrf`

可能原因：

- 用户本地资料存在，但扫码材料不完整
- relay 同步材料缺失
- cookie 过期

行为建议：

- 关注 / 取关提交前读取 `readBiliCsrfToken()`
- 缺失时直接报错，不做隐式降级
- 文案明确提示：
  - `当前登录态缺少 csrf，请重新扫码登录`

### 8.3 查看自己

如果：

- `auth.profile?.mid === authorMid`

建议：

- 不允许显示普通 `关注` CTA
- 显示禁用态文案：`这是你自己`

这样可以避免：

- 自己关注自己这类无意义交互
- 后续出现接口报错再回头兜底

### 8.4 关系读取失败

如果：

- `fetchUserViewerRelation(mid)` 失败

建议：

- 页面主体继续展示
- CTA 降级为：
  - `关系状态读取失败`
  - 或保守地只展示 `关注功能暂不可用`

但不要：

- 因为 CTA 失败让整个作者页退回错误页

### 8.5 黑名单 / 特别关注等复杂关系态

首期建议只做到：

- 能识别这些状态
- 但不提供完整编辑能力

特别是：

- `attribute = 128` 或类似黑名单语义

首期可以直接显示为不可修改说明态，而不是贸然开放写操作。

---

## 9. 实施拆解建议

### 9.1 API 层

新增或扩展：

- `src/services/api/types.ts`
  - 增加 `SpaceViewerRelation`

- `src/services/api/bilibili.ts`
  - 增加 `fetchUserViewerRelation(mid)`
  - 增加 `followUser(mid)`
  - 增加 `unfollowUser(mid)`

- `src/services/api/bilibili.test.ts`
  - 补关系读取与写接口单测

### 9.2 页面层

修改：

- `src/features/author-space/AuthorSpacePage.tsx`

建议改动点：

1. 增加 CTA 状态读取
2. 增加提交中的本地 busy 状态
3. 在 Hero 区插入关注按钮
4. 已关注状态接入确认层
5. 成功后刷新关系状态与统计数据

### 9.3 可能需要补的通用能力

如果当前仓库没有合适的 TV 弹层组件，建议优先抽成通用组件，而不是把确认层逻辑直接写死在作者页里。

候选位置：

- `src/components/*`

但要严格控制范围：

- 只抽“当前确实复用得上的确认弹层”
- 不因为这次需求顺手扩成一整套复杂弹窗框架

---

## 10. 测试与验证要求

### 10.1 单元测试

至少补以下测试：

1. `fetchUserViewerRelation`
   - 正常映射 `attribute`
   - `special == 1` 时的状态判定

2. `followUser`
   - 发送正确的 `fid / act / re_src / csrf`

3. `unfollowUser`
   - 发送正确的 `fid / act / re_src / csrf`

4. `AuthorSpacePage`
   - 未登录态 CTA
   - 已关注态 CTA
   - 查看自己态 CTA
   - 取关确认层打开与关闭

### 10.2 人工验证

建议人工验证路径：

1. 用已登录账号进入任意作者页
2. 若当前未关注：
   - 焦点落到 `关注`
   - 按确认后出现成功提示
   - 按钮变为 `已关注`

3. 若当前已关注：
   - 焦点落到 `已关注`
   - 按确认打开确认层
   - 选择 `保留关注`，确认按钮状态不变
   - 再次打开确认层，选择 `确认取消`
   - 按钮恢复 `关注`

4. 检查返回链路：
   - 确认层打开时，返回键先关闭确认层
   - 作者页返回后再回到上一页

5. 检查焦点流：
   - Hero 区 CTA 与排序按钮都可聚焦
   - 能从 Hero 正常下移到视频网格

### 10.3 仓库要求验证命令

完成实现后至少运行：

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

---

## 11. 明确不做

这次需求首期明确不做：

- 特别关注编辑
- 关注分组管理
- 粉丝页 / 关注页 / 动态页跳转
- 黑名单编辑
- 完整复刻 Android 的关系菜单
- 作者页扩成完整空间多 Tab

这样可以确保范围始终围绕一个目标：

**在 TV 作者页里补齐“关注 / 取关”主路径闭环。**

---

## 12. 验收标准

1. 已登录用户进入作者页时，页面能正确显示 `关注 / 已关注 / 已互关 / 这是你自己` 等合适状态。
2. 未关注作者时，按确认可直接关注成功。
3. 已关注作者时，按确认会先弹出取消关注确认层，而不是直接取关。
4. 在确认层选择 `确认取消` 后，能成功取消关注。
5. 关注或取关成功后，按钮状态会及时更新，并能刷新作者统计信息。
6. 关系状态读取失败时，不会拖垮整个作者页主体。
7. 焦点流、返回链路与 TV 端操作习惯保持稳定。

---

## 13. 推荐实施顺序

1. 先补 API 类型与关系读写接口
2. 再把作者页 Hero 区 CTA 接进来
3. 再补取关确认层
4. 最后补单测与真机 / 模拟器人工验证

这样做的原因是：

- 先把“数据真能读、写真能通”坐实
- 再做 UI 和焦点
- 能最大程度降低后续返工

# 播放器 OSD 作者页入口与作者视频列表方案

## 1. 背景

当前 `bilibili_webos` 的播放器已经有稳定的底部 OSD 控制条、播放器详情数据、推荐视频横条、分 P 横条，以及统一的焦点与返回链路。  
但播放器里还缺少一个非常典型的 B 站观看链路：

- 用户正在看一个视频
- 想看看这个作者还有什么别的视频
- 希望直接从播放器进入作者页继续浏览

这次需求不是单纯“多一个按钮”，而是要把“播放器内容跳转链路”补完整：

1. 在播放器下方 OSD 新增作者入口
2. 点击后进入作者页面
3. 页面里展示作者的视频列表
4. 整条链路符合 TV 遥控器与页面返回习惯

本方案先基于安卓参考项目 `PiliPlus` 的真实实现做归纳，再结合当前 webOS 仓库现状，给出一个适合 TV MVP 的落地方案。

## 2. 安卓参考项目结论

### 2.1 播放页里已有“作者入口”

安卓参考项目在视频介绍区点击作者头像时，并不是一律直接跳完整个人主页。  
在横屏播放态下，如果启用了横屏作者页能力，会通过：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\introduction\ugc\view.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\view.dart`

触发 `onShowMemberPage(mid)`，拉起一个播放态内的作者面板 `HorizontalMemberPage`。  
如果不是横屏面板模式，则走 `/member?mid=...` 进入完整主页。

这说明安卓参考项目实际上把作者浏览拆成了两层：

1. 播放态作者面板
2. 完整作者主页

### 2.2 播放态作者面板的结构很克制

安卓的 `HorizontalMemberPage` 不是完整复制“个人空间”，而是只放最关键的信息：

- 作者头像、昵称、等级、粉丝/关注/获赞等摘要
- 一个“关注/已关注”按钮
- 一个“查看主页”按钮
- 当前作者的视频列表
- 排序切换：`最新发布` / `最多播放`
- 顶部视频总数提示：`共 X 视频`

对应文件：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\member\view.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\member\controller.dart`

这套设计的重点不是“功能堆满”，而是围绕“从正在播放的视频继续看作者其他视频”这个核心目标做最小闭环。

### 2.3 安卓数据链路

安卓播放态作者面板会并行请求：

- `memberInfo(mid)`：作者基础资料
- `memberStat(mid)`：关注、粉丝、获赞等统计
- `memberView(mid)`：登录态下的额外关系信息
- `spaceArchive(type=video, mid, order, aid, sort, includeCursor)`：作者视频列表

对应实现：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\member.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\api.dart`

其中视频列表走的是：

- `/x/v2/space/archive/cursor`

并支持：

- `order = pubdate | click`
- cursor 风格分页
- 初始把当前视频 `aid` 传进去，尽量让列表围绕当前视频上下展开

### 2.4 安卓完整主页不是这次 MVP 要照搬的对象

安卓完整主页 `MemberPage` 下面挂了很多 tab：

- 首页
- 动态
- 投稿
- 番剧
- 收藏
- 小店等

对应文件：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\member\view.dart`

这对 Android 触屏场景是合理的，但对当前 webOS MVP 来说过重。  
用户这次需求非常聚焦，只要求：

- 从播放器 OSD 进入作者页
- 页内能看作者视频列表

因此我们应该借鉴安卓的“播放态作者入口”和“作者视频列表组织方式”，但不应一次性把完整个人空间全搬过来。

## 3. 当前 webOS 仓库现状

### 3.1 已有可直接复用的能力

当前仓库里已经有几块关键基础设施可以直接复用：

- `src/components/PlayerControlBar.tsx`
  - 底部 OSD 已经是稳定的横向按钮链，扩一个按钮成本很低
- `src/features/player/PlayerPage.tsx`
  - 已经拿到了 `fetchVideoDetail(bvid)` 的结果，可以直接读到 `detail.owner.mid`
- `src/app/routes.ts`
  - 当前路由是轻量 page stack，新增一个“作者页”路由即可
- `src/components/VideoGridSection.tsx`
  - 已支持 TV 卡片网格、渐进显示、分页加载更多、焦点流
- `src/features/shared/usePagedCollection.ts`
  - 已有可复用的分页加载 Hook
- `src/features/shared/videoListItems.ts`
  - 已有统一视频卡片数据映射和“补全可播放 payload”的能力

### 3.2 当前缺口

当前仓库还没有以下能力：

- 作者页路由
- 作者资料 API
- 作者视频列表 API
- 作者视频列表的数据类型
- 从播放器直接打开作者页的事件链
- 作者页的 TV 焦点结构和返回链路

### 3.3 当前页面栈会在离开播放器时卸载播放器页面

`src/app/usePageStack.ts` 当前是最简单的栈式路由。  
切到新页面时，旧页面组件不会 keep-alive，而是会卸载；回退时重新挂载。

这意味着：

- 从播放器进入作者页，本质上是离开当前播放器页
- 返回播放器时，会重新进入播放器页
- 当前仓库已有观看进度持久化，因此可以回到接近上次观看位置
- 但这不是“视频持续在后台播放”的体验

这点要在方案里明确，因为它会影响用户预期。  
本次需求只做“进入作者页浏览”，不把“播放器后台保活”一起打包进来。

## 4. 可选方案对比

### 4.1 方案 A：OSD 直接进入独立作者页

交互：

- 播放器底部 OSD 增加 `UP主页` 按钮
- 点击后 push 一个新的作者页路由
- 作者页顶部展示作者简介，下方展示作者视频列表
- 返回键直接回到播放器

优点：

- 最符合用户原始描述“进入视频作者的页面”
- 与当前 `page stack + VideoGridSection` 结构最匹配
- 焦点流最清晰，TV 上也更容易维护
- 不需要在播放器里再塞一层新的 overlay 复杂度

缺点：

- 进入作者页会离开当前播放器，返回时不是原生 keep-alive

### 4.2 方案 B：OSD 先打开播放器内作者抽屉，再二跳完整作者页

交互：

- 点击 OSD 按钮后，先在播放器内打开一个作者抽屉/侧边面板
- 抽屉里展示作者简介和视频列表
- 用户再决定是否进入完整作者页

优点：

- 更接近安卓参考项目
- 播放画面可继续保留在背景中

缺点：

- 当前播放器已经有设置抽屉、字幕抽屉、推荐横条、分 P 横条
- 再加一层作者抽屉，会让 overlay 模式和返回链路明显变复杂
- 用户这次并没有要求“播放中悬浮作者面板”

### 4.3 方案 C：OSD 打开“作者视频横条”

交互：

- 像推荐视频横条一样，从底部打开一个作者视频 strip
- 只展示视频卡片，不做独立页面

优点：

- 实现路径最短
- 与当前推荐视频 strip 形态接近

缺点：

- 不符合“进入作者页面”的需求
- 作者信息承载不足
- 后面还是很可能要补真正的作者页

### 4.4 推荐方案

推荐采用 **方案 A：OSD 直接进入独立作者页**。

原因：

1. 最贴合用户需求本身，没有绕一层“先面板再主页”的额外学习成本。
2. 与当前仓库路由、视频网格、分页 Hook、焦点体系最兼容，改动面最小。
3. 安卓参考真正值得借鉴的是“作者入口要放在播放链路里”和“作者页要围绕视频列表组织”，而不是必须复制它的播放态面板形态。

## 5. 推荐落地方案

### 5.1 交互目标

用户从播放器进入作者页的目标链路如下：

1. 视频正常播放时，按方向键/确认键唤起普通 OSD。
2. 在底部控制条中看到新的 `UP主页` 按钮。
3. 按确认后离开播放器，进入作者页。
4. 作者页展示作者基础信息和视频列表。
5. 用户可切换排序、向下浏览、继续打开作者的其他视频。
6. 返回键回到上一个播放器页面。

### 5.2 OSD 按钮设计

建议新增按钮：

- 文案：`UP主页`
- 图标：新增一个“作者/账号”语义图标，建议使用 `account_circle`
- 位置：放在 `分P / 选集` 与 `推荐视频` 之间

这样做的原因：

- `分P / 选集`、`UP主页`、`推荐视频` 都属于“内容跳转类”操作
- 可以和 `CC 字幕`、`设置` 这类“播放配置类”操作区隔开

按钮状态规则：

- `detail.owner.mid > 0`：正常可点击
- `detail.owner.mid <= 0` 或详情缺失：保持可聚焦但禁用视觉态，按确认提示“当前视频缺少作者信息”

首期不做“只在部分内容类型显示按钮”的复杂分支，规则保持简单直接。

### 5.3 路由与页面壳

新增一个独立路由：

- `author-space`

建议路由载荷：

```ts
{ name: 'author-space'; mid: number; authorName?: string; sourceBvid?: string }
```

其中：

- `mid`：作者唯一标识，页面主查询条件
- `authorName`：用于首屏兜底文案
- `sourceBvid`：可选，用于后续做“当前来源视频”标识或排序体验优化

对应改动点：

- `src/app/routes.ts`
- `src/App.tsx`
- `src/features/player/PlayerPage.tsx`

页面壳策略：

- 作者页使用普通内容页壳，不走播放器沉浸式壳
- 左侧导航可以显示，但 `getActiveNav()` 建议返回 `null`

原因：

- 作者页不是全局一级导航页
- 也不应该错误高亮到“我的”或“关注”
- 进入作者页后，默认焦点仍应先落主内容区

### 5.4 API 与数据模型

虽然安卓作者列表走的是 app 端 `/x/v2/space/archive/cursor`，但当前 webOS 仓库的 API 基线是 web 接口 + `signWbi`。  
因此推荐继续沿用当前仓库风格，新增以下 API：

1. `fetchUserSpaceProfile(mid)`
   - 建议接口：`/x/space/wbi/acc/info`
   - 返回作者头像、昵称、签名、等级/VIP 等基础信息

2. `fetchUserRelationStat(mid)`
   - 建议接口：`/x/relation/stat`
   - 返回关注数、粉丝数

3. `fetchUserArchivePage({ mid, page, pageSize, order })`
   - 建议接口：`/x/space/wbi/arc/search`
   - 返回作者投稿视频列表
   - 排序值首期只支持：
     - `pubdate`
     - `click`

建议新增类型：

```ts
type SpaceUserProfile = {
  mid: number;
  name: string;
  face: string;
  sign: string;
  level: number;
  vipLabel: string | null;
};

type SpaceRelationStat = {
  following: number;
  follower: number;
};

type SpaceArchiveItem = {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  cover: string;
  duration: number;
  ownerName: string;
  playCount: number;
  danmakuCount: number;
  description: string;
  publishAt: number;
};

type SpaceArchivePage = {
  items: SpaceArchiveItem[];
  hasMore: boolean;
};
```

说明：

- 首期不把“获赞数”“投稿总数”“关系状态”等安卓全部字段都搬过来
- 只保留作者页首屏和视频卡片真正会用到的字段
- 继续遵守 KISS，不为了未来可能的完整空间页预埋过多模型

### 5.5 页面结构

作者页建议拆成两个主区：

#### A. 作者 Hero 区

非沉浸式顶区，展示：

- 头像
- 昵称
- 签名
- 关注数 / 粉丝数
- 可选的等级 / VIP 标签

这个区域首期可以只读展示，不强制放“关注”按钮。  
原因：

- 用户本次需求核心是看视频列表
- 当前仓库还没有完整关系操作能力
- 如果现在加关注按钮，后面还要补登录态校验、接口、失败态与状态同步，容易扩范围

#### B. 视频列表区

复用 `VideoGridSection`，展示作者投稿视频。

列表区顶部加一个单独的动作 section，提供：

- `最新发布`
- `最多播放`

两种排序切换。

页面结构建议：

1. `author-hero`：作者信息，只读
2. `author-actions`：排序操作，默认焦点落这里
3. `author-grid`：视频卡片网格

这样做的好处是：

- 焦点层次清晰
- 排序与内容列表分离
- 不需要为了一个“排序按钮”去篡改 `VideoGridSection` 的默认焦点策略

### 5.6 视频列表加载策略

建议直接复用 `usePagedCollection()`：

- 初次加载：`page = 1`
- 卡片焦点接近尾部时自动请求下一页
- 排序切换时执行整页 reset + reload

网格数据转换方式：

- API 项目先映射为 `VideoCardItem`
- 再用 `createResolvedVideoListItem()` 包装
- 播放入口继续走 `resolveVideoPlayerPayload()`，保证缺少 `cid` 时仍可补详情

这样可以和首页、热门、关注区继续共用同一套视频卡片与播放补全逻辑。

### 5.7 焦点与返回链路

焦点规则建议如下：

- 作者页进入后，默认焦点落在 `author-actions` 的 `最新发布`
- `down` 进入 `author-grid`
- `left` 从内容区返回 `@side-nav`
- `back`
  - 作者页无弹窗/抽屉时：直接返回上一页
  - 如果作者页未来新增弹层，则仍遵循 `弹层 > 页面` 的统一规则

从播放器进入作者页后，返回播放器的用户体验定义为：

- 回到原播放器路由
- 播放器按当前已有逻辑恢复
- 不承诺后台连续播放

这个预期必须在 issue 中写清楚，避免后续把“作者页”误扩成“播放器保活专题”。

### 5.8 与安卓参考差异的明确说明

本方案和安卓参考项目的关键差异有两点：

1. 安卓在播放页里先开 `HorizontalMemberPage`，webOS 首期直接进独立作者页。
2. 安卓作者层支持“关注”“查看主页”“更多 tab”，webOS 首期只收敛到“作者资料 + 视频列表 + 排序”。

这是主动取舍，不是能力缺失。  
原因是 webOS 当前更需要：

- 先把用户明确提出的路径闭环做稳
- 保持 OSD overlay 复杂度不继续膨胀
- 避免把“作者空间”做成第二个大型子系统

### 5.9 首期范围

首期必须实现：

- 播放器 OSD 新增 `UP主页` 按钮
- 点击进入独立作者页
- 作者页展示基础资料
- 作者页展示作者视频列表
- 支持 `最新发布 / 最多播放` 排序
- 支持分页加载更多
- 支持打开作者视频继续播放
- 返回键能回到上一页播放器

首期明确不做：

- 播放器内作者抽屉
- 完整 UP 空间 tab
- 关注/取关
- 粉丝页、关注页、动态页
- 当前视频在作者列表里的自动定位
- 播放器后台保活

## 6. 任务拆分

### Phase A：API 与类型

- 在 `src/services/api/types.ts` 增加作者页相关类型
- 在 `src/services/api/bilibili.ts` 增加作者资料、关系统计、作者视频分页接口
- 为新 API 补充映射测试

### Phase B：路由接入

- `src/app/routes.ts` 增加 `author-space`
- `src/App.tsx` 增加页面渲染与事件传递
- `PlayerPage` 增加 `onOpenAuthorSpace`

### Phase C：OSD 入口

- `src/app/iconRegistry.ts` 增加作者入口图标
- `src/components/PlayerControlBar.tsx` 增加 `UP主页` 按钮
- `src/features/player/PlayerPage.tsx` 接入打开作者页逻辑
- 处理 `mid` 不存在时的禁用态与提示文案

### Phase D：作者页实现

- 新增 `src/features/author-space/AuthorSpacePage.tsx`
- 接入作者资料加载
- 接入排序 section
- 复用 `VideoGridSection` 展示视频列表
- 接入分页与播放跳转

### Phase E：样式与调试面板

- 在 `src/styles/app.css` 增加作者页所需样式
- 检查 `src/features/debug/UiDebugPage.tsx` 是否需要补充新的真实控件来源展示

### Phase F：验证

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

## 7. 验收标准

满足以下条件即可认为该需求完成：

1. 播放器普通 OSD 中能看到新的 `UP主页` 按钮。
2. 有效作者信息的视频，按确认后可进入作者页。
3. 作者页能显示作者头像、昵称、签名或合理空态。
4. 作者页能显示作者视频列表，且支持继续向下加载更多。
5. 作者页可以在 `最新发布` 与 `最多播放` 之间切换排序。
6. 点击作者页中的任意视频，能够继续进入对应播放器页。
7. 返回键从作者页可以回到上一页播放器。
8. 整体焦点流稳定，不出现“能看到但无法聚焦”的主操作。

## 8. 风险与注意事项

### 8.1 空间接口的返回结构与风控

作者资料和作者投稿列表大概率要走 WBI 签名接口。  
虽然当前仓库已有 `signWbi`，但在真正实施前仍需做一次本地接口验证，确认：

- 返回结构稳定
- 游客态是否可正常访问
- 是否存在额外风控限制

### 8.2 返回播放器不是 keep-alive

当前页面栈不是保活式路由。  
因此“从播放器进作者页再返回”会是：

- 返回到播放器页面
- 按已有逻辑恢复

不是：

- 视频全程在后台不断流继续播放

如果后续用户对这个体验有更高要求，应单独开题做“播放器保活/后台悬浮路由”。

### 8.3 作者视频列表里的 `cid` 完整性

部分列表接口未必每条都返回稳定 `cid`。  
因此作者页里的卡片打开逻辑不能假设 `cid` 永远可用，仍应复用现有 `resolveVideoPlayerPayload()` 兜底。

## 9. 推荐 Issue 标题

`播放器 OSD 新增 UP 主页入口，并支持查看作者视频列表`

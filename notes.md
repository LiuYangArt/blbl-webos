# Notes: PiliPlus 迁移规划调研

## 参考来源

### Source 1: `F:\CodeProjects\bilibili_tv_android\PiliPlus\README.md`
- 参考项目是功能非常完整的第三方哔哩哔哩客户端，覆盖推荐、热门、番剧、直播、搜索、历史、收藏、稍后再看、用户中心、消息、动态、设置等。
- 播放器能力远超当前 WebOS 骨架，包含画质、音质、倍速、弹幕、字幕、播放记忆、视频比例、PIP、SponsorBlock 等。
- 同时包含大量移动端/桌面端导向功能，例如手势控制、离线缓存、DLNA、私信发图、编辑动态、多账号等。

### Source 2: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\router\app_pages.dart`
- 路由规模很大，说明参考项目已经发展为完整客户端而非单一播放器外壳。
- 主业务域可归纳为：首页、热门、搜索、视频详情、直播、动态、用户、收藏/历史/稍后再看、消息、设置、文章/音频/PGC。

### Source 3: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\models\common\nav_bar_config.dart`
- 一级导航只有三个核心入口：`首页`、`动态`、`我的`。
- 其余能力大多通过页面内跳转或二级入口进入，说明“一级导航少、内容域丰富”的结构是成立的。

### Source 4: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\main\controller.dart`
- 主控制器承担导航切换、消息未读、动态未读、默认搜索词、回顶/刷新等全局调度职责。
- 这些能力对 TV 也有价值，但应先保留“全局壳 + 少量一级导航 + 各页自管理数据”的方向，不急着复制所有状态管理细节。

### Source 5: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\home\view.dart`
- 首页重点不是单一列表，而是搜索入口、未读提示、Tab 分类与推荐内容容器。
- 对 TV 而言可提炼为：顶部搜索入口 + 推荐泳道 + 分类/切换能力，而非保留手机式紧凑顶栏。

### Source 6: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\view.dart`
- 视频页是完整的“详情 + 播放器 + 选集 + 简介 + 评论 + 相关推荐”复合页。
- 当前 WebOS 项目只有播放器骨架，没有真实详情流，因此视频详情页会是迁移过程中的核心中枢页。

### Source 7: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\plugin\pl_player\controller.dart`
- 参考项目播放器控制器非常重，包含播放状态、进度、缓冲、倍速、音量亮度、弹幕、后台播放、PIP、历史记录等。
- 对 WebOS 不应直接照搬控制器规模，而应先抽出 TV 必需子集：播放地址加载、暂停/继续、快进快退、选集、清晰度、进度同步、基础设置。

### Source 8: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\search\view.dart`
- 搜索包含输入、联想、热搜、搜索发现、历史记录与分类结果。
- WebOS 需要先做“可聚焦搜索入口 + 热搜/历史 + 结果页”，输入法接入与复杂联想可后置。

### Source 9: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\history\view.dart`
- 历史记录不仅是简单列表，还包含分类 Tab、搜索、多选、删除、暂停记录等。
- TV 端首版只需优先支持查看、继续播放、删除单条/清空，不必一开始就做多选管理。

### Source 10: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\login\view.dart`
- 登录支持扫码、Cookie、账号密码等多路径。
- WebOS 首版最适合先做扫码登录，Cookie 与账号密码输入不适合作为电视首选路径。

### Source 11: 当前 `bilibili_webos` 仓库
- 目前已有稳定的 webOS 打包、安装、启动链路，以及页面栈、遥控器按键映射、基础焦点系统。
- 页面仍停留在静态 Demo 阶段，只有首页与播放器页骨架，缺少真实数据、路由体系、鉴权状态、详情页、搜索页和用户资产页。

## 综合结论

### 参考项目能力应如何拆成 WebOS 阶段
- P0 主闭环：首页推荐、搜索入口/结果、视频详情、播放器、登录、历史。
- P1 用户资产：收藏、稍后再看、个人中心、基础设置。
- P2 内容扩展：热门、番剧/PGC、直播入口、分区/排行榜。
- P3 社交扩展：动态、评论增强、消息、用户主页深链。
- P4 长尾能力：SponsorBlock、DLNA、离线缓存、WebDAV、多账号、复杂设置。

### 适合优先抄的不是“页面外观”，而是这些结构
- 页面与浮层的返回链路
- 一套统一的 TV 路由与焦点分区方案
- 首页到详情到播放器的内容流
- 统一的数据请求层、鉴权状态层、历史记录与收藏状态同步
- 可扩展的播放器状态机

### 明显不该早期照搬的能力
- 手机手势交互
- 桌面窗口、托盘、PIP、后台播放
- 离线下载与本地文件管理
- 私信、动态发布、复杂编辑器
- 需要大量维护成本的长尾设置项

---

# Notes: 首页登录态分区与高画质能力调研

## 当前 WebOS 仓库现状

### Source 1: `src/features/home/HomePage.tsx`
- 首页目前只有 `Hero + 首页推荐 + 热门速看` 三段。
- 没有“个性推荐 / 正在关注 / 订阅剧集 / 热门视频 / 排行 / 直播”这一类首页二级频道条。
- 登录态不会改变首页内容结构，只影响部分其他页面是否可访问。

### Source 2: `src/app/routes.ts` 与 `src/components/SideNavRail.tsx`
- 左侧一级导航当前固定为：首页、热门、搜索、历史、稍后、收藏、我的、登录。
- 登录后只会隐藏 `登录` 项，不会新增“正在关注”或“订阅剧集”入口。
- 这说明用户截图中的能力，当前既不在一级导航，也不在首页二级频道中实现。

### Source 3: `src/services/api/bilibili.ts`
- 当前播放器接口已经不是纯骨架，而是会请求 `/x/player/playurl`，并带上 `fnval=4048/16`、`fourk=1`。
- 但 `fetchPlaySource()` 默认入参仍是 `quality = 80`，`PlayerPage` 也是直接调用 `fetchPlaySource(bvid, cid)`，即默认目标档位固定为 `80`。
- 当前能解析 `support_formats`、`accept_quality`、`dash.video`、`dash.audio`，但还没有“用户可见的画质切换”。
- 当前类型没有显式承接 `dash.dolby`、`dash.flac`、HDR / 杜比视界等高级视频档位元信息。

## Android 参考项目关于高画质的实现

### Source 4: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\video.dart`
- `VideoHttp.videoUrl()` 请求 UGC/PGC 播放地址时，会带 `qn`、`fnval=4048`、`fourk=1`、`voice_balance=1`。
- 这说明安卓参考项目从一开始就是按“拿完整 DASH 元信息 + 高画质能力”设计的，而不是只拿一个低档位兼容流。
- 同文件还存在 `tvPlayUrl()`，会请求 `/x/tv/playurl`，并带 `access_key`、`playurl_type`、`qn`、`fourk=1`。这条链路对后续 WebOS 研究“更像电视端的取流口径”很有参考价值。

### Source 5: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\models\video\play\url.dart`
- `PlayUrlModel` 会解析 `support_formats`、`dash.video`、`dash.audio`。
- 音频侧不仅解析普通 `audio`，还会把 `flac.audio` 与 `dolby.audio` 合并进可选音轨。
- 这意味着参考项目不只认识普通 DASH，还已经给高音质 / 杜比音频预留了数据层入口。

### Source 6: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\models\common\video\video_quality.dart`
- 质量枚举明确包含：
  - `1080P`
  - `1080P 高码率`
  - `1080P 60帧`
  - `4K`
  - `HDR`
  - `杜比视界`
  - `8K`
  - `HDR Vivid`
- 这说明安卓参考项目在数据模型层已经完整承认这些质量档位的存在。

### Source 7: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\controller.dart`
- `queryVideoUrl()` 会根据接口返回的 `acceptQuality` 和本地偏好，选择“当前可播放的最高质量”或“用户偏好的最近可用质量”。
- `findVideoByQa()` 与 `updatePlayer()` 会在同一画质下再结合 codec 偏好选取具体视频轨。
- 这说明安卓参考项目的顺序是：
  - 先选画质
  - 再选解码格式
  - 最后重建播放器数据源

### Source 8: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\widgets\header_control.dart`
- 画质面板直接读取 `supportFormats` 渲染完整画质清单。
- 被灰掉的画质仍会展示，并给出“可能需要会员、4K/杜比视界效果可能不佳”的提示。
- 这对 TV 端很重要，因为它能区分“接口知道有这个档位”和“当前账号/设备/视频暂时拿不到”。

## Android 参考项目关于“正在关注 / 订阅剧集”的实现

### Source 9: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\dynamics.dart`
- `followUp()` 请求 `/x/polymer/web-dynamic/v1/portal`，返回 `up_list` 与 `live_users`，更像“关注对象与更新概览”。
- `followDynamic()` 请求 `/x/polymer/web-dynamic/v1/feed/all`，拿的是实际动态流内容。
- 这说明“正在关注”不是单一接口能完全解决的，至少要区分“关注对象概览”和“动态内容流”两层。

### Source 10: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\models\dynamics\up.dart`
- `FollowUpModel` 只承接 `up_list` 和 `live_users`，并记录 `has_update`、`offset` 等增量信息。
- 也就是说，`portal` 这条接口更适合做首页头部提示或横向头像条，不适合直接替代完整内容流。

### Source 11: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\fav.dart`
- `FavHttp.favPgc()` 请求 `/x/space/bangumi/follow/list`。
- 关键参数包括：
  - `vmid`
  - `type`
  - `follow_status`
  - `pn`
- 其中 `type=1` 对应番剧，`type=2` 对应影视。

### Source 12: `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\pgc\controller.dart` 与 `lib\pages\pgc\view.dart`
- `PgcController.queryPgcFollow()` 在登录后拉取“我的订阅”。
- `PgcPage` 会在推荐内容之前插入登录态可见的“最近追番 / 最近追剧”横向列表，并提供刷新与“查看全部”。
- 这与用户截图中“登录后多出订阅类频道”的产品感觉是高度一致的，只是 PiliPlus 把它落在 PGC 页而不是首页统一频道条里。

## 结论整理

### 关于 `1080P / 4K / HDR` 是否能拿到
- `1080P / 4K`：从接口层面看，完全有机会拿到，前提是账号、视频权限与真实设备链路满足条件。当前 WebOS 仓库的问题不是完全拿不到，而是默认只按 `qn=80` 请求，且没有把画质切换能力接到 UI。
- `HDR / 杜比视界 / HDR Vivid`：安卓参考项目在“质量枚举”和“音轨解析”层已经承认这些能力，但当前 WebOS 仓库还没把这些高级档位的元信息完整接住，更没有完成真实 TV 上的播放验证，因此不能直接承诺首轮可播。

### 关于首页入口应该怎么设计
- `正在关注` 适合做首页登录态二级频道，但首版应优先展示“可播放的关注更新”，而不是完整复刻动态社区。
- `订阅剧集` 适合做首页登录态二级频道，底层数据优先复用 `/x/space/bangumi/follow/list`，并在 UI 上统一成“订阅剧集”入口，内部再细分番剧 / 影视。
- 不建议把这两项直接塞进左侧一级导航；更适合保持左侧导航克制，把它们作为首页内的内容频道。

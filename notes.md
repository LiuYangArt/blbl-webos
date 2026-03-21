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

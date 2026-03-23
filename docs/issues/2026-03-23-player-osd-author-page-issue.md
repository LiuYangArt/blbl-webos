# 播放器 OSD 新增 UP 主页入口，并支持查看作者视频列表

## 背景

当前播放器底部 OSD 已经具备分 P、字幕、设置、推荐视频等能力，但还缺少一个从“正在播放”继续跳转到“作者其他视频”的浏览入口。  
这会让用户在 TV 端观看时出现明显断层：

- 想继续看这个作者的内容
- 但播放器里没有直接入口
- 只能退出后重新搜索或从相关推荐绕路

## 需求目标

在播放器底部 OSD 新增一个 `UP主页` 按钮。  
用户点击后进入视频作者页面，页面中展示作者基础资料和视频列表，并支持继续打开作者的其他视频。

## 方案文档

详细方案见：

- `docs/plans/2026-03-23-player-osd-author-page-plan.md`

安卓参考调研来源包括：

- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\view.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\member\view.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\video\member\controller.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\pages\member\view.dart`
- `F:\CodeProjects\bilibili_tv_android\PiliPlus\lib\http\member.dart`

## 推荐实现范围

### 1. 播放器 OSD 入口

- 在 `PlayerControlBar` 新增 `UP主页` 按钮
- 按钮位置放在 `分P / 选集` 与 `推荐视频` 之间
- 作者信息缺失时保持可聚焦但禁用视觉态，并给出提示

### 2. 新增作者页路由

- 新增独立 `author-space` 页面
- 从播放器点击按钮后进入该页面
- 返回键可回到上一页播放器

### 3. 作者页内容

- 顶部展示作者头像、昵称、签名、关注/粉丝等基础信息
- 下方展示作者投稿视频列表
- 支持 `最新发布 / 最多播放` 排序切换
- 支持分页加载更多
- 点击视频后继续进入对应播放器页

### 4. API 与数据

- 新增作者资料接口
- 新增作者统计接口
- 新增作者视频分页接口
- 继续沿用当前仓库的 web API + `signWbi` 基线

## 明确不做

- 播放器内作者抽屉
- 完整 UP 空间多 tab
- 关注/取关
- 粉丝页、动态页、收藏页
- 播放器后台保活

## 验收标准

1. 播放器普通 OSD 中能看到新的 `UP主页` 按钮。
2. 点击后可进入作者页。
3. 作者页能显示作者基础信息。
4. 作者页能显示作者视频列表，并支持继续加载更多。
5. 作者页支持 `最新发布 / 最多播放` 排序。
6. 点击作者视频可以继续进入播放器。
7. 返回键可以从作者页回到上一页播放器。
8. 焦点流稳定，主操作都可被遥控器聚焦。

## 验证要求

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

## 风险提示

- 作者空间接口需要确认 WBI 签名与游客态可用性。
- 当前页面栈不是 keep-alive，返回播放器会重新挂载播放器页，只保证按现有进度恢复逻辑返回，不承诺后台连续播放。

import { TV_ICONS } from './iconRegistry';
import type { TvIconName } from './iconRegistry';
import type { VideoCardItem } from '../services/api/types';

export type AppRoute =
  | { name: 'home' }
  | { name: 'ui-debug' }
  | { name: 'following' }
  | { name: 'subscriptions' }
  | { name: 'hot' }
  | { name: 'search' }
  | { name: 'search-results'; keyword: string }
  | { name: 'video-detail'; bvid: string; title?: string }
  | { name: 'pgc-detail'; seasonId: number; title?: string }
  | { name: 'player'; bvid: string; cid: number; title: string; part?: string }
  | { name: 'history' }
  | { name: 'login' }
  | { name: 'profile' }
  | { name: 'later' }
  | { name: 'favorites' };

export type RootNavKey =
  | 'home'
  | 'following'
  | 'subscriptions'
  | 'hot'
  | 'search'
  | 'history'
  | 'later'
  | 'favorites'
  | 'profile'
  | 'login';

export const ROOT_NAV_ITEMS: Array<{
  key: RootNavKey;
  icon: TvIconName;
  label: string;
  route: AppRoute;
}> = [
  { key: 'home', icon: TV_ICONS.navHome, label: '首页', route: { name: 'home' } },
  { key: 'following', icon: TV_ICONS.navFollowing, label: '关注', route: { name: 'following' } },
  { key: 'subscriptions', icon: TV_ICONS.navSubscriptions, label: '订阅', route: { name: 'subscriptions' } },
  { key: 'hot', icon: TV_ICONS.navHot, label: '热门', route: { name: 'hot' } },
  { key: 'search', icon: TV_ICONS.navSearch, label: '搜索', route: { name: 'search' } },
  { key: 'history', icon: TV_ICONS.navHistory, label: '历史', route: { name: 'history' } },
  { key: 'later', icon: TV_ICONS.navLater, label: '稍后', route: { name: 'later' } },
  { key: 'favorites', icon: TV_ICONS.navFavorites, label: '收藏', route: { name: 'favorites' } },
  { key: 'profile', icon: TV_ICONS.navProfile, label: '我的', route: { name: 'profile' } },
  { key: 'login', icon: TV_ICONS.navLogin, label: '登录', route: { name: 'login' } },
];

export function getActiveNav(route: AppRoute, isLoggedIn: boolean): RootNavKey | null {
  switch (route.name) {
    case 'home':
      return 'home';
    case 'ui-debug':
      return null;
    case 'following':
      return 'following';
    case 'subscriptions':
      return 'subscriptions';
    case 'hot':
      return 'hot';
    case 'search':
    case 'search-results':
      return 'search';
    case 'history':
      return 'history';
    case 'later':
      return 'later';
    case 'favorites':
      return 'favorites';
    case 'profile':
      return 'profile';
    case 'login':
      return 'login';
    case 'video-detail':
      return isLoggedIn ? 'following' : null;
    case 'pgc-detail':
      return isLoggedIn ? 'subscriptions' : null;
    case 'player':
      return null;
  }
}

export type DetailRoutePayload = Pick<VideoCardItem, 'bvid' | 'title'>;
export type PlayerRoutePayload = Pick<VideoCardItem, 'bvid' | 'cid' | 'title'> & {
  part?: string;
};
export type PgcDetailRoutePayload = {
  seasonId: number;
  title: string;
};

import type { FavoriteFolder, VideoCardItem } from '../services/api/types';

export type AppRoute =
  | { name: 'home' }
  | { name: 'hot' }
  | { name: 'search' }
  | { name: 'search-results'; keyword: string }
  | { name: 'video-detail'; bvid: string; title?: string }
  | { name: 'player'; bvid: string; cid: number; title: string; part?: string }
  | { name: 'history' }
  | { name: 'login' }
  | { name: 'profile' }
  | { name: 'later' }
  | { name: 'favorites' }
  | { name: 'favorite-detail'; mediaId: number; title: string };

export type RootNavKey =
  | 'home'
  | 'hot'
  | 'search'
  | 'history'
  | 'later'
  | 'favorites'
  | 'profile'
  | 'login';

export const ROOT_NAV_ITEMS: Array<{
  key: RootNavKey;
  shortLabel: string;
  label: string;
  route: AppRoute;
}> = [
  { key: 'home', shortLabel: 'HM', label: '首页', route: { name: 'home' } },
  { key: 'hot', shortLabel: 'HT', label: '热门', route: { name: 'hot' } },
  { key: 'search', shortLabel: 'SR', label: '搜索', route: { name: 'search' } },
  { key: 'history', shortLabel: 'HS', label: '历史', route: { name: 'history' } },
  { key: 'later', shortLabel: 'LT', label: '稍后', route: { name: 'later' } },
  { key: 'favorites', shortLabel: 'FV', label: '收藏', route: { name: 'favorites' } },
  { key: 'profile', shortLabel: 'ME', label: '我的', route: { name: 'profile' } },
  { key: 'login', shortLabel: 'LG', label: '登录', route: { name: 'login' } },
];

export function getActiveNav(route: AppRoute, isLoggedIn: boolean): RootNavKey | null {
  switch (route.name) {
    case 'home':
      return 'home';
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
    case 'favorite-detail':
      return 'favorites';
    case 'profile':
      return 'profile';
    case 'login':
      return 'login';
    case 'video-detail':
    case 'player':
      return isLoggedIn ? 'profile' : null;
  }
}

export type DetailRoutePayload = Pick<VideoCardItem, 'bvid' | 'title'>;
export type FavoriteRoutePayload = Pick<FavoriteFolder, 'id' | 'title'>;

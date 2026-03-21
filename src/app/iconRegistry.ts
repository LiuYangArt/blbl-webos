import type { MaterialSymbol } from 'material-symbols';

export const TV_ICONS = {
  navHome: 'home',
  navHot: 'local_fire_department',
  navSearch: 'search',
  navHistory: 'history',
  navLater: 'schedule',
  navFavorites: 'favorite',
  navProfile: 'account_circle',
  navLogin: 'login',
  playerBack: 'arrow_back',
  playerReplay10: 'replay_10',
  playerPlay: 'play_arrow',
  playerPause: 'pause',
  playerForward10: 'forward_10',
  playerRefresh: 'refresh',
  playerSettings: 'tune',
} as const satisfies Record<string, MaterialSymbol>;

export type TvIconName = (typeof TV_ICONS)[keyof typeof TV_ICONS];

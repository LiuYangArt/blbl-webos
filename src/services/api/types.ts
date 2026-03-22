export type ApiEnvelope<T> = {
  code: number;
  message: string;
  ttl?: number;
  data: T;
};

export type VideoCardItem = {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  cover: string;
  duration: number;
  ownerName: string;
  ownerFace?: string;
  playCount: number;
  danmakuCount: number;
  likeCount?: number;
  description?: string;
  reason?: string;
  publishAt?: number;
  badge?: string;
  typeName?: string;
};

export type VideoPart = {
  cid: number;
  page: number;
  part: string;
  duration: number;
};

export type VideoDetail = {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  cover: string;
  description: string;
  duration: number;
  owner: {
    mid: number;
    name: string;
    face: string;
  };
  stats: {
    playCount: number;
    danmakuCount: number;
    favoriteCount: number;
    likeCount: number;
    replyCount: number;
    coinCount: number;
    shareCount: number;
  };
  parts: VideoPart[];
  publishAt: number;
  typeName: string;
};

export type SearchDefaultWord = {
  keyword: string;
  showName: string;
};

export type HotKeyword = {
  keyword: string;
  showName: string;
  heatLayer: string;
  icon?: string;
};

export type VideoCodecPreference = 'auto' | 'avc' | 'hevc' | 'av1';

export type ParsedVideoCodec = 'avc' | 'hevc' | 'av1' | 'unknown';

export type HomeChannelKey =
  | 'personalized'
  | 'following'
  | 'subscriptions'
  | 'hot'
  | 'ranking'
  | 'live';

export type FollowUpAccount = {
  mid: number;
  name: string;
  face: string;
  hasUpdate: boolean;
};

export type FollowFeedItem = {
  id: string;
  bvid: string;
  title: string;
  cover: string;
  ownerName: string;
  duration: number;
  description: string;
  publishedAt: number;
  reason?: string;
};

export type FollowingChannelData = {
  accounts: FollowUpAccount[];
  items: FollowFeedItem[];
};

export type PgcSeasonKind = 'anime' | 'cinema';

export type PgcSubscriptionItem = {
  seasonId: number;
  title: string;
  cover: string;
  badge: string;
  subtitle: string;
  progress: string;
  seasonTypeLabel: string;
  seasonKind: PgcSeasonKind;
  latestEpisodeId: number | null;
  latestEpisodeLabel: string;
  latestEpisodeTitle: string;
  latestEpisodeCover: string;
  latestEpisodeDuration: number;
  url: string;
};

export type PgcEpisode = {
  id: number;
  cid: number;
  bvid: string;
  title: string;
  longTitle: string;
  cover: string;
  duration: number;
  badge: string;
  isPlayable: boolean;
};

export type PgcSeasonDetail = {
  seasonId: number;
  title: string;
  cover: string;
  evaluate: string;
  subtitle: string;
  badge: string;
  typeName: string;
  newestEpisodeLabel: string;
  episodes: PgcEpisode[];
};

export type PlayDashSegmentBase = {
  initialization: string;
  indexRange: string;
};

export type PlayAudioKind = 'aac' | 'dolby' | 'flac' | 'unknown';

export type PlayQualityTier =
  | '360p'
  | '480p'
  | '720p'
  | '1080p'
  | '1080p-plus'
  | '4k'
  | 'hdr'
  | 'dolby-vision'
  | '8k'
  | 'hdr-vivid'
  | 'unknown';

export type PlayVideoStream = {
  id: number;
  quality: number;
  qualityLabel: string;
  codec: ParsedVideoCodec;
  codecs: string;
  url: string;
  backupUrls: string[];
  mimeType: string;
  segmentBase: PlayDashSegmentBase | null;
  width: number;
  height: number;
  bandwidth: number;
  frameRate: number;
};

export type PlayAudioStream = {
  id: number;
  url: string;
  backupUrls: string[];
  mimeType: string;
  segmentBase: PlayDashSegmentBase | null;
  bandwidth: number;
  codecs: string;
  kind: PlayAudioKind;
  label: string;
};

export type PlayQualityOption = {
  qn: number;
  label: string;
  limitReason: number;
  codecs: ParsedVideoCodec[];
  tier: PlayQualityTier;
  badge?: string;
};

export type PlayCompatibleSource = {
  quality: number;
  qualityLabel: string;
  format: string;
  url: string;
  candidateUrls: string[];
};

export type PlaySource = {
  mode: 'dash' | 'durl';
  qualityLabel: string;
  currentQuality: number;
  requestedQuality: number;
  requestedQualityLabel: string;
  qualityLimitReason: number;
  durationMs: number;
  qualities: PlayQualityOption[];
  videoStreams: PlayVideoStream[];
  audioStreams: PlayAudioStream[];
  compatibleSources: PlayCompatibleSource[];
  candidateUrls: string[];
};

export type UserProfile = {
  mid: number;
  name: string;
  face: string;
  sign: string;
  coin: number;
  level: number;
  vipLabel: string | null;
  following: number;
  follower: number;
};

export type HistoryItem = {
  kid: string;
  title: string;
  bvid: string;
  cid: number;
  cover: string;
  author: string;
  duration: number;
  progress: number;
  viewAt: number;
  part?: string;
};

export type LaterItem = {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  cover: string;
  author: string;
  duration: number;
};

export type FavoriteFolder = {
  id: number;
  title: string;
  mediaCount: number;
  cover: string;
  intro: string;
};

export type FavoriteItem = {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  cover: string;
  author: string;
  duration: number;
  description: string;
};

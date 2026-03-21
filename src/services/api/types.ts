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

export type PlayVideoStream = {
  id: number;
  quality: number;
  qualityLabel: string;
  codec: ParsedVideoCodec;
  codecs: string;
  url: string;
  backupUrls: string[];
  width: number;
  height: number;
  bandwidth: number;
  frameRate: number;
};

export type PlayAudioStream = {
  id: number;
  url: string;
  backupUrls: string[];
  bandwidth: number;
  codecs: string;
};

export type PlayQualityOption = {
  qn: number;
  label: string;
  limitReason: number;
  codecs: ParsedVideoCodec[];
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

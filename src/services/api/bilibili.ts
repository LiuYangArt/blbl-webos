import {
  fetchJson,
  getBiliApiUrl,
  getBiliPassportUrl,
  getBiliSearchUrl,
  unwrapData,
} from './http';
import { signWbi } from './wbi';
import { appendRuntimeDiagnostic } from '../debug/runtimeDiagnostics';
import type {
  ApiEnvelope,
  FavoriteFolder,
  FavoriteItem,
  FollowingChannelData,
  FollowingFeedPage,
  FollowFeedItem,
  FollowUpAccount,
  HistoryPage,
  HotKeyword,
  LaterItem,
  ParsedVideoCodec,
  PgcEpisode,
  PgcSeasonDetail,
  PgcSeasonKind,
  PgcSubscriptionItem,
  PlayAudioStream,
  PlayAudioKind,
  PlayCompatibleSource,
  PlayInfo,
  PlayQualityOption,
  PlayQualityTier,
  PlayRequestTrace,
  PlaySource,
  PlaySubtitleTrack,
  PlayVideoStream,
  SearchDefaultWord,
  UserProfile,
  VideoCardItem,
  VideoDetail,
  VideoPart,
} from './types';

type Numeric = number | string;

type RawOwner = {
  mid?: Numeric;
  name?: string;
  face?: string;
};

type RawVideoStats = {
  view?: Numeric;
  danmaku?: Numeric;
  favorite?: Numeric;
  like?: Numeric;
  reply?: Numeric;
  coin?: Numeric;
  share?: Numeric;
};

type RawVideoPart = {
  cid?: Numeric;
  page?: Numeric;
  part?: string;
  duration?: Numeric;
};

type RawVideoCard = {
  aid?: Numeric;
  id?: Numeric;
  bvid?: string;
  cid?: Numeric;
  first_cid?: Numeric;
  title?: string;
  pic?: string;
  cover?: string;
  duration?: Numeric | string;
  owner?: RawOwner;
  author?: string;
  play?: Numeric;
  danmaku?: Numeric;
  video_review?: Numeric;
  like?: Numeric;
  stat?: RawVideoStats;
  desc?: string;
  description?: string;
  rcmd_reason?: {
    content?: string;
  };
  reason?: string;
  pubdate?: Numeric;
  senddate?: Numeric;
  badge?: string;
  tname?: string;
  typename?: string;
  goto?: string;
};

type RawVideoDetail = {
  aid?: Numeric;
  bvid?: string;
  cid?: Numeric;
  title?: string;
  pic?: string;
  desc?: string;
  duration?: Numeric;
  owner?: RawOwner;
  stat?: RawVideoStats;
  pages?: RawVideoPart[];
  pubdate?: Numeric;
  tname?: string;
};

type RawPlaySegment = {
  url?: string;
  backup_url?: string[];
};

type RawDashStream = {
  id?: Numeric;
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string[];
  backup_url?: string[];
  mime_type?: string;
  codecs?: string;
  segment_base?: {
    Initialization?: string;
    initialization?: string;
    indexRange?: string;
    index_range?: string;
  };
  segmentBase?: {
    Initialization?: string;
    initialization?: string;
    indexRange?: string;
    index_range?: string;
  };
  width?: Numeric;
  height?: Numeric;
  bandwidth?: Numeric;
  frame_rate?: string;
};

type RawPlaySource = {
  durl?: RawPlaySegment[];
  accept_quality?: number[];
  quality?: number;
  accept_description?: string[];
  format?: string;
  timelength?: Numeric;
  support_formats?: Array<{
    quality?: Numeric;
    new_description?: string;
    display_desc?: string;
    superscript?: string;
    format?: string;
    codecs?: string[];
    can_watch_qn_reason?: Numeric;
    limit_watch_reason?: Numeric;
  }>;
  dash?: {
    video?: RawDashStream[];
    audio?: RawDashStream[];
    dolby?: {
      type?: Numeric;
      audio?: RawDashStream | RawDashStream[] | null;
    };
    flac?: {
      audio?: RawDashStream | null;
    };
  };
};

type RawPlaySubtitleTrack = {
  id?: Numeric;
  lan?: string;
  lan_doc?: string;
  subtitle_url?: string;
  subtitle_url_v2?: string;
  type?: Numeric;
};

type RawPlayInfo = {
  subtitle?: {
    subtitles?: RawPlaySubtitleTrack[];
  };
};

type RawNavData = {
  mid?: Numeric;
  uname?: string;
  face?: string;
  sign?: string;
  money?: Numeric;
  level_info?: {
    current_level?: Numeric;
  };
  vip_label?: {
    text?: string;
  };
};

type RawNavStatData = {
  following?: Numeric;
  follower?: Numeric;
};

type RawHistoryEntry = {
  oid?: Numeric;
  bvid?: string;
  cid?: Numeric;
  part?: string;
};

type RawHistoryItem = {
  kid?: string;
  title?: string;
  history?: RawHistoryEntry;
  bvid?: string;
  cid?: Numeric;
  cover?: string;
  pic?: string;
  author_name?: string;
  author?: string;
  duration?: Numeric;
  progress?: Numeric;
  view_at?: Numeric;
};

type RawLaterItem = {
  aid?: Numeric;
  bvid?: string;
  cid?: Numeric;
  title?: string;
  pic?: string;
  cover?: string;
  owner?: RawOwner;
  author?: string;
  duration?: Numeric;
  pages?: Array<{ cid?: Numeric }>;
};

type RawFavoriteFolder = {
  id?: Numeric;
  media_id?: Numeric;
  title?: string;
  media_count?: Numeric;
  count?: Numeric;
  cover?: string;
  intro?: string;
};

type RawFavoriteItem = {
  id?: Numeric;
  aid?: Numeric;
  bvid?: string;
  first_cid?: Numeric;
  cid?: Numeric;
  title?: string;
  cover?: string;
  upper?: {
    name?: string;
  };
  author?: string;
  duration?: Numeric;
  intro?: string;
};

type RawFollowingPortal = {
  up_list?: {
    items?: Array<{
      mid?: Numeric;
      uname?: string;
      face?: string;
      has_update?: boolean;
    }>;
  };
};

type RawDynamicArchive = {
  bvid?: string;
  cover?: string;
  title?: string;
  desc?: string;
  duration_text?: string;
};

type RawDynamicFeedItem = {
  id_str?: string;
  type?: string;
  modules?: {
    module_author?: {
      name?: string;
      pub_ts?: Numeric;
    };
    module_dynamic?: {
      desc?: {
        text?: string;
      };
      major?: {
        archive?: RawDynamicArchive;
      };
    };
  };
};

type RawDynamicFeedResponse = {
  items?: RawDynamicFeedItem[];
  offset?: string;
  has_more?: boolean;
};

type RawPgcSubscriptionItem = {
  season_id?: Numeric;
  season_type?: Numeric;
  season_type_name?: string;
  title?: string;
  cover?: string;
  horizontal_cover_16_9?: string;
  badge?: string;
  progress?: string;
  subtitle_25?: string;
  subtitle?: string;
  url?: string;
  new_ep?: {
    id?: Numeric;
    index_show?: string;
    title?: string;
    long_title?: string;
    cover?: string;
    duration?: Numeric;
  };
};

type RawPgcEpisode = {
  id?: Numeric;
  cid?: Numeric;
  bvid?: string;
  title?: string;
  long_title?: string;
  cover?: string;
  duration?: Numeric;
  badge?: string;
  status?: Numeric;
};

type RawPgcSeasonDetail = {
  season_id?: Numeric;
  title?: string;
  cover?: string;
  evaluate?: string;
  badge?: string;
  share_sub_title?: string;
  subtitle?: string;
  type_name?: string;
  newest_ep?: {
    desc?: string;
  };
  episodes?: RawPgcEpisode[];
};

function normalizeCover(url: string) {
  if (!url) {
    return '';
  }
  if (url.startsWith('http://')) {
    return `https://${url.slice('http://'.length)}`;
  }
  return url.startsWith('//') ? `https:${url}` : url;
}

function normalizeMediaUrl(url: string) {
  if (!url) {
    return '';
  }
  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}

function getPlayCandidateUrls(segment: RawPlaySegment | undefined) {
  const rawCandidates = [
    segment?.url,
    ...(segment?.backup_url ?? []),
  ]
    .filter((item): item is string => Boolean(item))
    .map(normalizeMediaUrl);
  return sortCompatibleCandidateUrls(Array.from(new Set(rawCandidates)));
}

function getDashCandidateUrls(stream: RawDashStream | undefined) {
  const rawCandidates = [
    stream?.baseUrl,
    stream?.base_url,
    ...(stream?.backupUrl ?? []),
    ...(stream?.backup_url ?? []),
  ]
    .filter((item): item is string => Boolean(item))
    .map(normalizeMediaUrl);
  return sortMediaCandidateUrls(Array.from(new Set(rawCandidates)));
}

function sortMediaCandidateUrls(urls: string[]) {
  return [...urls].sort((left, right) => getMediaCandidateScore(right) - getMediaCandidateScore(left));
}

function sortCompatibleCandidateUrls(urls: string[]) {
  return [...urls].sort((left, right) => getCompatibleMediaCandidateScore(right) - getCompatibleMediaCandidateScore(left));
}

function getMediaCandidateScore(url: string) {
  try {
    const host = new URL(url).host.toLowerCase();
    let score = 0;
    if (host.includes('.bilivideo.com') || host.includes('.bilivideo.cn')) {
      score += 20;
    }
    if (host.includes('upos-')) {
      score += 8;
    }
    if (host.startsWith('cn-')) {
      score += 6;
    }
    if (host.includes('mcdn')) {
      score -= 20;
    }
    if (host.includes(':8082')) {
      score -= 4;
    }
    return score;
  } catch {
    return 0;
  }
}

function getCompatibleMediaCandidateScore(url: string) {
  let score = getMediaCandidateScore(url);

  try {
    const parsedUrl = new URL(url);
    const platform = parsedUrl.searchParams.get('platform');
    const highQuality = parsedUrl.searchParams.get('high_quality');
    const formatHint = parsedUrl.searchParams.get('f');

    if (platform === 'html5') {
      score += 24;
    } else if (platform === 'pc') {
      score -= 6;
    }

    if (highQuality === '1') {
      score += 8;
    }

    if (formatHint?.startsWith('h_')) {
      score += 6;
    } else if (formatHint?.startsWith('u_')) {
      score -= 2;
    }
  } catch {
    return score;
  }

  return score;
}

function parseVideoCodec(codecs: string | undefined): ParsedVideoCodec {
  const normalized = String(codecs ?? '').trim().toLowerCase();
  if (normalized.startsWith('avc')) {
    return 'avc';
  }
  if (normalized.startsWith('hev') || normalized.startsWith('hvc')) {
    return 'hevc';
  }
  if (normalized.startsWith('av01')) {
    return 'av1';
  }
  return 'unknown';
}

function parseAudioKind(codecs: string | undefined): PlayAudioKind {
  const normalized = String(codecs ?? '').trim().toLowerCase();
  if (normalized.includes('mp4a')) {
    return 'aac';
  }
  if (normalized.includes('ec-3') || normalized.includes('eac3')) {
    return 'dolby';
  }
  if (normalized.includes('flac')) {
    return 'flac';
  }
  return 'unknown';
}

function formatAudioKindLabel(kind: PlayAudioKind, codecs: string | undefined) {
  switch (kind) {
    case 'aac':
      return 'AAC';
    case 'dolby':
      return '杜比音频';
    case 'flac':
      return 'FLAC';
    default:
      return String(codecs ?? '未知音频');
  }
}

function parsePlayQualityTier(qn: number): PlayQualityTier {
  switch (qn) {
    case 129:
      return 'hdr-vivid';
    case 127:
      return '8k';
    case 126:
      return 'dolby-vision';
    case 125:
      return 'hdr';
    case 120:
      return '4k';
    case 112:
      return '1080p-plus';
    case 80:
      return '1080p';
    case 64:
      return '720p';
    case 32:
      return '480p';
    case 16:
      return '360p';
    default:
      return 'unknown';
  }
}

function parseFrameRate(value: string | undefined) {
  if (!value) {
    return 0;
  }
  const normalized = value.trim();
  if (!normalized.includes('/')) {
    return Number(normalized) || 0;
  }
  const [numerator, denominator] = normalized.split('/').map((item) => Number(item));
  if (!numerator || !denominator) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(2));
}

function parseSegmentBase(stream: RawDashStream) {
  const segmentBase = stream.segment_base ?? stream.segmentBase;
  const initialization = String(segmentBase?.Initialization ?? segmentBase?.initialization ?? '').trim();
  const indexRange = String(segmentBase?.indexRange ?? segmentBase?.index_range ?? '').trim();

  if (!initialization || !indexRange) {
    return null;
  }

  return {
    initialization,
    indexRange,
  };
}

function buildPlayQualities(data: RawPlaySource): PlayQualityOption[] {
  const supportFormats = data.support_formats ?? [];
  if (supportFormats.length > 0) {
    return supportFormats.map((item) => ({
      qn: Number(item.quality ?? 0),
      label: String(item.new_description ?? item.display_desc ?? item.format ?? `${item.quality ?? 0}P`),
      limitReason: Number(item.limit_watch_reason ?? item.can_watch_qn_reason ?? 0),
      codecs: Array.from(new Set((item.codecs ?? []).map(parseVideoCodec).filter((codec) => codec !== 'unknown'))),
      tier: parsePlayQualityTier(Number(item.quality ?? 0)),
      badge: item.superscript ? String(item.superscript) : undefined,
    }));
  }

  return (data.accept_quality ?? []).map((quality, index) => ({
    qn: quality,
    label: String(data.accept_description?.[index] ?? `${quality}P`),
    limitReason: 0,
    codecs: [],
    tier: parsePlayQualityTier(quality),
  }));
}

function buildVideoStreams(data: RawPlaySource, qualities: PlayQualityOption[]): PlayVideoStream[] {
  const qualityLabelMap = new Map(qualities.map((item) => [item.qn, item.label]));
  return (data.dash?.video ?? []).map((stream) => {
    const urls = getDashCandidateUrls(stream);
    return {
      id: Number(stream.id ?? 0),
      quality: Number(stream.id ?? 0),
      qualityLabel: String(qualityLabelMap.get(Number(stream.id ?? 0)) ?? `${stream.id ?? 0}P`),
      codec: parseVideoCodec(stream.codecs),
      codecs: String(stream.codecs ?? ''),
      url: urls[0] ?? '',
      backupUrls: urls.slice(1),
      mimeType: String(stream.mime_type ?? 'video/mp4'),
      segmentBase: parseSegmentBase(stream),
      width: Number(stream.width ?? 0),
      height: Number(stream.height ?? 0),
      bandwidth: Number(stream.bandwidth ?? 0),
      frameRate: parseFrameRate(stream.frame_rate),
    };
  }).filter((stream) => Boolean(stream.url));
}

function buildAudioStreams(data: RawPlaySource): PlayAudioStream[] {
  const dolbyAudio = data.dash?.dolby?.audio;
  const flacAudio = data.dash?.flac?.audio;
  const rawStreams = [
    ...(data.dash?.audio ?? []),
    ...(Array.isArray(dolbyAudio)
      ? dolbyAudio
      : dolbyAudio
        ? [dolbyAudio]
        : []),
    ...(flacAudio ? [flacAudio] : []),
  ];

  return rawStreams.map((stream) => {
    const urls = getDashCandidateUrls(stream);
    const kind = parseAudioKind(stream.codecs);
    return {
      id: Number(stream.id ?? 0),
      url: urls[0] ?? '',
      backupUrls: urls.slice(1),
      mimeType: String(stream.mime_type ?? 'audio/mp4'),
      segmentBase: parseSegmentBase(stream),
      bandwidth: Number(stream.bandwidth ?? 0),
      codecs: String(stream.codecs ?? ''),
      kind,
      label: formatAudioKindLabel(kind, stream.codecs),
    };
  }).filter((stream) => Boolean(stream.url));
}

function pickQualityLabel(qualities: PlayQualityOption[], quality: number, fallback?: string) {
  return String(qualities.find((item) => item.qn === quality)?.label ?? fallback ?? `${quality}P`);
}

function parseDuration(value: string | number | undefined) {
  if (typeof value === 'number') {
    return value;
  }
  if (!value) {
    return 0;
  }
  const parts = value.split(':').map((item) => Number(item));
  if (parts.some(Number.isNaN)) {
    return 0;
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function mapVideoCard(item: RawVideoCard): VideoCardItem {
  return {
    aid: Number(item.aid ?? item.id ?? 0),
    bvid: String(item.bvid ?? ''),
    cid: Number(item.cid ?? item.first_cid ?? 0),
    title: String(item.title ?? '').replace(/<[^>]+>/g, ''),
    cover: normalizeCover(String(item.pic ?? item.cover ?? '')),
    duration: parseDuration(item.duration),
    ownerName: String(item.owner?.name ?? item.author ?? ''),
    ownerFace: normalizeCover(String(item.owner?.face ?? '')),
    playCount: Number(item.stat?.view ?? item.play ?? 0),
    danmakuCount: Number(item.stat?.danmaku ?? item.danmaku ?? item.video_review ?? 0),
    likeCount: Number(item.stat?.like ?? item.like ?? 0),
    description: String(item.desc ?? item.description ?? ''),
    reason: String(item.rcmd_reason?.content ?? item.reason ?? ''),
    publishAt: Number(item.pubdate ?? item.senddate ?? 0),
    badge: String(item.badge ?? ''),
    typeName: String(item.tname ?? item.typename ?? ''),
  };
}

function mapVideoParts(rawParts: RawVideoPart[] | undefined): VideoPart[] {
  if (!rawParts?.length) {
    return [];
  }
  return rawParts.map((item) => ({
    cid: Number(item.cid ?? 0),
    page: Number(item.page ?? 1),
    part: String(item.part ?? `P${item.page ?? 1}`),
    duration: Number(item.duration ?? 0),
  }));
}

function mapFollowUpAccount(item: {
  mid?: Numeric;
  uname?: string;
  face?: string;
  has_update?: boolean;
}): FollowUpAccount {
  return {
    mid: Number(item.mid ?? 0),
    name: String(item.uname ?? ''),
    face: normalizeCover(String(item.face ?? '')),
    hasUpdate: Boolean(item.has_update),
  };
}

function mapDynamicFeedItem(item: RawDynamicFeedItem): FollowFeedItem | null {
  const archive = item.modules?.module_dynamic?.major?.archive;
  if (!archive?.bvid || !archive.cover || !archive.title) {
    return null;
  }

  return {
    id: String(item.id_str ?? archive.bvid),
    bvid: String(archive.bvid),
    title: String(archive.title),
    cover: normalizeCover(String(archive.cover)),
    ownerName: String(item.modules?.module_author?.name ?? ''),
    duration: parseDuration(String(archive.duration_text ?? '')),
    description: String(archive.desc ?? item.modules?.module_dynamic?.desc?.text ?? ''),
    publishedAt: Number(item.modules?.module_author?.pub_ts ?? 0),
    reason: '关注更新',
  };
}

function mapDynamicFeedItems(items: RawDynamicFeedItem[] | undefined, limit = Number.POSITIVE_INFINITY): FollowFeedItem[] {
  return (items ?? [])
    .map(mapDynamicFeedItem)
    .filter((item): item is FollowFeedItem => Boolean(item))
    .slice(0, limit);
}

function resolvePgcSeasonKind(seasonType: number): PgcSeasonKind {
  return seasonType === 2 ? 'cinema' : 'anime';
}

function mapPgcSubscriptionItem(item: RawPgcSubscriptionItem): PgcSubscriptionItem {
  const seasonType = Number(item.season_type ?? 1);
  const latestEpisodeCover = normalizeCover(String(item.new_ep?.cover ?? item.horizontal_cover_16_9 ?? item.cover ?? ''));
  return {
    seasonId: Number(item.season_id ?? 0),
    title: String(item.title ?? ''),
    cover: normalizeCover(String(item.horizontal_cover_16_9 ?? item.cover ?? '')),
    badge: String(item.badge ?? ''),
    subtitle: String(item.subtitle_25 ?? item.subtitle ?? item.season_type_name ?? ''),
    progress: String(item.progress ?? item.new_ep?.index_show ?? ''),
    seasonTypeLabel: String(item.season_type_name ?? (seasonType === 2 ? '影视' : '番剧')),
    seasonKind: resolvePgcSeasonKind(seasonType),
    latestEpisodeId: item.new_ep?.id ? Number(item.new_ep.id) : null,
    latestEpisodeLabel: String(item.new_ep?.index_show ?? ''),
    latestEpisodeTitle: String(item.new_ep?.title ?? item.new_ep?.long_title ?? item.title ?? ''),
    latestEpisodeCover,
    latestEpisodeDuration: Number(item.new_ep?.duration ?? 0),
    url: String(item.url ?? ''),
  };
}

function mapPgcEpisode(item: RawPgcEpisode): PgcEpisode {
  const status = Number(item.status ?? 2);
  return {
    id: Number(item.id ?? 0),
    cid: Number(item.cid ?? 0),
    bvid: String(item.bvid ?? ''),
    title: String(item.title ?? ''),
    longTitle: String(item.long_title ?? ''),
    cover: normalizeCover(String(item.cover ?? '')),
    duration: Number(item.duration ?? 0),
    badge: String(item.badge ?? ''),
    isPlayable: status >= 2 && Boolean(item.bvid) && Boolean(item.cid),
  };
}

export async function fetchRecommendedVideos(pageSize = 12, freshIndex = 1) {
  const params = await signWbi({
    version: 1,
    feed_version: 'V8',
    homepage_ver: 1,
    ps: pageSize,
    fresh_idx: freshIndex,
    brush: freshIndex,
    fresh_type: 4,
  });

  const payload = await fetchJson<ApiEnvelope<{ item: RawVideoCard[] }>>(
    getBiliApiUrl(`/x/web-interface/wbi/index/top/feed/rcmd?${params.toString()}`),
  );
  const data = unwrapData(payload);
  return data.item
    .filter((item) => item.goto === 'av' && item.bvid)
    .map(mapVideoCard);
}

export async function fetchPopularVideos(page = 1, pageSize = 12) {
  const payload = await fetchJson<ApiEnvelope<{ list: RawVideoCard[] }>>(
    getBiliApiUrl(`/x/web-interface/popular?pn=${page}&ps=${pageSize}`),
  );
  return unwrapData(payload).list.map(mapVideoCard);
}

export async function fetchRankingVideos(pageSize = 12) {
  const payload = await fetchJson<ApiEnvelope<{ list: RawVideoCard[] }>>(
    getBiliApiUrl(`/x/web-interface/ranking/v2?rid=0&type=all`),
  );
  return unwrapData(payload).list.slice(0, pageSize).map(mapVideoCard);
}

export async function fetchSearchDefaultWord(): Promise<SearchDefaultWord> {
  const params = await signWbi({});
  const payload = await fetchJson<ApiEnvelope<{ show_name: string; name: string }>>(
    getBiliApiUrl(`/x/web-interface/wbi/search/default?${params.toString()}`),
  );
  const data = unwrapData(payload);
  return {
    keyword: data.name,
    showName: data.show_name,
  };
}

export async function fetchHotKeywords(): Promise<HotKeyword[]> {
  const payload = await fetchJson<{
    code: number;
    exp_str: string;
    list: Array<{ keyword: string; show_name: string; heat_layer: string; icon?: string }>;
  }>(getBiliSearchUrl('/main/hotword'));

  if (payload.code !== 0) {
    throw new Error('热搜请求失败');
  }

  return payload.list.map((item) => ({
    keyword: item.keyword,
    showName: item.show_name,
    heatLayer: item.heat_layer,
    icon: item.icon,
  }));
}

export async function searchVideos(keyword: string, page = 1, pageSize = 20) {
  const params = await signWbi({
    search_type: 'video',
    keyword,
    page,
    page_size: pageSize,
    platform: 'pc',
    web_location: 1430654,
  });

  const payload = await fetchJson<ApiEnvelope<{ result: RawVideoCard[] }>>(
    getBiliApiUrl(`/x/web-interface/wbi/search/type?${params.toString()}`),
  );

  return unwrapData(payload).result.map(mapVideoCard);
}

export async function fetchVideoDetail(bvid: string): Promise<VideoDetail> {
  const payload = await fetchJson<ApiEnvelope<RawVideoDetail>>(
    getBiliApiUrl(`/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`),
  );
  const data = unwrapData(payload);
  return {
    aid: Number(data.aid ?? 0),
    bvid: String(data.bvid ?? bvid),
    cid: Number(data.cid ?? 0),
    title: String(data.title ?? ''),
    cover: normalizeCover(String(data.pic ?? '')),
    description: String(data.desc ?? ''),
    duration: Number(data.duration ?? 0),
    owner: {
      mid: Number(data.owner?.mid ?? 0),
      name: String(data.owner?.name ?? ''),
      face: normalizeCover(String(data.owner?.face ?? '')),
    },
    stats: {
      playCount: Number(data.stat?.view ?? 0),
      danmakuCount: Number(data.stat?.danmaku ?? 0),
      favoriteCount: Number(data.stat?.favorite ?? 0),
      likeCount: Number(data.stat?.like ?? 0),
      replyCount: Number(data.stat?.reply ?? 0),
      coinCount: Number(data.stat?.coin ?? 0),
      shareCount: Number(data.stat?.share ?? 0),
    },
    parts: mapVideoParts(data.pages),
    publishAt: Number(data.pubdate ?? 0),
    typeName: String(data.tname ?? ''),
  };
}

export async function fetchPlayInfo(bvid: string, cid: number): Promise<PlayInfo> {
  const params = await signWbi({
    bvid,
    cid,
  });
  const payload = await fetchJson<ApiEnvelope<RawPlayInfo>>(
    getBiliApiUrl(`/x/player/wbi/v2?${params.toString()}`),
  );
  const data = unwrapData(payload);
  return {
    subtitles: (data.subtitle?.subtitles ?? []).map(mapPlaySubtitleTrack),
  };
}

export async function fetchRelatedVideos(bvid: string) {
  const payload = await fetchJson<ApiEnvelope<RawVideoCard[]>>(
    getBiliApiUrl(`/x/web-interface/archive/related?bvid=${encodeURIComponent(bvid)}`),
  );
  return unwrapData(payload).map(mapVideoCard);
}

export async function fetchFollowingChannelData(limit = 36): Promise<FollowingChannelData> {
  const [portalPayload, feedPayload] = await Promise.all([
    fetchJson<ApiEnvelope<RawFollowingPortal>>(
      getBiliApiUrl('/x/polymer/web-dynamic/v1/portal?up_list_more=1&web_location=333.1365'),
    ),
    fetchJson<ApiEnvelope<RawDynamicFeedResponse>>(
      getBiliApiUrl('/x/polymer/web-dynamic/v1/feed/all?type=video&web_location=333.1365'),
    ),
  ]);

  const portalData = unwrapData(portalPayload);
  const feedData = unwrapData(feedPayload);

  return {
    accounts: (portalData.up_list?.items ?? [])
      .map(mapFollowUpAccount)
      .filter((item) => item.mid > 0)
      .slice(0, 12),
    items: mapDynamicFeedItems(feedData.items, limit),
  };
}

export async function fetchFollowingFeedPage(options?: {
  offset?: string | null;
  limit?: number;
}): Promise<FollowingFeedPage> {
  let currentOffset = options?.offset ?? null;
  const limit = options?.limit ?? 24;

  while (true) {
    const params = new URLSearchParams({
      type: 'video',
      web_location: '333.1365',
    });

    if (currentOffset) {
      params.set('offset', currentOffset);
    }

    appendRuntimeDiagnostic('following-feed', 'api-request', {
      offset: currentOffset,
      limit,
    });

    const payload = await fetchJson<ApiEnvelope<RawDynamicFeedResponse>>(
      getBiliApiUrl(`/x/polymer/web-dynamic/v1/feed/all?${params.toString()}`),
    );
    const data = unwrapData(payload);
    const nextOffset = data.offset ? String(data.offset) : null;
    const hasMore = Boolean(data.has_more) || Boolean(nextOffset);
    const items = mapDynamicFeedItems(data.items, limit);

    appendRuntimeDiagnostic('following-feed', 'api-response', {
      requestOffset: currentOffset,
      nextOffset,
      rawCount: data.items?.length ?? 0,
      mappedCount: items.length,
      hasMore,
      rawHasMore: Boolean(data.has_more),
    });

    if (items.length > 0 || !hasMore || !nextOffset || nextOffset === currentOffset) {
      return {
        items,
        hasMore,
        cursor: nextOffset,
      };
    }

    appendRuntimeDiagnostic('following-feed', 'skip-empty-page', {
      requestOffset: currentOffset,
      nextOffset,
      hasMore,
    });

    currentOffset = nextOffset;
  }
}

export async function fetchPgcSubscriptions(type: PgcSeasonKind, vmid: number, page = 1, pageSize = 24): Promise<PgcSubscriptionItem[]> {
  const typeValue = type === 'cinema' ? 2 : 1;
  const payload = await fetchJson<ApiEnvelope<{ list: RawPgcSubscriptionItem[] }>>(
    getBiliApiUrl(`/x/space/bangumi/follow/list?type=${typeValue}&pn=${page}&ps=${pageSize}&vmid=${vmid}`),
  );
  return (unwrapData(payload).list ?? []).map(mapPgcSubscriptionItem);
}

export async function fetchPgcSeasonDetail(seasonId: number): Promise<PgcSeasonDetail> {
  const payload = await fetchJson<{
    code: number;
    message: string;
    result: RawPgcSeasonDetail;
  }>(
    getBiliApiUrl(`/pgc/view/web/season?season_id=${seasonId}`),
  );
  if (payload.code !== 0) {
    throw new Error(payload.message || 'PGC 详情加载失败');
  }
  const data = payload.result;
  return {
    seasonId: Number(data.season_id ?? seasonId),
    title: String(data.title ?? ''),
    cover: normalizeCover(String(data.cover ?? '')),
    evaluate: String(data.evaluate ?? ''),
    subtitle: String(data.share_sub_title ?? data.subtitle ?? ''),
    badge: String(data.badge ?? ''),
    typeName: String(data.type_name ?? '订阅剧集'),
    newestEpisodeLabel: String(data.newest_ep?.desc ?? ''),
    episodes: (data.episodes ?? []).map(mapPgcEpisode),
  };
}

async function requestPlaySource(
  bvid: string,
  cid: number,
  quality: number,
  fnval: number,
  options?: {
    platform?: 'html5';
    highQuality?: boolean;
    trace?: PlayRequestTrace[];
  },
) {
  options?.trace?.push({
    qn: quality,
    fnval,
    platform: options.platform ?? null,
    highQuality: Boolean(options.highQuality),
  });

  const params = new URLSearchParams({
    bvid,
    cid: String(cid),
    qn: String(quality),
    fnval: String(fnval),
    fnver: '0',
    fourk: '1',
    otype: 'json',
  });

  if (options?.platform) {
    params.set('platform', options.platform);
  }
  if (options?.highQuality) {
    params.set('high_quality', '1');
  }

  const payload = await fetchJson<ApiEnvelope<RawPlaySource>>(
    getBiliApiUrl(`/x/player/playurl?${params.toString()}`),
  );
  return unwrapData(payload);
}

const DASH_FNVAL_CANDIDATES = Array.from(new Set([16 | 64 | 128 | 256 | 1024, 4048, 16]));

const COMPATIBLE_REQUEST_VARIANTS: Array<{
  fnval: number;
  platform?: 'html5';
  highQuality?: boolean;
}> = [
  {
    fnval: 0,
    platform: 'html5',
    highQuality: true,
  },
  {
    fnval: 0,
  },
];

async function requestDashPlaySource(bvid: string, cid: number, quality: number) {
  const requestTrace: PlayRequestTrace[] = [];

  for (const fnval of DASH_FNVAL_CANDIDATES) {
    try {
      const data = await requestPlaySource(bvid, cid, quality, fnval, {
        trace: requestTrace,
      });
      if (data.dash?.video?.length) {
        return {
          data,
          requestTrace,
        };
      }
    } catch {
      // DASH 请求按能力位逐级尝试，单次失败后继续探测下一组参数。
    }
  }

  return {
    data: null,
    requestTrace,
  };
}

async function fetchCompatibleSources(
  bvid: string,
  cid: number,
  qualities: PlayQualityOption[],
  fallbackQuality: number,
) {
  const requestTrace: PlayRequestTrace[] = [];
  const preferredQualities = [fallbackQuality, ...qualities.map((item) => item.qn), 32, 16]
    .filter((item, index, list) => list.indexOf(item) === index)
    .sort((left, right) => right - left);

  const sourceByQuality = new Map<number, PlayCompatibleSource>();

  for (const variant of COMPATIBLE_REQUEST_VARIANTS) {
    for (const quality of preferredQualities) {
      try {
        const data = await requestPlaySource(bvid, cid, quality, variant.fnval, {
          platform: variant.platform,
          highQuality: variant.highQuality,
          trace: requestTrace,
        });
        const candidateUrls = getPlayCandidateUrls(data.durl?.[0]);
        const actualQuality = Number(data.quality ?? quality);
        if (!candidateUrls.length) {
          continue;
        }

        const existing = sourceByQuality.get(actualQuality);
        if (!existing) {
          sourceByQuality.set(actualQuality, {
            quality: actualQuality,
            qualityLabel: pickQualityLabel(qualities, actualQuality, data.format),
            format: String(data.format ?? 'mp4'),
            url: candidateUrls[0],
            candidateUrls,
          });
          continue;
        }

        const mergedCandidateUrls = Array.from(new Set([
          ...existing.candidateUrls,
          ...candidateUrls,
        ]));
        const orderedCandidateUrls = sortCompatibleCandidateUrls(mergedCandidateUrls);
        sourceByQuality.set(actualQuality, {
          ...existing,
          url: orderedCandidateUrls[0] ?? existing.url,
          candidateUrls: orderedCandidateUrls,
        });
      } catch {
        // 兼容流按档位逐级尝试，单档失败不应中断整个播放计划。
      }
    }
  }

  return {
    sources: preferredQualities
      .map((quality) => sourceByQuality.get(quality))
      .filter((item): item is PlayCompatibleSource => Boolean(item)),
    requestTrace,
  };
}

function getQualityLimitReason(qualities: PlayQualityOption[], requestedQuality: number, returnedQuality: number) {
  return Number(
    qualities.find((item) => item.qn === requestedQuality)?.limitReason
    ?? qualities.find((item) => item.qn === returnedQuality)?.limitReason
    ?? 0,
  );
}

function getReturnedDashQuality(data: RawPlaySource, quality: number, videoStreams: PlayVideoStream[]) {
  const qualityFromPayload = Number(data.quality ?? 0);
  if (qualityFromPayload > 0) {
    return qualityFromPayload;
  }

  const highestQuality = videoStreams.reduce(
    (best, stream) => Math.max(best, stream.quality),
    0,
  );

  return highestQuality > 0 ? highestQuality : quality;
}

function describePlayQualityReason(input: {
  mode: 'dash' | 'durl';
  requestedQuality: number;
  requestedQualityLabel: string;
  returnedQuality: number;
  returnedQualityLabel: string;
  compatibleQuality: number | null;
  compatibleQualityLabel: string | null;
  qualityLimitReason: number;
}) {
  if (input.mode === 'durl') {
    if (input.requestedQuality === input.returnedQuality) {
      return `当前直接按 ${input.returnedQualityLabel} 兼容流返回播放源。`;
    }

    if (input.qualityLimitReason) {
      return `已请求 ${input.requestedQualityLabel}，但接口本次只返回 ${input.returnedQualityLabel} 兼容流。限制码：${input.qualityLimitReason}。`;
    }

    return `已请求 ${input.requestedQualityLabel}，但接口本次只返回 ${input.returnedQualityLabel} 兼容流。`;
  }

  if (input.requestedQuality !== input.returnedQuality) {
    if (input.qualityLimitReason) {
      return `已请求 ${input.requestedQualityLabel}，但接口本次只返回 ${input.returnedQualityLabel} DASH 分轨。限制码：${input.qualityLimitReason}。`;
    }

    return `已请求 ${input.requestedQualityLabel}，但接口本次实际返回 ${input.returnedQualityLabel} DASH 分轨。`;
  }

  if (
    input.compatibleQuality !== null
    && input.compatibleQuality !== input.returnedQuality
    && input.compatibleQualityLabel
  ) {
    return `接口已返回 ${input.returnedQualityLabel} DASH 分轨；兼容流最高仅 ${input.compatibleQualityLabel}，仅在 DASH 失败时作为回退。`;
  }

  return `接口已返回 ${input.returnedQualityLabel} 播放源。`;
}

export async function fetchPlaySource(bvid: string, cid: number, quality = 80): Promise<PlaySource> {
  const dashResult = await requestDashPlaySource(bvid, cid, quality);
  const dashData = dashResult.data;
  if (!dashData) {
    const directRequestTrace: PlayRequestTrace[] = [];
    const durlData = await requestPlaySource(bvid, cid, quality, 0, {
      trace: directRequestTrace,
    });
    const candidateUrls = getPlayCandidateUrls(durlData.durl?.[0]);
    if (!candidateUrls.length) {
      throw new Error('当前视频没有可用播放地址');
    }
    const qualities = buildPlayQualities(durlData);
    const currentQuality = Number(durlData.quality ?? quality);
    const requestedQualityLabel = pickQualityLabel(qualities, quality);
    const returnedQualityLabel = pickQualityLabel(qualities, currentQuality, durlData.format);
    const qualityLimitReason = getQualityLimitReason(qualities, quality, currentQuality);
    return {
      mode: 'durl',
      qualityLabel: returnedQualityLabel,
      currentQuality,
      returnedQuality: currentQuality,
      returnedQualityLabel,
      compatibleQuality: currentQuality,
      compatibleQualityLabel: returnedQualityLabel,
      requestedQuality: quality,
      requestedQualityLabel,
      qualityLimitReason,
      qualityReason: describePlayQualityReason({
        mode: 'durl',
        requestedQuality: quality,
        requestedQualityLabel,
        returnedQuality: currentQuality,
        returnedQualityLabel,
        compatibleQuality: currentQuality,
        compatibleQualityLabel: returnedQualityLabel,
        qualityLimitReason,
      }),
      durationMs: Number(durlData.timelength ?? 0),
      qualities,
      videoStreams: [],
      audioStreams: [],
      compatibleSources: [{
        quality: currentQuality,
        qualityLabel: pickQualityLabel(qualities, currentQuality, durlData.format),
        format: String(durlData.format ?? 'mp4'),
        url: candidateUrls[0],
        candidateUrls,
      }],
      candidateUrls,
      requestTrace: {
        dash: dashResult.requestTrace,
        compatible: directRequestTrace,
      },
    };
  }
  const qualities = buildPlayQualities(dashData);
  const videoStreams = buildVideoStreams(dashData, qualities);
  const audioStreams = buildAudioStreams(dashData);
  const returnedQuality = getReturnedDashQuality(dashData, quality, videoStreams);
  const compatibleResult = await fetchCompatibleSources(
    bvid,
    cid,
    qualities,
    returnedQuality,
  );
  const compatibleSources = compatibleResult.sources;

  if (!videoStreams.length && compatibleSources.length === 0) {
    throw new Error('当前视频没有可用播放地址');
  }

  const currentQuality = returnedQuality;
  const qualityLabel = pickQualityLabel(qualities, currentQuality, dashData.format);
  const requestedQualityLabel = pickQualityLabel(qualities, quality);
  const compatibleQuality = compatibleSources[0]?.quality ?? null;
  const compatibleQualityLabel = compatibleSources[0]?.qualityLabel ?? null;
  const qualityLimitReason = getQualityLimitReason(qualities, quality, currentQuality);
  return {
    mode: videoStreams.length > 0 ? 'dash' : 'durl',
    qualityLabel,
    currentQuality,
    returnedQuality: currentQuality,
    returnedQualityLabel: qualityLabel,
    compatibleQuality,
    compatibleQualityLabel,
    requestedQuality: quality,
    requestedQualityLabel,
    qualityLimitReason,
    qualityReason: describePlayQualityReason({
      mode: videoStreams.length > 0 ? 'dash' : 'durl',
      requestedQuality: quality,
      requestedQualityLabel,
      returnedQuality: currentQuality,
      returnedQualityLabel: qualityLabel,
      compatibleQuality,
      compatibleQualityLabel,
      qualityLimitReason,
    }),
    durationMs: Number(dashData.timelength ?? 0),
    qualities,
    videoStreams,
    audioStreams,
    compatibleSources,
    candidateUrls: compatibleSources.find((source) => source.quality === currentQuality)?.candidateUrls ?? compatibleSources[0]?.candidateUrls ?? [],
    requestTrace: {
      dash: dashResult.requestTrace,
      compatible: compatibleResult.requestTrace,
    },
  };
}

export async function createWebQrLogin() {
  const payload = await fetchJson<ApiEnvelope<{ url: string; qrcode_key: string }>>(
    getBiliPassportUrl('/x/passport-login/web/qrcode/generate'),
  );
  const data = unwrapData(payload);
  return {
    url: data.url,
    key: data.qrcode_key,
  };
}

export async function pollWebQrLogin(key: string) {
  const payload = await fetchJson<ApiEnvelope<{ code: number; message: string }>>(
    getBiliPassportUrl(`/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}`),
  );
  return unwrapData(payload);
}

export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  const navPayload = await fetchJson<ApiEnvelope<RawNavData>>(getBiliApiUrl('/x/web-interface/nav'));
  const navData = unwrapData(navPayload);
  const statPayload = await fetchJson<ApiEnvelope<RawNavStatData>>(getBiliApiUrl('/x/web-interface/nav/stat'));
  const statData = unwrapData(statPayload);
  return {
    mid: Number(navData.mid ?? 0),
    name: String(navData.uname ?? ''),
    face: normalizeCover(String(navData.face ?? '')),
    sign: String(navData.sign ?? ''),
    coin: Number(navData.money ?? 0),
    level: Number(navData.level_info?.current_level ?? 0),
    vipLabel: navData.vip_label?.text ? String(navData.vip_label.text) : null,
    following: Number(statData.following ?? 0),
    follower: Number(statData.follower ?? 0),
  };
}

export async function fetchHistoryPage(options?: {
  cursor?: string | null;
  pageSize?: number;
  type?: string;
}): Promise<HistoryPage> {
  const cursor = parseHistoryCursor(options?.cursor);
  const params = new URLSearchParams({
    type: options?.type ?? 'all',
    ps: String(options?.pageSize ?? 24),
    max: String(cursor?.max ?? 0),
    view_at: String(cursor?.viewAt ?? 0),
  });
  const payload = await fetchJson<ApiEnvelope<{ list: RawHistoryItem[] }>>(
    getBiliApiUrl(`/x/web-interface/history/cursor?${params.toString()}`),
  );
  const data = unwrapData(payload);
  const items = (data.list ?? []).map((item) => ({
    kid: String(item.kid ?? `${item.history?.oid ?? item.bvid}`),
    title: String(item.title ?? ''),
    bvid: String(item.history?.bvid ?? item.bvid ?? ''),
    cid: Number(item.history?.cid ?? item.cid ?? 0),
    cover: normalizeCover(String(item.cover ?? item.pic ?? '')),
    author: String(item.author_name ?? item.author ?? ''),
    duration: Number(item.duration ?? 0),
    progress: Number(item.progress ?? item.view_at ?? 0),
    viewAt: Number(item.view_at ?? 0),
    part: String(item.history?.part ?? ''),
  }));
  const lastItem = data.list?.at(-1);
  const nextMax = Number(lastItem?.history?.oid ?? 0);
  const nextViewAt = Number(lastItem?.view_at ?? 0);
  const nextCursor = nextMax > 0 && nextViewAt > 0
    ? JSON.stringify({
        max: nextMax,
        viewAt: nextViewAt,
      })
    : null;

  return {
    items,
    hasMore: items.length > 0 && nextCursor !== null,
    cursor: nextCursor,
  };
}

function parseHistoryCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(cursor) as {
      max?: Numeric;
      viewAt?: Numeric;
    };
    const max = Number(parsed.max ?? 0);
    const viewAt = Number(parsed.viewAt ?? 0);
    if (max <= 0 || viewAt <= 0) {
      return null;
    }

    return {
      max,
      viewAt,
    };
  } catch {
    return null;
  }
}

function mapPlaySubtitleTrack(track: RawPlaySubtitleTrack): PlaySubtitleTrack {
  const isAi = Number(track.type ?? 0) === 1;
  const langDoc = String(track.lan_doc ?? track.lan ?? '');
  return {
    id: Number(track.id ?? 0),
    lang: String(track.lan ?? ''),
    langDoc: isAi && langDoc ? `${langDoc}（AI）` : langDoc,
    subtitleUrl: normalizeCover(String(track.subtitle_url ?? track.subtitle_url_v2 ?? '')),
    isAi,
  };
}

export async function fetchLaterList(page = 1, pageSize = 90): Promise<LaterItem[]> {
  const params = await signWbi({
    pn: page,
    ps: pageSize,
    viewed: 0,
    key: '',
    asc: false,
    need_split: true,
    web_location: 333.881,
  });
  const payload = await fetchJson<ApiEnvelope<{ list: RawLaterItem[] }>>(
    getBiliApiUrl(`/x/v2/history/toview/web?${params.toString()}`),
  );
  const data = unwrapData(payload);
  return (data.list ?? []).map((item) => ({
    aid: Number(item.aid ?? 0),
    bvid: String(item.bvid ?? ''),
    cid: Number(item.cid ?? item.pages?.[0]?.cid ?? 0),
    title: String(item.title ?? ''),
    cover: normalizeCover(String(item.pic ?? item.cover ?? '')),
    author: String(item.owner?.name ?? item.author ?? ''),
    duration: Number(item.duration ?? 0),
  }));
}

export async function fetchFavoriteFolders(mid: number, page = 1, pageSize = 30): Promise<FavoriteFolder[]> {
  const payload = await fetchJson<ApiEnvelope<{ list: RawFavoriteFolder[] }>>(
    getBiliApiUrl(`/x/v3/fav/folder/created/list?pn=${page}&ps=${pageSize}&up_mid=${mid}`),
  );
  const data = unwrapData(payload);
  return (data.list ?? []).map((item) => ({
    id: Number(item.id ?? item.media_id ?? 0),
    title: String(item.title ?? ''),
    mediaCount: Number(item.media_count ?? item.count ?? 0),
    cover: normalizeCover(String(item.cover ?? '')),
    intro: String(item.intro ?? ''),
  }));
}

export async function fetchFavoriteFolderDetail(mediaId: number, page = 1, pageSize = 90): Promise<FavoriteItem[]> {
  const payload = await fetchJson<ApiEnvelope<{ medias: RawFavoriteItem[] }>>(
    getBiliApiUrl(`/x/v3/fav/resource/list?media_id=${mediaId}&pn=${page}&ps=${pageSize}&keyword=&order=mtime&type=0&tid=0&platform=web`),
  );
  const data = unwrapData(payload);
  return (data.medias ?? []).map((item) => ({
    aid: Number(item.id ?? item.aid ?? 0),
    bvid: String(item.bvid ?? ''),
    cid: Number(item.first_cid ?? item.cid ?? 0),
    title: String(item.title ?? ''),
    cover: normalizeCover(String(item.cover ?? '')),
    author: String(item.upper?.name ?? item.author ?? ''),
    duration: Number(item.duration ?? 0),
    description: String(item.intro ?? ''),
  }));
}

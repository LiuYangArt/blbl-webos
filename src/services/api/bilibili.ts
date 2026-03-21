import {
  fetchJson,
  getBiliApiUrl,
  getBiliPassportUrl,
  getBiliSearchUrl,
  unwrapData,
} from './http';
import { signWbi } from './wbi';
import type {
  ApiEnvelope,
  FavoriteFolder,
  FavoriteItem,
  HistoryItem,
  HotKeyword,
  LaterItem,
  ParsedVideoCodec,
  PlayAudioStream,
  PlayCompatibleSource,
  PlayQualityOption,
  PlaySource,
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
  codecs?: string;
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
    format?: string;
    codecs?: string[];
    can_watch_qn_reason?: Numeric;
    limit_watch_reason?: Numeric;
  }>;
  dash?: {
    video?: RawDashStream[];
    audio?: RawDashStream[];
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
  return Array.from(new Set(rawCandidates));
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
  return Array.from(new Set(rawCandidates));
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

function buildPlayQualities(data: RawPlaySource): PlayQualityOption[] {
  const supportFormats = data.support_formats ?? [];
  if (supportFormats.length > 0) {
    return supportFormats.map((item) => ({
      qn: Number(item.quality ?? 0),
      label: String(item.new_description ?? item.display_desc ?? item.format ?? `${item.quality ?? 0}P`),
      limitReason: Number(item.limit_watch_reason ?? item.can_watch_qn_reason ?? 0),
      codecs: Array.from(new Set((item.codecs ?? []).map(parseVideoCodec).filter((codec) => codec !== 'unknown'))),
    }));
  }

  return (data.accept_quality ?? []).map((quality, index) => ({
    qn: quality,
    label: String(data.accept_description?.[index] ?? `${quality}P`),
    limitReason: 0,
    codecs: [],
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
      width: Number(stream.width ?? 0),
      height: Number(stream.height ?? 0),
      bandwidth: Number(stream.bandwidth ?? 0),
      frameRate: parseFrameRate(stream.frame_rate),
    };
  }).filter((stream) => Boolean(stream.url));
}

function buildAudioStreams(data: RawPlaySource): PlayAudioStream[] {
  return (data.dash?.audio ?? []).map((stream) => {
    const urls = getDashCandidateUrls(stream);
    return {
      id: Number(stream.id ?? 0),
      url: urls[0] ?? '',
      backupUrls: urls.slice(1),
      bandwidth: Number(stream.bandwidth ?? 0),
      codecs: String(stream.codecs ?? ''),
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

export async function searchVideos(keyword: string, page = 1) {
  const params = await signWbi({
    search_type: 'video',
    keyword,
    page,
    page_size: 20,
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

export async function fetchRelatedVideos(bvid: string) {
  const payload = await fetchJson<ApiEnvelope<RawVideoCard[]>>(
    getBiliApiUrl(`/x/web-interface/archive/related?bvid=${encodeURIComponent(bvid)}`),
  );
  return unwrapData(payload).map(mapVideoCard);
}

async function requestPlaySource(
  bvid: string,
  cid: number,
  quality: number,
  fnval: number,
) {
  const payload = await fetchJson<ApiEnvelope<RawPlaySource>>(
    getBiliApiUrl(`/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cid}&qn=${quality}&fnval=${fnval}&fnver=0&fourk=1&otype=json`),
  );
  return unwrapData(payload);
}

async function requestDashPlaySource(bvid: string, cid: number, quality: number) {
  const candidates = [4048, 16];
  let lastError: unknown = null;

  for (const fnval of candidates) {
    try {
      const data = await requestPlaySource(bvid, cid, quality, fnval);
      if (data.dash?.video?.length) {
        return data;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    return null;
  }

  return null;
}

async function fetchCompatibleSources(
  bvid: string,
  cid: number,
  qualities: PlayQualityOption[],
  fallbackQuality: number,
) {
  const visited = new Set<number>();
  const preferredQualities = [fallbackQuality, ...qualities.map((item) => item.qn), 32, 16]
    .filter((item, index, list) => list.indexOf(item) === index)
    .sort((left, right) => right - left);

  const compatibleSources: PlayCompatibleSource[] = [];

  for (const quality of preferredQualities) {
    try {
      const data = await requestPlaySource(bvid, cid, quality, 0);
      const candidateUrls = getPlayCandidateUrls(data.durl?.[0]);
      const actualQuality = Number(data.quality ?? quality);
      if (!candidateUrls.length || visited.has(actualQuality)) {
        continue;
      }
      visited.add(actualQuality);
      compatibleSources.push({
        quality: actualQuality,
        qualityLabel: pickQualityLabel(qualities, actualQuality, data.format),
        format: String(data.format ?? 'mp4'),
        url: candidateUrls[0],
        candidateUrls,
      });
    } catch {
      // 兼容流按档位逐级尝试，单档失败不应中断整个播放计划。
    }
  }

  return compatibleSources;
}

export async function fetchPlaySource(bvid: string, cid: number, quality = 80): Promise<PlaySource> {
  const dashData = await requestDashPlaySource(bvid, cid, quality);
  if (!dashData) {
    const durlData = await requestPlaySource(bvid, cid, quality, 0);
    const candidateUrls = getPlayCandidateUrls(durlData.durl?.[0]);
    if (!candidateUrls.length) {
      throw new Error('当前视频没有可用播放地址');
    }
    const qualities = buildPlayQualities(durlData);
    const currentQuality = Number(durlData.quality ?? quality);
    return {
      mode: 'durl',
      qualityLabel: pickQualityLabel(qualities, currentQuality, durlData.format),
      currentQuality,
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
    };
  }
  const qualities = buildPlayQualities(dashData);
  const videoStreams = buildVideoStreams(dashData, qualities);
  const audioStreams = buildAudioStreams(dashData);
  const compatibleSources = await fetchCompatibleSources(
    bvid,
    cid,
    qualities,
    Number(dashData.quality ?? quality),
  );

  if (!videoStreams.length && compatibleSources.length === 0) {
    throw new Error('当前视频没有可用播放地址');
  }

  const currentQuality = compatibleSources[0]?.quality ?? Number(dashData.quality ?? quality);
  const qualityLabel = pickQualityLabel(qualities, currentQuality, dashData.format);
  return {
    mode: videoStreams.length > 0 ? 'dash' : 'durl',
    qualityLabel,
    currentQuality,
    durationMs: Number(dashData.timelength ?? 0),
    qualities,
    videoStreams,
    audioStreams,
    compatibleSources,
    candidateUrls: compatibleSources[0]?.candidateUrls ?? [],
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

export async function fetchHistoryList(): Promise<HistoryItem[]> {
  const payload = await fetchJson<ApiEnvelope<{ list: RawHistoryItem[] }>>(
    getBiliApiUrl('/x/web-interface/history/cursor?ps=30&type=archive'),
  );
  const data = unwrapData(payload);
  return (data.list ?? []).map((item) => ({
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
}

export async function fetchLaterList(): Promise<LaterItem[]> {
  const params = await signWbi({
    pn: 1,
    ps: 30,
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

export async function fetchFavoriteFolders(mid: number): Promise<FavoriteFolder[]> {
  const payload = await fetchJson<ApiEnvelope<{ list: RawFavoriteFolder[] }>>(
    getBiliApiUrl(`/x/v3/fav/folder/created/list?pn=1&ps=30&up_mid=${mid}`),
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

export async function fetchFavoriteFolderDetail(mediaId: number): Promise<FavoriteItem[]> {
  const payload = await fetchJson<ApiEnvelope<{ medias: RawFavoriteItem[] }>>(
    getBiliApiUrl(`/x/v3/fav/resource/list?media_id=${mediaId}&pn=1&ps=30&keyword=&order=mtime&type=0&tid=0&platform=web`),
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

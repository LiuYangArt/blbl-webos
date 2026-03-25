import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import type { PlayerRoutePayload } from '../../app/routes';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { VideoGridSection } from '../../components/VideoGridSection';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import {
  fetchUserArchivePage,
  fetchUserRelationStat,
  fetchUserSpaceProfile,
} from '../../services/api/bilibili';
import type { SpaceArchiveOrder, VideoCardItem } from '../../services/api/types';
import { useAsyncData } from '../../app/useAsyncData';
import { createResolvedVideoListItem, resolveVideoPlayerPayload } from '../shared/videoListItems';
import { usePagedCollection } from '../shared/usePagedCollection';

type AuthorSpacePageProps = {
  mid: number;
  authorName?: string;
  sourceBvid?: string;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

const AUTHOR_SPACE_HERO_SECTION_ID = 'author-space-hero';
const AUTHOR_SPACE_GRID_SECTION_ID = 'author-space-grid';

const ORDER_OPTIONS: Array<{
  value: SpaceArchiveOrder;
  label: string;
  description: string;
}> = [
  {
    value: 'pubdate',
    label: '最新发布',
    description: '按发布时间排序，优先看作者最近更新。',
  },
  {
    value: 'click',
    label: '最多播放',
    description: '按播放热度排序，优先看作者代表作。',
  },
];

export function AuthorSpacePage({
  mid,
  authorName,
  sourceBvid,
  onOpenPlayer,
}: AuthorSpacePageProps): ReactElement {
  const [activeOrder, setActiveOrder] = useState<SpaceArchiveOrder>('pubdate');
  const [archiveTotal, setArchiveTotal] = useState(0);

  const profile = useAsyncData(async () => {
    const [user, relation] = await Promise.all([
      fetchUserSpaceProfile(mid),
      fetchUserRelationStat(mid),
    ]);

    return { user, relation };
  }, [mid]);

  const archive = usePagedCollection({
    deps: [mid, activeOrder],
    loadPage: async (page) => {
      const result = await fetchUserArchivePage({
        mid,
        page,
        pageSize: 24,
        order: activeOrder,
      });
      setArchiveTotal(result.total);
      return {
        items: result.items,
        hasMore: result.hasMore,
      };
    },
    getItemKey: (item) => `${item.bvid}:${item.cid || item.aid}`,
  });

  useEffect(() => {
    if (archive.status === 'loading') {
      setArchiveTotal(0);
    }
  }, [archive.status]);

  const archiveItems = useMemo(() => (
    archive.status === 'success'
      ? createArchiveVideoItems(archive.items)
      : []
  ), [archive.items, archive.status]);

  if (profile.status === 'error') {
    return (
      <AuthorSpaceStatus
        sectionId="author-space-status"
        title="作者主页加载失败"
        description={profile.error}
        actionLabel="重新加载"
        actionFocusId="author-space-retry-profile"
        onAction={() => void profile.reload()}
      />
    );
  }

  if (profile.status !== 'success') {
    return (
      <AuthorSpaceStatus
        sectionId="author-space-loading"
        title="正在打开作者主页"
        description={authorName ? `正在准备 ${authorName} 的资料和投稿视频。` : '正在准备作者资料和投稿视频。'}
      />
    );
  }

  const { user, relation } = profile.data;
  const displayName = user.name || authorName || `UP ${mid}`;
  const currentOrderOption = ORDER_OPTIONS.find((option) => option.value === activeOrder) ?? ORDER_OPTIONS[0];
  const totalLabel = archiveTotal > 0 ? `共 ${formatCount(archiveTotal)} 个视频` : undefined;
  const sourceHint = getAuthorSourceHint(sourceBvid);
  const archiveDescription = `当前排序：${currentOrderOption.label}`;

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id={AUTHOR_SPACE_HERO_SECTION_ID}
        group="content"
        className="content-section author-space-hero"
        leaveFor={{ left: '@side-nav', down: `@${AUTHOR_SPACE_GRID_SECTION_ID}` }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <div className="author-space-hero__avatar">
          {user.face ? (
            <img src={user.face} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="author-space-hero__avatar-placeholder">
              <span>{displayName.slice(0, 1) || 'UP'}</span>
            </div>
          )}
        </div>
        <div className="author-space-hero__content">
          <span className="detail-hero__tag">UP 主页</span>
          <h1>{displayName}</h1>
          <p>{user.sign || '这个作者还没有公开个性签名。'}</p>
          <div className="author-space-hero__meta">
            <span>Lv.{user.level || 0}</span>
            <span>{user.vipLabel ?? '普通创作者'}</span>
            <span>{formatCount(relation.following)} 关注</span>
            <span>{formatCount(relation.follower)} 粉丝</span>
          </div>
          <p className="author-space-hero__hint">{sourceHint}</p>
          <div className="author-space-hero__actions">
            {ORDER_OPTIONS.map((option, index) => (
              <FocusButton
                key={option.value}
                variant={option.value === activeOrder ? 'primary' : 'glass'}
                size="md"
                className="author-space-order-chip"
                sectionId={AUTHOR_SPACE_HERO_SECTION_ID}
                focusId={`author-space-order-${option.value}`}
                defaultFocus={option.value === activeOrder || (index === 0 && activeOrder !== 'click')}
                onClick={() => {
                  if (option.value === activeOrder) {
                    return;
                  }
                  setActiveOrder(option.value);
                  setArchiveTotal(0);
                }}
              >
                <span>{option.label}</span>
                <small>{option.description}</small>
              </FocusButton>
            ))}
          </div>
        </div>
      </FocusSection>

      {archive.status === 'success' ? (
        <VideoGridSection
          sectionId={AUTHOR_SPACE_GRID_SECTION_ID}
          title="作者投稿"
          items={archiveItems}
          onOpenPlayer={onOpenPlayer}
          leaveFor={{ left: '@side-nav', up: `@${AUTHOR_SPACE_HERO_SECTION_ID}` }}
          visibilityMode="progressive"
          hasMore={archive.hasMore}
          isLoadingMore={archive.isLoadingMore}
          loadMoreError={archive.loadMoreError}
          onRequestMore={() => void archive.loadMore()}
          showHeader
          initialVisibleCount={12}
          revealStep={12}
          resetKey={`${mid}:${activeOrder}`}
          emptyState={<p className="page-helper-text">这个作者暂时还没有可展示的视频内容。</p>}
          beforeGrid={(
            <div className="author-space-grid__meta">
              <p className="page-helper-text">{archiveDescription}</p>
              {totalLabel ? <p className="page-helper-text">{totalLabel}</p> : null}
            </div>
          )}
          showEndHint
        />
      ) : (
        <FocusSection
          as="section"
          id={AUTHOR_SPACE_GRID_SECTION_ID}
          group="content"
          className="content-section"
          enterTo="last-focused"
          leaveFor={{ left: '@side-nav', up: `@${AUTHOR_SPACE_HERO_SECTION_ID}` }}
          scroll={CONTENT_FIRST_ROW_SCROLL}
        >
          <SectionHeader title="作者投稿" description={archiveDescription} actionLabel={totalLabel} />
          {archive.status === 'error' ? (
            <>
              <p className="page-helper-text">{archive.error}</p>
              <div className="page-inline-actions">
                <FocusButton
                  variant="ghost"
                  size="sm"
                  className="page-inline-link"
                  sectionId={AUTHOR_SPACE_GRID_SECTION_ID}
                  focusId="author-space-retry-archive"
                  defaultFocus
                  onClick={() => void archive.reload()}
                >
                  重新加载投稿视频
                </FocusButton>
              </div>
            </>
          ) : (
            <p className="page-helper-text">正在加载作者投稿视频...</p>
          )}
        </FocusSection>
      )}
    </main>
  );
}

type AuthorSpaceStatusProps = {
  sectionId: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionFocusId?: string;
  onAction?: () => void;
};

function AuthorSpaceStatus({
  sectionId,
  title,
  description,
  actionLabel,
  actionFocusId,
  onAction,
}: AuthorSpaceStatusProps): ReactElement {
  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id={sectionId}
        group="content"
        className="page-status"
        leaveFor={{ left: '@side-nav' }}
      >
        <span className="detail-hero__tag">UP 主页</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {actionLabel && onAction && actionFocusId ? (
          <div className="detail-hero__actions">
            <FocusButton
              variant="primary"
              size="hero"
              sectionId={sectionId}
              focusId={actionFocusId}
              defaultFocus
              onClick={onAction}
            >
              {actionLabel}
            </FocusButton>
          </div>
        ) : null}
      </FocusSection>
    </main>
  );
}

function createArchiveVideoItems(items: VideoCardItem[]) {
  return items.map((item) => createResolvedVideoListItem(
    `${item.bvid}:${item.cid || item.aid}`,
    item,
    () => resolveVideoPlayerPayload(item),
  ));
}

function getAuthorSourceHint(sourceBvid?: string): string {
  if (sourceBvid) {
    return '从当前播放继续浏览这个作者的其他视频。';
  }

  return '浏览这个作者的投稿视频。';
}

function formatCount(value: number): string {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)} 亿`;
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)} 万`;
  }
  return String(value);
}

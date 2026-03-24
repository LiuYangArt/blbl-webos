import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { VideoGridSection } from '../../components/VideoGridSection';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import {
  fetchCurrentUserProfile,
  fetchFavoriteFolderDetail,
  fetchFavoriteFolders,
  fetchLaterList,
} from '../../services/api/bilibili';
import {
  createDirectVideoListItem,
  mapFavoriteItemToVideoCard,
  mapLaterItemToVideoCard,
} from '../shared/videoListItems';
import { usePagedCollection } from '../shared/usePagedCollection';
import { PageStatus } from '../shared/PageStatus';
import {
  FAVORITE_FOLDER_SECTION_ID,
  FAVORITE_VIDEO_SECTION_ID,
  buildFavoriteFolderFocusId,
  buildFavoriteFolderSectionLeaveFor,
  buildFavoriteVideoSectionLeaveFor,
} from './libraryFocus';

type LibraryPageProps = {
  mode: 'later' | 'favorites';
  onLogin: () => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function LibraryPage({ mode, onLogin, onOpenPlayer }: LibraryPageProps) {
  const { auth } = useAppStore();
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);

  const later = usePagedCollection({
    deps: [mode],
    enabled: mode === 'later',
    loadPage: (page) => fetchLaterList(page, 24),
    getItemKey: (item) => `${item.bvid}:${item.cid}`,
  });

  const folders = useAsyncData(async () => {
    if (mode !== 'favorites') {
      return [];
    }

    const profile = auth.profile ?? await fetchCurrentUserProfile();
    return fetchFavoriteFolders(profile.mid);
  }, [mode, auth.profile?.mid]);

  useEffect(() => {
    if (mode !== 'favorites' || folders.status !== 'success') {
      return;
    }

    if (folders.data.length === 0) {
      setActiveFolderId(null);
      return;
    }

    const hasActiveFolder = activeFolderId !== null && folders.data.some((folder) => folder.id === activeFolderId);
    if (!hasActiveFolder) {
      setActiveFolderId(folders.data[0].id);
    }
  }, [activeFolderId, folders, mode]);

  const favoriteItems = usePagedCollection({
    deps: [mode, activeFolderId],
    enabled: mode === 'favorites' && activeFolderId !== null,
    loadPage: (page) => fetchFavoriteFolderDetail(activeFolderId ?? 0, page, 24),
    getItemKey: (item) => `${item.bvid}:${item.cid}`,
  });

  const activeFolder = useMemo(() => {
    if (mode !== 'favorites' || folders.status !== 'success') {
      return null;
    }

    return folders.data.find((folder) => folder.id === activeFolderId) ?? folders.data[0] ?? null;
  }, [activeFolderId, folders, mode]);

  const activeFolderIndex = useMemo(() => {
    if (mode !== 'favorites' || folders.status !== 'success') {
      return null;
    }

    const matchedIndex = folders.data.findIndex((folder) => folder.id === activeFolderId);
    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [activeFolderId, folders, mode]);

  if (mode === 'later') {
    if (later.status !== 'success') {
      if (later.status === 'error') {
        return (
          <PageStatus
            title="稍后再看暂不可用"
            description="通常是因为当前还没有有效登录态。"
            actionLabel="去扫码登录"
            onAction={onLogin}
          />
        );
      }

      return <PageStatus title="正在同步稍后再看" description="如果当前已有登录态，会自动读取账号数据。" />;
    }

    const items = later.items.map((item) => createDirectVideoListItem(
      item.bvid,
      mapLaterItemToVideoCard(item),
      item,
    ));

    return (
      <main className="page-shell">
        <VideoGridSection
          sectionId="later-list"
          title="稍后再看"
          items={items}
          onOpenPlayer={onOpenPlayer}
          hasMore={later.hasMore}
          isLoadingMore={later.isLoadingMore}
          loadMoreError={later.loadMoreError}
          onRequestMore={() => void later.loadMore()}
        />
      </main>
    );
  }

  if (folders.status !== 'success') {
    if (folders.status === 'error') {
      return (
        <PageStatus
          title="收藏夹暂不可用"
          description="通常是因为当前还没有有效登录态。"
          actionLabel="去扫码登录"
          onAction={onLogin}
        />
      );
    }

    return <PageStatus title="正在同步收藏夹" description="如果当前已有登录态，会自动读取账号数据。" />;
  }

  if (folders.data.length === 0) {
    return (
      <PageStatus
        title="还没有收藏内容"
        description="登录后，这里会直接展示默认收藏夹里的视频内容。"
        actionLabel="去扫码登录"
        onAction={onLogin}
      />
    );
  }

  if (favoriteItems.status !== 'success') {
    if (favoriteItems.status === 'error') {
      return (
        <PageStatus
          title="收藏视频加载失败"
          description={favoriteItems.error}
          actionLabel="重新加载"
          onAction={() => void favoriteItems.reload()}
        />
      );
    }

    return <PageStatus title="正在加载收藏视频" description={activeFolder?.title ?? '准备收藏列表'} />;
  }

  const items = favoriteItems.items.map((item) => createDirectVideoListItem(
    `${item.bvid}:${item.cid}`,
    mapFavoriteItemToVideoCard(item, activeFolder?.title),
    {
      bvid: item.bvid,
      cid: item.cid,
      title: item.title,
    },
  ));

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id={FAVORITE_FOLDER_SECTION_ID}
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={buildFavoriteFolderSectionLeaveFor()}
        scroll={CONTENT_FIRST_ROW_SCROLL}
      >
        <SectionHeader title="收藏" />
        <div className="library-folder-strip">
          {folders.data.map((folder, index) => (
            <FocusButton
              key={folder.id}
              variant={folder.id === activeFolderId ? 'primary' : 'glass'}
              size="md"
              className="detail-chip library-folder-chip"
              sectionId={FAVORITE_FOLDER_SECTION_ID}
              focusId={buildFavoriteFolderFocusId(index)}
              defaultFocus={folder.id === activeFolderId}
              onClick={() => setActiveFolderId(folder.id)}
            >
              <span>{folder.title}</span>
              <small>{folder.mediaCount} 个视频</small>
            </FocusButton>
          ))}
        </div>
      </FocusSection>

      <VideoGridSection
        sectionId={FAVORITE_VIDEO_SECTION_ID}
        title={activeFolder?.title ?? '收藏视频'}
        showHeader={false}
        items={items}
        onOpenPlayer={onOpenPlayer}
        resetKey={String(activeFolderId ?? 'favorites')}
        leaveFor={buildFavoriteVideoSectionLeaveFor(activeFolderIndex)}
        hasMore={favoriteItems.hasMore}
        isLoadingMore={favoriteItems.isLoadingMore}
        loadMoreError={favoriteItems.loadMoreError}
        onRequestMore={() => void favoriteItems.loadMore()}
        emptyState={<p className="page-helper-text">这个收藏夹里暂时还没有可展示的视频。</p>}
      />
    </main>
  );
}

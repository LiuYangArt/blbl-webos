import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../app/AppStore';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { VideoGridSection } from '../../components/VideoGridSection';
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
import { PageStatus } from '../shared/PageStatus';

type LibraryPageProps = {
  mode: 'later' | 'favorites';
  onLogin: () => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function LibraryPage({ mode, onLogin, onOpenPlayer }: LibraryPageProps) {
  const { auth } = useAppStore();
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);

  const later = useAsyncData(
    async () => (mode === 'later' ? fetchLaterList() : []),
    [mode],
  );

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

  const favoriteItems = useAsyncData(async () => {
    if (mode !== 'favorites' || !activeFolderId) {
      return [];
    }

    return fetchFavoriteFolderDetail(activeFolderId);
  }, [mode, activeFolderId]);

  const activeFolder = useMemo(() => {
    if (mode !== 'favorites' || folders.status !== 'success') {
      return null;
    }

    return folders.data.find((folder) => folder.id === activeFolderId) ?? folders.data[0] ?? null;
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

    const items = later.data.map((item) => createDirectVideoListItem(
      item.bvid,
      mapLaterItemToVideoCard(item),
      item,
    ));

    return (
      <main className="page-shell">
        <VideoGridSection
          sectionId="later-list"
          title="稍后再看"
          description="统一收敛为和首页一致的视频列表，点击卡片直接播放。"
          actionLabel={`${items.length} 条`}
          items={items}
          onOpenPlayer={onOpenPlayer}
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

  const items = favoriteItems.data.map((item) => createDirectVideoListItem(
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
      <VideoGridSection
        sectionId="favorites-list"
        title="收藏"
        description="默认直接展示收藏视频，顶部只保留轻量切换，不再把选收藏夹作为主流程。"
        actionLabel={activeFolder ? `${activeFolder.title} · ${items.length} 条` : `${items.length} 条`}
        items={items}
        onOpenPlayer={onOpenPlayer}
        resetKey={String(activeFolderId ?? 'favorites')}
        beforeGrid={(
          <div className="library-folder-strip">
            {folders.data.map((folder, index) => (
              <FocusButton
                key={folder.id}
                variant={folder.id === activeFolderId ? 'primary' : 'glass'}
                size="md"
                className="detail-chip library-folder-chip"
                sectionId="favorites-list"
                focusId={`favorite-folder-${index}`}
                onClick={() => setActiveFolderId(folder.id)}
              >
                <span>{folder.title}</span>
                <small>{folder.mediaCount} 个视频</small>
              </FocusButton>
            ))}
          </div>
        )}
        emptyState={<p className="page-helper-text">这个收藏夹里暂时还没有可展示的视频。</p>}
      />
    </main>
  );
}

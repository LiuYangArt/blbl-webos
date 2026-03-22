import { useAppStore } from '../../app/AppStore';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAsyncData } from '../../app/useAsyncData';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import {
  fetchCurrentUserProfile,
  fetchFavoriteFolders,
  fetchLaterList,
} from '../../services/api/bilibili';
import type { FavoriteFolder } from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';

type LibraryPageProps =
  | {
      mode: 'later';
      onLogin: () => void;
      onOpenPlayer: (item: PlayerRoutePayload) => void;
    }
  | {
      mode: 'favorites';
      onLogin: () => void;
      onOpenFavorite: (folder: FavoriteFolder) => void;
    };

export function LibraryPage(props: LibraryPageProps) {
  const { auth } = useAppStore();
  const library = useAsyncData(async () => {
    if (props.mode === 'later') {
      return { items: await fetchLaterList() };
    }
    const profile = auth.profile ?? await fetchCurrentUserProfile();
    return { folders: await fetchFavoriteFolders(profile.mid) };
  }, [props.mode, auth.profile?.mid]);

  if (library.status !== 'success') {
    if (library.status === 'error') {
      return (
        <PageStatus
          title={props.mode === 'later' ? '稍后再看暂不可用' : '收藏夹暂不可用'}
          description="通常是因为当前还没有有效登录态。"
          actionLabel="去扫码登录"
          onAction={props.onLogin}
        />
      );
    }
    return <PageStatus title={props.mode === 'later' ? '正在同步稍后再看' : '正在同步收藏夹'} description="如果当前已有登录态，会自动读取账号数据。" />;
  }

  const data = library.data;

  if (props.mode === 'later') {
    const items = ('items' in data ? data.items : undefined) ?? [];
    return (
      <main className="page-shell">
        <FocusSection
          as="section"
          id="later-list"
          group="content"
          enterTo="last-focused"
          className="content-section"
          leaveFor={{ left: '@side-nav' }}
        >
          <SectionHeader title="稍后再看" description="首版先支持列表浏览和直接播放，管理动作后置。" actionLabel={`${items.length} 条`} />
          <div className="list-panel">
            {items.map((item, index) => (
              <div key={item.bvid} className="list-panel__row">
                <FocusButton
                  variant="card"
                  className="history-card"
                  sectionId="later-list"
                  focusId={`later-item-${index}`}
                  defaultFocus={index === 0}
                  onClick={() => props.onOpenPlayer(item)}
                >
                  <img src={item.cover} alt="" className="history-card__cover" referrerPolicy="no-referrer" />
                  <div className="history-card__body">
                    <strong>{item.title}</strong>
                    <span>{item.author}</span>
                    <small>{formatDuration(item.duration)}</small>
                  </div>
                </FocusButton>
              </div>
            ))}
          </div>
        </FocusSection>
      </main>
    );
  }

  const folders = ('folders' in data ? data.folders : undefined) ?? [];
  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="favorites-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav' }}
      >
        <SectionHeader title="收藏夹" description="首版先做文件夹列表和详情播放入口，管理动作后置。" actionLabel={`${folders.length} 个`} />
        <div className="chip-grid">
          {folders.map((folder, index) => (
            <FocusButton
              key={folder.id}
              variant={index === 0 ? 'primary' : 'glass'}
              size="hero"
              sectionId="favorites-grid"
              focusId={`favorite-folder-${index}`}
              defaultFocus={index === 0}
              className="library-folder-card"
              onClick={() => props.onOpenFavorite(folder)}
            >
              <span>{folder.title}</span>
              <small>{folder.mediaCount} 个视频</small>
            </FocusButton>
            ))}
        </div>
      </FocusSection>
    </main>
  );
}

function formatDuration(duration: number) {
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

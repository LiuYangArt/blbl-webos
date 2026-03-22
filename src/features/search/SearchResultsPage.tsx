import { useState } from 'react';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAppStore } from '../../app/AppStore';
import { useAsyncData } from '../../app/useAsyncData';
import { usePageBackHandler } from '../../app/PageBackHandler';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import { fetchVideoDetail, searchVideos } from '../../services/api/bilibili';
import type { VideoCardItem } from '../../services/api/types';
import { PageStatus } from '../shared/PageStatus';

type SearchResultsPageProps = {
  keyword: string;
  onSubmit: (keyword: string) => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function SearchResultsPage({ keyword, onSubmit, onOpenPlayer }: SearchResultsPageProps) {
  const { rememberSearch } = useAppStore();
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState(keyword);
  const [pendingBvid, setPendingBvid] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const result = useAsyncData(() => searchVideos(keyword, 1), [keyword]);

  usePageBackHandler(isComposerOpen ? () => {
    setComposerOpen(false);
    return true;
  } : null);

  const submitKeyword = (nextKeyword: string) => {
    const normalized = nextKeyword.trim();
    if (!normalized) {
      return;
    }
    rememberSearch(normalized);
    onSubmit(normalized);
  };

  const openPlayerFromSearch = async (item: VideoCardItem) => {
    setResolveError(null);

    if (item.cid > 0) {
      onOpenPlayer(item);
      return;
    }

    setPendingBvid(item.bvid);
    try {
      const detail = await fetchVideoDetail(item.bvid);
      const firstPart = detail.parts[0];
      onOpenPlayer({
        bvid: item.bvid,
        cid: firstPart?.cid ?? detail.cid,
        title: detail.title || item.title,
        part: firstPart?.part,
      });
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : '补全视频播放信息失败');
    } finally {
      setPendingBvid(null);
    }
  };

  if (result.status !== 'success') {
    if (result.status === 'error') {
      return (
        <PageStatus
          title="搜索失败"
          description={result.error}
          actionLabel="重新搜索"
          onAction={() => void result.reload()}
        />
      );
    }
    return <PageStatus title="正在搜索视频" description={`关键词：${keyword}`} />;
  }

  const items = result.data;

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="search-results-actions"
        group="content"
        className="content-section search-hero"
        leaveFor={{ left: '@side-nav', down: '@search-results-grid' }}
      >
        <SectionHeader
          title={`搜索结果：${keyword}`}
          description="当前首版优先支持视频结果，并保持统一卡片体系。"
          actionLabel={`${items.length} 条结果`}
        />
        <div className="search-entry">
          <FocusButton
            variant="primary"
            size="hero"
            sectionId="search-results-actions"
            focusId="search-results-open-composer"
            defaultFocus
            onClick={() => setComposerOpen(true)}
          >
            重新输入
          </FocusButton>
        </div>

        {isComposerOpen ? (
          <div className="search-composer">
            <label className="search-composer__field">
              <span>关键词</span>
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitKeyword(draft);
                  }
                }}
              />
            </label>
            <div className="search-composer__actions">
              <button type="button" onClick={() => submitKeyword(draft)}>
                应用关键词
              </button>
              <button type="button" onClick={() => setComposerOpen(false)}>
                关闭输入面板
              </button>
            </div>
          </div>
        ) : null}
      </FocusSection>

      <FocusSection
        as="section"
        id="search-results-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@search-results-actions' }}
      >
        <SectionHeader title="视频结果" description="点击任意结果直接进入全屏播放。" actionLabel="立即播放" />
        {resolveError ? <p className="page-helper-text">{resolveError}</p> : null}
        {items.length ? (
          <div className="media-grid">
            {items.slice(0, 18).map((item, index) => (
              <MediaCard
                key={item.bvid}
                sectionId="search-results-grid"
                focusId={`search-result-${index}`}
                item={item}
                onClick={() => void openPlayerFromSearch(item)}
              />
            ))}
          </div>
        ) : (
          <p className="page-helper-text">没有找到结果，试试缩短关键词或换一个热搜词。</p>
        )}
        {pendingBvid ? <p className="page-helper-text">正在补全视频播放信息：{pendingBvid}</p> : null}
      </FocusSection>
    </main>
  );
}

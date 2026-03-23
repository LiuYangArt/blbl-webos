import { useState } from 'react';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAppStore } from '../../app/AppStore';
import { usePageBackHandler } from '../../app/PageBackHandler';
import { FocusButton } from '../../components/FocusButton';
import { SectionHeader } from '../../components/SectionHeader';
import { CONTENT_FIRST_ROW_SCROLL, FocusSection } from '../../platform/focus';
import { VideoGridSection } from '../../components/VideoGridSection';
import { searchVideos } from '../../services/api/bilibili';
import { createResolvedVideoListItem, resolveVideoPlayerPayload } from '../shared/videoListItems';
import { usePagedCollection } from '../shared/usePagedCollection';
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

  const result = usePagedCollection({
    deps: [keyword],
    loadPage: (page) => searchVideos(keyword, page, 24),
    getItemKey: (item) => `${item.bvid}:${item.cid}`,
  });

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

  const items = result.items;
  const videoItems = items.map((item) => createResolvedVideoListItem(
    item.bvid,
    item,
    () => resolveVideoPlayerPayload(item),
  ));

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="search-results-actions"
        group="content"
        className="content-section search-hero"
        leaveFor={{ left: '@side-nav', down: '@search-results-grid' }}
        scroll={CONTENT_FIRST_ROW_SCROLL}
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

      <VideoGridSection
        sectionId="search-results-grid"
        title="视频结果"
        description="点击任意结果直接进入全屏播放。"
        actionLabel="立即播放"
        items={videoItems}
        onOpenPlayer={onOpenPlayer}
        leaveFor={{ left: '@side-nav', up: '@search-results-actions' }}
        hasMore={result.hasMore}
        isLoadingMore={result.isLoadingMore}
        loadMoreError={result.loadMoreError}
        onRequestMore={() => void result.loadMore()}
        emptyState={<p className="page-helper-text">没有找到结果，试试缩短关键词或换一个热搜词。</p>}
      />
    </main>
  );
}

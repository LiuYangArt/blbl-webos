import { useState } from 'react';
import type { PlayerRoutePayload } from '../../app/routes';
import { useAppStore } from '../../app/AppStore';
import { useAsyncData } from '../../app/useAsyncData';
import { usePageBackHandler } from '../../app/PageBackHandler';
import { FocusButton } from '../../components/FocusButton';
import { MediaCard } from '../../components/MediaCard';
import { SectionHeader } from '../../components/SectionHeader';
import { FocusSection } from '../../platform/focus';
import {
  fetchHotKeywords,
  fetchRecommendedVideos,
  fetchSearchDefaultWord,
} from '../../services/api/bilibili';
import { PageStatus } from '../shared/PageStatus';

type SearchPageProps = {
  onSubmit: (keyword: string) => void;
  onOpenPlayer: (item: PlayerRoutePayload) => void;
};

export function SearchPage({ onSubmit, onOpenPlayer }: SearchPageProps) {
  const { searchHistory, rememberSearch, removeSearchHistory } = useAppStore();
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const discovery = useAsyncData(async () => {
    const [defaultWord, hotKeywords, preview] = await Promise.all([
      fetchSearchDefaultWord(),
      fetchHotKeywords(),
      fetchRecommendedVideos(6, 2),
    ]);
    return { defaultWord, hotKeywords, preview };
  }, []);

  usePageBackHandler(isComposerOpen ? () => {
    setComposerOpen(false);
    return true;
  } : null);

  if (discovery.status !== 'success') {
    if (discovery.status === 'error') {
      return (
        <PageStatus
          title="搜索页加载失败"
          description={discovery.error}
          actionLabel="重试搜索页"
          onAction={() => void discovery.reload()}
        />
      );
    }
    return <PageStatus title="正在准备搜索页" description="加载默认词、热搜和最近搜索。" />;
  }

  const { defaultWord, hotKeywords, preview } = discovery.data;
  const historySectionId = searchHistory.length ? 'search-history' : 'search-preview-grid';

  const submitKeyword = (keyword: string) => {
    const normalized = keyword.trim();
    if (!normalized) {
      return;
    }
    rememberSearch(normalized);
    onSubmit(normalized);
  };

  return (
    <main className="page-shell">
      <FocusSection
        as="section"
        id="search-actions"
        group="content"
        className="content-section search-hero"
        leaveFor={{ left: '@side-nav', down: '@search-hot-keywords' }}
      >
        <SectionHeader
          title="搜索内容"
          description="TV 首版把输入做成可聚焦入口，再配合热搜与历史降低输入成本。"
          actionLabel={defaultWord.showName}
        />

        <div className="search-entry">
          <FocusButton
            variant="primary"
            size="hero"
            sectionId="search-actions"
            focusId="search-open-composer"
            defaultFocus
            onClick={() => setComposerOpen(true)}
          >
            输入关键词
          </FocusButton>
          <FocusButton
            variant="secondary"
            size="hero"
            sectionId="search-actions"
            focusId="search-default-word"
            onClick={() => submitKeyword(defaultWord.keyword)}
          >
            搜索默认词
          </FocusButton>
        </div>

        {isComposerOpen ? (
          <div className="search-composer">
            <label className="search-composer__field">
              <span>关键词</span>
              <input
                autoFocus
                value={draft}
                placeholder={defaultWord.showName}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    submitKeyword(draft || defaultWord.keyword);
                  }
                }}
              />
            </label>
            <div className="search-composer__actions">
              <button type="button" onClick={() => submitKeyword(draft || defaultWord.keyword)}>
                立即搜索
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
        id="search-hot-keywords"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: '@search-actions', down: `@${historySectionId}` }}
      >
        <SectionHeader title="热搜" description="点击热词直接进入结果页。" actionLabel={`${hotKeywords.length} 个热词`} />
        <div className="chip-grid">
          {hotKeywords.slice(0, 8).map((item, index) => (
            <FocusButton
              key={item.keyword}
              variant="glass"
              className="detail-chip"
              sectionId="search-hot-keywords"
              focusId={`search-hot-${index}`}
              onClick={() => submitKeyword(item.keyword)}
            >
              {item.showName || item.keyword}
            </FocusButton>
          ))}
        </div>
      </FocusSection>

      <FocusSection
        as="section"
        id="search-history"
        group="content"
        enterTo="last-focused"
        className="content-section"
        disabled={!searchHistory.length}
        leaveFor={{ left: '@side-nav', up: '@search-hot-keywords', down: '@search-preview-grid' }}
      >
        <SectionHeader title="搜索历史" description="搜索历史保存在本地，便于遥控器下快速复用。" actionLabel={`${searchHistory.length} 条`} />
        {searchHistory.length ? (
          <div className="chip-grid">
            {searchHistory.map((item, index) => (
              <FocusButton
                key={item}
                variant="secondary"
                className="detail-chip"
                sectionId="search-history"
                focusId={`search-history-${index}`}
                onClick={() => submitKeyword(item)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  removeSearchHistory(item);
                }}
              >
                {item}
              </FocusButton>
            ))}
          </div>
        ) : (
          <p className="page-helper-text">还没有历史搜索，先试试热搜或默认词。</p>
        )}
      </FocusSection>

      <FocusSection
        as="section"
        id="search-preview-grid"
        group="content"
        enterTo="last-focused"
        className="content-section"
        leaveFor={{ left: '@side-nav', up: searchHistory.length ? '@search-history' : '@search-hot-keywords' }}
      >
        <SectionHeader title="直接开看" description="搜索页底部保留一组推荐内容，减少空场景。" actionLabel="推荐预览" />
        <div className="media-grid">
          {preview.map((item, index) => (
            <MediaCard
              key={item.bvid}
              sectionId="search-preview-grid"
              focusId={`search-preview-${index}`}
              item={item}
              onClick={() => onOpenPlayer(item)}
            />
          ))}
        </div>
      </FocusSection>
    </main>
  );
}

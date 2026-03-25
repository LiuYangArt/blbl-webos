type VideoListLoadingPageProps = {
  mode?: 'page' | 'overlay';
};

export function VideoListLoadingPage({ mode = 'page' }: VideoListLoadingPageProps) {
  return (
    <main
      className={mode === 'overlay' ? 'video-list-loading-page video-list-loading-page--overlay' : 'video-list-loading-page'}
      aria-live="polite"
      aria-label="页面加载中"
    >
      <p className="video-list-loading-page__text">页面加载中...</p>
    </main>
  );
}

import { useRouteLoadingOverlay } from '../../app/RouteLoadingOverlay';
import { useImageReadyGate } from './useImageReadyGate';
import { useVideoListLoadingGate } from './useVideoListLoadingGate';

type UseVideoListPageLoadingOptions = {
  ready: boolean;
  imageUrls: string[];
  overlayVisible: boolean;
  minDurationMs?: number;
};

export function useVideoListPageLoading({
  ready,
  imageUrls,
  overlayVisible,
  minDurationMs,
}: UseVideoListPageLoadingOptions) {
  const imagesReady = useImageReadyGate(imageUrls, ready);
  const showLoadingGate = useVideoListLoadingGate(ready && imagesReady, { minDurationMs });

  useRouteLoadingOverlay(overlayVisible && showLoadingGate);
  return showLoadingGate;
}

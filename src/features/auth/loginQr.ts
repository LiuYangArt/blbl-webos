const MIN_QR_DISPLAY_SIZE = 360;
const MAX_QR_DISPLAY_SIZE = 560;
const BITMAP_SCALE = 2;
const MAX_QR_BITMAP_SIZE = 960;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getLoginQrDisplaySize(viewportWidth: number, viewportHeight: number) {
  const safeWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1920;
  const safeHeight = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 1080;
  const baseSize = Math.min(safeWidth * 0.31, safeHeight * 0.5);
  return Math.round(clamp(baseSize, MIN_QR_DISPLAY_SIZE, MAX_QR_DISPLAY_SIZE));
}

export function getLoginQrBitmapSize(viewportWidth: number, viewportHeight: number) {
  const displaySize = getLoginQrDisplaySize(viewportWidth, viewportHeight);
  return Math.min(displaySize * BITMAP_SCALE, MAX_QR_BITMAP_SIZE);
}

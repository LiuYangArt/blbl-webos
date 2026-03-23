const PIXEL_RADIUS_PATTERN = /(-?\d*\.?\d+)px/g;

export function expandBorderRadius(borderRadius: string, delta: number) {
  if (!borderRadius || delta === 0) {
    return borderRadius;
  }

  let replaced = false;
  const expanded = borderRadius.replace(PIXEL_RADIUS_PATTERN, (_, value: string) => {
    replaced = true;
    return `${Math.max(0, Number.parseFloat(value) + delta)}px`;
  });

  return replaced ? expanded : borderRadius;
}

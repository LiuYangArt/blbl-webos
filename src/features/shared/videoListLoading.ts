export function pickImageUrls<T>(
  items: T[],
  getUrl: (item: T) => string | null | undefined,
  limit: number,
) {
  const urls: string[] = [];

  for (const item of items) {
    const url = getUrl(item)?.trim();
    if (!url || urls.includes(url)) {
      continue;
    }

    urls.push(url);
    if (urls.length >= limit) {
      break;
    }
  }

  return urls;
}

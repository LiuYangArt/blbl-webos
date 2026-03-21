import { md5 } from 'js-md5';
import { fetchJson, getBiliApiUrl } from './http';

const MIXIN_KEY_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32,
  15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19,
  29, 28, 14, 39, 12, 38, 41, 13,
] as const;

const FILTER_PATTERN = /[!'()*]/g;

let cachedMixinKey = '';
let cachedDay = '';

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getFileStem(url: string) {
  const last = url.split('/').pop() ?? '';
  return last.split('.')[0];
}

function mixinKey(origin: string) {
  return MIXIN_KEY_TABLE.map((index) => origin[index] ?? '').join('');
}

async function readMixinKey() {
  if (cachedMixinKey && cachedDay === getTodayKey()) {
    return cachedMixinKey;
  }
  const payload = await fetchJson<{
    code: number;
    message: string;
    data: {
      wbi_img: {
        img_url: string;
        sub_url: string;
      };
    };
  }>(getBiliApiUrl('/x/web-interface/nav'));

  const imageKey = getFileStem(payload.data.wbi_img.img_url);
  const subKey = getFileStem(payload.data.wbi_img.sub_url);
  cachedMixinKey = mixinKey(`${imageKey}${subKey}`);
  cachedDay = getTodayKey();
  return cachedMixinKey;
}

function encodeValue(value: string | number | boolean) {
  return String(value).replace(FILTER_PATTERN, '');
}

export async function signWbi(params: Record<string, string | number | boolean | undefined | null>) {
  const key = await readMixinKey();
  const entries = Object.entries(params)
    .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined && entry[1] !== null)
    .sort(([left], [right]) => left.localeCompare(right));

  const searchParams = new URLSearchParams();
  for (const [paramKey, value] of entries) {
    searchParams.set(paramKey, encodeValue(value));
  }
  searchParams.set('wts', String(Math.floor(Date.now() / 1000)));

  const query = Array.from(searchParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([paramKey, value]) => `${encodeURIComponent(paramKey)}=${encodeURIComponent(value)}`)
    .join('&');

  searchParams.set('w_rid', md5(query + key));
  return searchParams;
}

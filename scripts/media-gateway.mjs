import { createServer } from 'node:http';
import { URL } from 'node:url';

const HOST = process.env.BILI_MEDIA_GATEWAY_HOST ?? '127.0.0.1';
const PORT = Number(process.env.BILI_MEDIA_GATEWAY_PORT ?? '18200');
const DEFAULT_PLAY_QUALITY = Number(process.env.BILI_MEDIA_GATEWAY_DEFAULT_QUALITY ?? '80');
const PLAY_SOURCE_CACHE_TTL_MS = Number(process.env.BILI_MEDIA_GATEWAY_CACHE_TTL_MS ?? '300000');
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const SKIPPED_HEADERS = new Set([
  'access-control-allow-credentials',
  'access-control-allow-origin',
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);
const telemetry = [];
const playSourceCache = new Map();

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function normalizeTargetUrl(rawUrl) {
  if (!rawUrl) {
    return null;
  }

  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function copyUpstreamHeaders(upstream, res) {
  for (const [name, value] of upstream.headers.entries()) {
    if (SKIPPED_HEADERS.has(name)) {
      continue;
    }
    res.setHeader(name, value);
  }
}

function logLine(message, detail) {
  const prefix = `[media-gateway ${new Date().toISOString()}]`;
  if (detail === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }
  console.log(`${prefix} ${message}`, detail);
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizePositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function buildGatewayUrl(req) {
  return new URL(req.url ?? '/', `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
}

function getRangeHeader(req) {
  return typeof req.headers.range === 'string' ? req.headers.range : undefined;
}

function buildBiliPlayUrl(bvid, cid, quality) {
  const searchParams = new URLSearchParams({
    bvid,
    cid: String(cid),
    qn: String(quality),
    fnval: '0',
    fnver: '0',
    fourk: '1',
    otype: 'json',
  });
  return new URL(`https://api.bilibili.com/x/player/playurl?${searchParams.toString()}`);
}

function getPlayCandidateUrls(payload) {
  const urls = [
    payload?.durl?.[0]?.url,
    ...(payload?.durl?.[0]?.backup_url ?? []),
  ]
    .filter((item) => typeof item === 'string' && item)
    .map((item) => item.startsWith('http://') ? `https://${item.slice('http://'.length)}` : item);
  return Array.from(new Set(urls));
}

function getCacheKey(bvid, cid, quality) {
  return `${bvid}:${cid}:${quality}`;
}

function readCachedPlaySource(cacheKey) {
  const cached = playSourceCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    playSourceCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function writeCachedPlaySource(cacheKey, value) {
  playSourceCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + PLAY_SOURCE_CACHE_TTL_MS,
  });
}

async function fetchBiliPlaySource(bvid, cid, quality) {
  const upstream = await fetch(buildBiliPlayUrl(bvid, cid, quality), {
    headers: {
      accept: 'application/json, text/plain, */*',
      origin: 'https://www.bilibili.com',
      referer: 'https://www.bilibili.com/',
      'user-agent': DESKTOP_UA,
    },
  });

  if (!upstream.ok) {
    throw new Error(`playurl upstream failed (${upstream.status})`);
  }

  const payload = await upstream.json();
  if (payload?.code !== 0 || !payload?.data) {
    throw new Error(String(payload?.message ?? 'playurl payload invalid'));
  }

  const candidateUrls = getPlayCandidateUrls(payload.data);
  if (candidateUrls.length === 0) {
    throw new Error('playurl returned no compatible source');
  }

  return {
    actualQuality: Number(payload.data.quality ?? quality),
    format: String(payload.data.format ?? 'mp4'),
    candidateUrls,
  };
}

async function resolveStructuredPlaySource(searchParams) {
  const bvid = normalizeText(searchParams.get('bvid'));
  const cid = normalizePositiveInteger(searchParams.get('cid'));
  const quality = normalizePositiveInteger(searchParams.get('quality')) ?? DEFAULT_PLAY_QUALITY;
  const requestedCandidateIndex = normalizeNonNegativeInteger(searchParams.get('candidateIndex')) ?? 0;

  if (!bvid || !cid) {
    throw new Error('invalid play source params');
  }

  const cacheKey = getCacheKey(bvid, cid, quality);
  const cached = readCachedPlaySource(cacheKey);
  const resolved = cached ?? await fetchBiliPlaySource(bvid, cid, quality);
  if (!cached) {
    writeCachedPlaySource(cacheKey, resolved);
  }

  const candidateIndex = Math.min(requestedCandidateIndex, resolved.candidateUrls.length - 1);
  const target = normalizeTargetUrl(resolved.candidateUrls[candidateIndex]);
  if (!target) {
    throw new Error('resolved target url invalid');
  }

  return {
    bvid,
    cid,
    requestedQuality: quality,
    actualQuality: resolved.actualQuality,
    format: resolved.format,
    candidateIndex,
    candidateCount: resolved.candidateUrls.length,
    target,
  };
}

async function proxyMediaTarget(req, res, target, context) {
  const rangeHeader = getRangeHeader(req);
  logLine('proxy media request', {
    ...context,
    target: target.toString(),
    range: rangeHeader ?? null,
  });

  const upstream = await fetch(target, {
    headers: {
      accept: '*/*',
      origin: 'https://www.bilibili.com',
      referer: 'https://www.bilibili.com/',
      'user-agent': DESKTOP_UA,
      ...(rangeHeader ? { range: rangeHeader } : {}),
    },
  });

  logLine('upstream response', {
    ...context,
    target: target.toString(),
    status: upstream.status,
    contentType: upstream.headers.get('content-type'),
    contentRange: upstream.headers.get('content-range'),
  });

  res.statusCode = upstream.status;
  copyUpstreamHeaders(upstream, res);
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-credentials', 'false');

  if (!upstream.body) {
    res.end();
    return;
  }

  for await (const chunk of upstream.body) {
    res.write(chunk);
  }
  res.end();
}

const server = createServer(async (req, res) => {
  const requestUrl = buildGatewayUrl(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,range',
    });
    res.end();
    return;
  }

  if (requestUrl.pathname === '/health') {
    writeJson(res, 200, {
      ok: true,
      host: HOST,
      port: PORT,
      telemetryCount: telemetry.length,
      playSourceCacheSize: playSourceCache.size,
    });
    return;
  }

  if (requestUrl.pathname === '/__telemetry' && req.method === 'GET') {
    writeJson(res, 200, { items: telemetry.slice(-50) });
    return;
  }

  if (requestUrl.pathname === '/__telemetry' && req.method === 'POST') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        telemetry.push(payload);
        logLine(`telemetry ${payload.type ?? 'unknown'}`, payload);
        writeJson(res, 200, { ok: true });
      } catch (error) {
        writeJson(res, 400, {
          ok: false,
          message: error instanceof Error ? error.message : 'invalid telemetry payload',
        });
      }
    });
    return;
  }

  try {
    if (requestUrl.pathname === '/resolve' && req.method === 'GET') {
      const resolved = await resolveStructuredPlaySource(requestUrl.searchParams);
      writeJson(res, 200, {
        ok: true,
        bvid: resolved.bvid,
        cid: resolved.cid,
        requestedQuality: resolved.requestedQuality,
        actualQuality: resolved.actualQuality,
        format: resolved.format,
        candidateIndex: resolved.candidateIndex,
        candidateCount: resolved.candidateCount,
        playSourcePath: `/play-source?bvid=${encodeURIComponent(resolved.bvid)}&cid=${resolved.cid}&quality=${resolved.requestedQuality}&candidateIndex=${resolved.candidateIndex}`,
      });
      return;
    }

    if (requestUrl.pathname === '/play-source' && req.method === 'GET') {
      const resolved = await resolveStructuredPlaySource(requestUrl.searchParams);
      await proxyMediaTarget(req, res, resolved.target, {
        route: 'play-source',
        bvid: resolved.bvid,
        cid: resolved.cid,
        requestedQuality: resolved.requestedQuality,
        actualQuality: resolved.actualQuality,
        candidateIndex: resolved.candidateIndex,
      });
      return;
    }

    if (requestUrl.pathname === '/media' && req.method === 'GET') {
      const target = normalizeTargetUrl(requestUrl.searchParams.get('url'));
      if (!target) {
        writeJson(res, 400, { ok: false, message: 'invalid media url' });
        return;
      }

      await proxyMediaTarget(req, res, target, { route: 'media' });
      return;
    }
  } catch (error) {
    logLine('proxy failed', error instanceof Error ? error.message : String(error));
    writeJson(res, 502, {
      ok: false,
      message: error instanceof Error ? error.message : 'proxy failed',
    });
    return;
  }

  writeJson(res, 404, { ok: false, message: 'not found' });
});

server.listen(PORT, HOST, () => {
  logLine(`listening on http://${HOST}:${PORT}`);
});

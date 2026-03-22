import { createServer } from 'node:http';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const DEFAULT_PORT = Number(process.env.WEBOS_SIMULATOR_MEDIA_PROXY_PORT ?? 19033);
const DEFAULT_HOST = process.env.WEBOS_SIMULATOR_MEDIA_PROXY_HOST ?? '127.0.0.1';
const BILIBILI_REFERER = 'https://www.bilibili.com/';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const ALLOWED_HOST_PATTERNS = [
  /\.bilivideo\.com$/iu,
  /\.bilivideo\.cn$/iu,
];

const args = process.argv.slice(2);
const port = readNumericArg('--port', DEFAULT_PORT);
const host = readStringArg('--host', DEFAULT_HOST);

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    const message = error instanceof Error ? error.message : '代理请求失败';
    response.writeHead(502, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    response.end(JSON.stringify({ ok: false, message }, null, 2));
  });
});

server.on('error', (error) => {
  if ('code' in error && error.code === 'EADDRINUSE') {
    console.log(`simulator media proxy 已存在: http://${host}:${port}`);
    process.exit(0);
  }

  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`simulator media proxy listening on http://${host}:${port}`);
});

async function handleRequest(request, response) {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port}`}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, buildCorsHeaders());
    response.end();
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    response.writeHead(200, {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: true, host, port }, null, 2));
    return;
  }

  if (request.method !== 'GET' || requestUrl.pathname !== '/media') {
    response.writeHead(404, {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: false, message: 'not found' }, null, 2));
    return;
  }

  const targetUrl = requestUrl.searchParams.get('url')?.trim();
  if (!targetUrl) {
    response.writeHead(400, {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: false, message: 'missing url' }, null, 2));
    return;
  }

  const upstreamUrl = new URL(targetUrl);
  if (!isAllowedMediaHost(upstreamUrl.host) || upstreamUrl.protocol !== 'https:') {
    response.writeHead(400, {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: false, message: 'unsupported upstream host' }, null, 2));
    return;
  }

  await proxyMediaRequest(upstreamUrl, request, response, 0);
}

function proxyMediaRequest(upstreamUrl, clientRequest, clientResponse, redirectDepth) {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 4) {
      reject(new Error('上游重定向次数过多'));
      return;
    }

    const clientAbort = () => {
      reject(new Error('客户端已断开连接'));
    };
    clientRequest.once('aborted', clientAbort);

    const transport = upstreamUrl.protocol === 'http:' ? httpRequest : httpsRequest;
    const upstreamRequest = transport(upstreamUrl, {
      method: 'GET',
      headers: buildUpstreamHeaders(clientRequest.headers),
    }, (upstreamResponse) => {
      clientRequest.off('aborted', clientAbort);

      const statusCode = upstreamResponse.statusCode ?? 502;
      const location = upstreamResponse.headers.location;
      if (statusCode >= 300 && statusCode < 400 && location) {
        upstreamResponse.resume();
        proxyMediaRequest(new URL(location, upstreamUrl), clientRequest, clientResponse, redirectDepth + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      clientResponse.writeHead(statusCode, buildResponseHeaders(upstreamResponse.headers));
      upstreamResponse.pipe(clientResponse);
      upstreamResponse.on('end', resolve);
      upstreamResponse.on('error', reject);
    });

    upstreamRequest.on('error', (error) => {
      clientRequest.off('aborted', clientAbort);
      reject(error);
    });

    upstreamRequest.end();
  });
}

function buildUpstreamHeaders(clientHeaders) {
  return {
    accept: clientHeaders.accept ?? '*/*',
    'accept-language': clientHeaders['accept-language'] ?? 'zh-CN,zh;q=0.9',
    range: clientHeaders.range ?? undefined,
    referer: BILIBILI_REFERER,
    'user-agent': BROWSER_USER_AGENT,
    origin: 'https://www.bilibili.com',
  };
}

function buildResponseHeaders(upstreamHeaders) {
  const headers = buildCorsHeaders();
  const allowedHeaders = [
    'accept-ranges',
    'access-control-allow-origin',
    'cache-control',
    'content-length',
    'content-range',
    'content-type',
    'date',
    'etag',
    'expires',
    'last-modified',
    'transfer-encoding',
  ];

  for (const name of allowedHeaders) {
    const value = upstreamHeaders[name];
    if (value !== undefined) {
      headers[name] = value;
    }
  }

  return headers;
}

function buildCorsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-headers': 'range,content-type',
    'access-control-expose-headers': 'accept-ranges,content-length,content-range,content-type',
  };
}

function isAllowedMediaHost(hostname) {
  return ALLOWED_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}

function readNumericArg(name, fallback) {
  const value = readStringArg(name);
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readStringArg(name, fallback = '') {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) {
    return fallback;
  }
  return args[index + 1];
}

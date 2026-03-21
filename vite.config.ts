import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const BILI_MEDIA_PREFIX = '/__bili_media/';
const SKIPPED_UPSTREAM_HEADERS = new Set([
  'access-control-allow-credentials',
  'access-control-allow-origin',
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

function createBiliProxy(prefix: string, target: string) {
  return {
    target,
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
    cookieDomainRewrite: 'localhost',
    configure: (proxy: {
      on: (event: string, handler: (proxyReq: {
        removeHeader: (name: string) => void;
        setHeader: (name: string, value: string) => void;
      }) => void) => void;
    }) => {
      proxy.on('proxyReq', (proxyReq) => {
        // 浏览器开发态会带上 localhost 的 Origin/Referer，B站接口会因此直接 403。
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
        proxyReq.setHeader('origin', 'https://www.bilibili.com');
        proxyReq.setHeader('referer', 'https://www.bilibili.com/');
        proxyReq.setHeader('user-agent', DESKTOP_UA);
      });
    },
  };
}

function copyUpstreamHeaders(upstream: Response, res: ServerResponse) {
  for (const [headerName, headerValue] of upstream.headers.entries()) {
    if (SKIPPED_UPSTREAM_HEADERS.has(headerName)) {
      continue;
    }
    res.setHeader(headerName, headerValue);
  }
}

function installBiliMediaMiddleware(server: ViteDevServer) {
  server.middlewares.use(async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (error?: unknown) => void,
  ) => {
    const requestUrl = req.url ?? '';
    if (!requestUrl.startsWith(BILI_MEDIA_PREFIX)) {
      next();
      return;
    }

    try {
      const encodedTarget = requestUrl.slice(BILI_MEDIA_PREFIX.length);
      const target = new URL(decodeURIComponent(encodedTarget));
      const rangeHeader = typeof req.headers.range === 'string' ? req.headers.range : undefined;

      const upstream = await fetch(target, {
        headers: {
          accept: '*/*',
          origin: 'https://www.bilibili.com',
          referer: 'https://www.bilibili.com/',
          'user-agent': DESKTOP_UA,
          ...(rangeHeader ? { range: rangeHeader } : {}),
        },
      });

      res.statusCode = upstream.status;
      copyUpstreamHeaders(upstream, res);
      res.setHeader('access-control-allow-origin', '*');
      res.setHeader('access-control-allow-credentials', 'false');

      if (!upstream.body) {
        res.end();
        return;
      }

      Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
      next(error);
    }
  });
}

const proxy = {
  '/__bili_api': createBiliProxy('/__bili_api', 'https://api.bilibili.com'),
  '/__bili_passport': createBiliProxy('/__bili_passport', 'https://passport.bilibili.com'),
  '/__bili_search': createBiliProxy('/__bili_search', 'https://s.search.bilibili.com'),
};

const biliMediaPlugin: Plugin = {
  name: 'bili-media-dev-middleware',
  configureServer(server) {
    installBiliMediaMiddleware(server);
  },
};

export default defineConfig({
  base: './',
  plugins: [react(), biliMediaPlugin],
  server: {
    proxy,
  },
  preview: {
    proxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

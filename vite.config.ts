import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const WEBOS_LEGACY_BUILD_TARGET = 'chrome79';

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

const proxy = {
  '/__bili_api': createBiliProxy('/__bili_api', 'https://api.bilibili.com'),
  '/__bili_passport': createBiliProxy('/__bili_passport', 'https://passport.bilibili.com'),
  '/__bili_search': createBiliProxy('/__bili_search', 'https://s.search.bilibili.com'),
};

export default defineConfig({
  base: './',
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 79'],
      renderModernChunks: false,
      modernPolyfills: false,
    }),
  ],
  server: {
    proxy,
  },
  preview: {
    proxy,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    cssTarget: WEBOS_LEGACY_BUILD_TARGET,
  },
});

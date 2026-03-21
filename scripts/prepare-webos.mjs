import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDir = resolve(root, 'dist');
const outputDir = resolve(root, 'build', 'webos');

function findLegacyAssetName(assetNames, pattern) {
  return assetNames.find((name) => pattern.test(name)) ?? null;
}

function ensureLegacyScript(html, marker, scriptTag) {
  return html.includes(marker) ? html : scriptTag(html);
}

function rewriteWebOsIndexToLegacy(dir) {
  const assetsDir = resolve(dir, 'assets');
  const indexFile = resolve(dir, 'index.html');

  if (!existsSync(assetsDir) || !existsSync(indexFile)) {
    return;
  }

  const assetNames = readdirSync(assetsDir);
  const legacyPolyfills = findLegacyAssetName(assetNames, /^polyfills-legacy-.*\.js$/u);
  const legacyEntry = findLegacyAssetName(assetNames, /^index-legacy-.*\.js$/u);

  if (!legacyPolyfills || !legacyEntry) {
    return;
  }

  let html = readFileSync(indexFile, 'utf8');
  html = html.replace(/<script type="module"[^>]*src="\.\/assets\/[^"]+"[^>]*><\/script>\s*/u, '');
  html = html.replace(/<link rel="modulepreload"[^>]*>\s*/gu, '');
  html = html.replace(/<script crossorigin src="\.\/assets\/(?:polyfills|index)-legacy-[^"]+\.js"><\/script>\s*/gu, '');

  html = ensureLegacyScript(
    html,
    'id="vite-legacy-polyfill"',
    (currentHtml) => currentHtml.replace(
      '<script src="./webOSTV.js"></script>',
      `<script src="./webOSTV.js"></script>\n    <script crossorigin id="vite-legacy-polyfill" src="./assets/${legacyPolyfills}"></script>`,
    ),
  );
  html = ensureLegacyScript(
    html,
    'id="vite-legacy-entry"',
    (currentHtml) => currentHtml.replace(
      '</body>',
      `    <script crossorigin id="vite-legacy-entry" data-src="./assets/${legacyEntry}">System.import(document.getElementById('vite-legacy-entry').getAttribute('data-src'))</script>\n  </body>`,
    ),
  );

  writeFileSync(indexFile, html);
}

if (!existsSync(distDir)) {
  throw new Error('dist 目录不存在，请先运行 npm run build');
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

cpSync(distDir, outputDir, { recursive: true });
cpSync(resolve(root, 'appinfo.json'), resolve(outputDir, 'appinfo.json'));
cpSync(resolve(root, 'public', 'icon.png'), resolve(outputDir, 'icon.png'));
cpSync(resolve(root, 'public', 'largeicon.png'), resolve(outputDir, 'largeicon.png'));
rewriteWebOsIndexToLegacy(outputDir);

console.log(`Prepared webOS app bundle at ${outputDir}`);

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDir = resolve(root, 'dist');
const outputDir = resolve(root, 'build', 'webos');

const rewriteWebOsIndexToLegacy = (dir) => {
  const assetsDir = resolve(dir, 'assets');
  const indexFile = resolve(dir, 'index.html');

  if (!existsSync(assetsDir) || !existsSync(indexFile)) {
    return;
  }

  const assetNames = readdirSync(assetsDir);
  const legacyPolyfills = assetNames.find((name) => /^polyfills-legacy-.*\.js$/u.test(name));
  const legacyEntry = assetNames.find((name) => /^index-legacy-.*\.js$/u.test(name));

  if (!legacyPolyfills || !legacyEntry) {
    return;
  }

  let html = readFileSync(indexFile, 'utf8');
  html = html.replace(/<script type="module"[^>]*src="\.\/assets\/[^"]+"[^>]*><\/script>\s*/u, '');
  html = html.replace(/<link rel="modulepreload"[^>]*>\s*/gu, '');
  html = html.replace(
    '<script src="./webOSTV.js"></script>',
    `<script src="./webOSTV.js"></script>\n    <script crossorigin src="./assets/${legacyPolyfills}"></script>\n    <script crossorigin src="./assets/${legacyEntry}"></script>`,
  );

  writeFileSync(indexFile, html);
};

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

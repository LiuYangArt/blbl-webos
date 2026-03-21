import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDir = resolve(root, 'dist');
const outputDir = resolve(root, 'build', 'webos');

if (!existsSync(distDir)) {
  throw new Error('dist 目录不存在，请先运行 npm run build');
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

cpSync(distDir, outputDir, { recursive: true });
cpSync(resolve(root, 'appinfo.json'), resolve(outputDir, 'appinfo.json'));
cpSync(resolve(root, 'public', 'icon.png'), resolve(outputDir, 'icon.png'));
cpSync(resolve(root, 'public', 'largeicon.png'), resolve(outputDir, 'largeicon.png'));

console.log(`Prepared webOS app bundle at ${outputDir}`);

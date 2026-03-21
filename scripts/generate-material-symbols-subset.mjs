import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import subsetFont from 'subset-font';

const root = resolve(import.meta.dirname, '..');
const sourceFontPath = resolve(root, 'node_modules', 'material-symbols', 'material-symbols-rounded.woff2');
const symbolTypesPath = resolve(root, 'node_modules', 'material-symbols', 'index.d.ts');
const iconRegistryPath = resolve(root, 'src', 'app', 'iconRegistry.ts');
const outputCssPath = resolve(root, 'src', 'generated', 'material-symbols-rounded-subset.css');
const outputFontPath = resolve(root, 'src', 'generated', 'material-symbols-rounded-subset.woff2');

async function main() {
  const validSymbols = loadValidSymbols();
  const usedSymbols = loadRegisteredSymbols(validSymbols);

  if (usedSymbols.length === 0) {
    throw new Error('icon registry 里没有扫描到任何 Material Symbols 图标，请检查 src/app/iconRegistry.ts。');
  }

  const sourceBuffer = readFileSync(sourceFontPath);
  const ligatureText = usedSymbols.join(' ');
  const subsetBuffer = await subsetFont(sourceBuffer, ligatureText, {
    targetFormat: 'woff2',
    variationAxes: {
      FILL: { min: 0, max: 1, default: 0 },
      wght: { min: 500, max: 600, default: 500 },
      GRAD: 0,
      opsz: 48,
    },
  });

  mkdirSync(dirname(outputCssPath), { recursive: true });
  writeFileSync(outputFontPath, subsetBuffer);
  writeFileSync(outputCssPath, buildCss());

  const sizeInKb = (statSync(outputFontPath).size / 1024).toFixed(2);
  console.log(`Generated Material Symbols subset with ${usedSymbols.length} icons (${sizeInKb} KB).`);
  console.log(`Icons: ${usedSymbols.join(', ')}`);
}

function loadValidSymbols() {
  const typeFile = readFileSync(symbolTypesPath, 'utf8');
  const symbolMatches = typeFile.matchAll(/"([^"]+)"/g);
  const symbols = new Set();

  for (const match of symbolMatches) {
    symbols.add(match[1]);
  }

  return symbols;
}

function loadRegisteredSymbols(validSymbols) {
  const source = readFileSync(iconRegistryPath, 'utf8');
  const values = Array.from(
    source.matchAll(/:\s*(['"])([^'"\r\n]+)\1/g),
    (match) => match[2],
  );

  const registeredSymbols = new Set();
  for (const value of values) {
    if (validSymbols.has(value)) {
      registeredSymbols.add(value);
    }
  }

  return [...registeredSymbols].sort();
}

function buildCss() {
  return `/* 自动生成：scripts/generate-material-symbols-subset.mjs */
@font-face {
  font-family: "Material Symbols Rounded";
  font-style: normal;
  font-weight: 500 600;
  font-display: block;
  src: url("./material-symbols-rounded-subset.woff2") format("woff2");
}

.material-symbols-rounded {
  font-family: "Material Symbols Rounded";
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "liga";
}
`;
}

await main();

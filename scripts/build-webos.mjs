import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const devMenuConfigFile = resolve(root, '_dev', 'dev-menu.config.bat');

function getConfigValue(name) {
  if (!existsSync(devMenuConfigFile)) {
    return undefined;
  }

  const content = readFileSync(devMenuConfigFile, 'utf8');
  const quotedMatch = content.match(new RegExp(`set\\s+"${name}=([^"\\r\\n]*)"`, 'i'));
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const plainMatch = content.match(new RegExp(`set\\s+${name}=([^\\r\\n]*)`, 'i'));
  return plainMatch?.[1]?.trim();
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const debugTelemetryUrl = getConfigValue('VITE_DEBUG_TELEMETRY_URL') ?? getConfigValue('DEBUG_TELEMETRY_URL');
const mediaProxyBase = getConfigValue('VITE_BILI_MEDIA_PROXY_BASE') ?? getConfigValue('MEDIA_PROXY_BASE');

const buildEnv = {
  ...process.env,
};

if (debugTelemetryUrl) {
  buildEnv.VITE_DEBUG_TELEMETRY_URL = debugTelemetryUrl;
}

if (mediaProxyBase) {
  console.log(`build:webos 已忽略旧媒体网关配置: ${mediaProxyBase}`);
} else {
  console.log('build:webos 当前不注入任何外部媒体网关配置。');
}

if (buildEnv.VITE_DEBUG_TELEMETRY_URL) {
  console.log(`build:webos 使用 telemetry: ${buildEnv.VITE_DEBUG_TELEMETRY_URL}`);
}

run('npm', ['run', 'build'], buildEnv);
run('node', ['./scripts/prepare-webos.mjs'], buildEnv);

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const devMenuConfigFile = resolve(root, '_dev', 'dev-menu.config.bat');
const appInfo = JSON.parse(readFileSync(resolve(root, 'appinfo.json'), 'utf8'));
const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '';
const globalNpmRoot = process.platform === 'win32'
  ? resolve(process.env.APPDATA ?? resolve(process.env.USERPROFILE ?? '', 'AppData', 'Roaming'), 'npm', 'node_modules')
  : capture(getCommandName('npm'), ['root', '-g']);
const novacomDevicesFile = process.platform === 'win32'
  ? resolve(
    process.env.APPDATA ?? resolve(process.env.USERPROFILE ?? '', 'AppData', 'Roaming'),
    '.webos',
    'tv',
    'novacom-devices.json',
  )
  : resolve(homeDir, '.webos', 'tv', 'novacom-devices.json');

const args = process.argv.slice(2);
const inputUrl = readArg('--url', '').trim();
const inputBvid = readArg('--bvid', '').trim() || extractBvid(inputUrl) || '';
const inputCid = Number(readArg('--cid', '0'));
const device = readArg('--device', process.env.WEBOS_DEVICE ?? getConfigValue('DEVICE') ?? 'lgtv');
const waitMs = clampNumber(readArg('--wait-ms', '30000'), 3000, 120000, 30000);
const telemetryPort = clampNumber(readArg('--telemetry-port', '19080'), 0, 65535, 19080);
const explicitHostIp = readArg('--host-ip', '').trim();
const disableTelemetry = hasFlag('--no-telemetry');
const launchOnly = hasFlag('--launch-only');
const keepRunningApp = hasFlag('--keep-running-app');

async function main() {
  if (!inputBvid) {
    throw new Error('请通过 --url 或 --bvid 提供要调试的视频。');
  }

  const target = await resolveVideoTarget(inputBvid, inputCid);
  const tvHost = readDeviceHost(device);
  const hostIp = disableTelemetry ? null : (explicitHostIp || pickLocalIp(tvHost));
  const sessionId = buildSessionId(target.bvid);
  const logBase = resolve(root, '_dev', 'real-tv-debug', sessionId);
  const logFile = `${logBase}.ndjson`;
  const summaryFile = `${logBase}.summary.json`;

  let telemetryServer = null;
  let telemetryUrl = '';

  if (!disableTelemetry) {
    if (!hostIp) {
      throw new Error('未能自动推断电脑局域网 IP。可通过 --host-ip 手动指定。');
    }
    telemetryServer = await createTelemetrySession({
      host: '0.0.0.0',
      port: telemetryPort,
      localReadBaseUrl: `http://127.0.0.1:${telemetryPort}`,
      logFile,
    });
    telemetryUrl = `http://${hostIp}:${telemetryServer.port}/telemetry`;
  }

  try {
    const launchPayload = {
      route: 'player',
      bvid: target.bvid,
      cid: target.cid,
      title: target.title,
      part: target.part,
      debugTelemetryUrl: telemetryUrl || undefined,
    };

    console.log(`真机调试目标: ${target.bvid} / cid=${target.cid}`);
    console.log(`标题: ${target.title}${target.part ? ` / ${target.part}` : ''}`);
    console.log(`设备: ${device}${tvHost ? ` (${tvHost})` : ''}`);
    if (telemetryUrl) {
      console.log(`telemetry: ${telemetryUrl}`);
      console.log(`日志文件: ${logFile}`);
    }

    if (!launchOnly) {
      if (!keepRunningApp) {
        closeRunningApp(device);
      }
      runAresLaunch(device, launchPayload);
    } else {
      console.log('launch-only 已开启，本次只输出启动参数，不执行电视启动。');
    }

    const items = telemetryServer && !launchOnly
      ? await waitForTelemetryOutcome(telemetryServer, waitMs)
      : telemetryServer
        ? await telemetryServer.readItems()
        : [];
    const summary = buildTelemetrySummary({
      device,
      tvHost,
      hostIp,
      telemetryUrl,
      launchPayload,
      items,
    });

    ensureParentDir(summaryFile);
    writeFileSync(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(summary, null, 2));

    if (telemetryServer && !launchOnly && items.length === 0) {
      throw new Error(`在 ${waitMs}ms 内没有收到任何 telemetry 事件。`);
    }
  } finally {
    if (telemetryServer) {
      await telemetryServer.close();
    }
  }
}

async function resolveVideoTarget(bvid, preferredCid) {
  const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
  const response = await fetch(apiUrl, {
    headers: {
      referer: 'https://www.bilibili.com/',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`视频详情接口失败（${response.status}）`);
  }

  const payload = await response.json();
  if (Number(payload?.code ?? -1) !== 0 || !payload?.data) {
    throw new Error(`视频详情接口返回异常：${payload?.message ?? 'unknown error'}`);
  }

  const data = payload.data;
  const parts = Array.isArray(data.pages) ? data.pages : [];
  const matchedPart = preferredCid > 0
    ? parts.find((item) => Number(item?.cid ?? 0) === preferredCid)
    : null;
  const fallbackPart = parts[0] ?? null;
  const cid = preferredCid > 0
    ? preferredCid
    : Number(matchedPart?.cid ?? fallbackPart?.cid ?? data.cid ?? 0);

  if (!cid) {
    throw new Error(`未能为 ${bvid} 解析到有效 cid。`);
  }

  return {
    bvid: String(data.bvid ?? bvid),
    cid,
    title: String(data.title ?? bvid),
    part: String(matchedPart?.part ?? fallbackPart?.part ?? '').trim(),
  };
}

async function createTelemetrySession({ host, port, localReadBaseUrl, logFile }) {
  const existingItems = port > 0 ? await tryFetchTelemetryItems(`${localReadBaseUrl}/items`) : null;
  if (existingItems) {
    return {
      port,
      close: async () => {},
      readItems: async () => {
        const items = await fetchTelemetryItems(`${localReadBaseUrl}/items`);
        return items.slice(existingItems.length);
      },
    };
  }

  ensureParentDir(logFile);
  writeFileSync(logFile, '', 'utf8');
  const items = [];

  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${port || 0}`}`);

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
      response.end(JSON.stringify({ ok: true, count: items.length }, null, 2));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/telemetry') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          items.push(payload);
          appendFileSync(logFile, `${JSON.stringify(payload)}\n`, 'utf8');
          response.writeHead(200, {
            ...buildCorsHeaders(),
            'content-type': 'application/json; charset=utf-8',
          });
          response.end(JSON.stringify({ ok: true }, null, 2));
        } catch (error) {
          response.writeHead(400, {
            ...buildCorsHeaders(),
            'content-type': 'application/json; charset=utf-8',
          });
          response.end(JSON.stringify({
            ok: false,
            message: error instanceof Error ? error.message : 'invalid payload',
          }, null, 2));
        }
      });
      return;
    }

    response.writeHead(404, {
      ...buildCorsHeaders(),
      'content-type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify({ ok: false, message: 'not found' }, null, 2));
  });

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolvePromise);
  });

  const address = server.address();
  const resolvedPort = typeof address === 'object' && address ? address.port : port;
  appendFileSync(logFile, `${JSON.stringify({ type: 'server-started', host, port: resolvedPort, timestamp: new Date().toISOString() })}\n`, 'utf8');

  return {
    port: resolvedPort,
    readItems: async () => [...items],
    close: async () => new Promise((resolvePromise, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePromise(undefined);
      });
    }),
  };
}

async function waitForTelemetryOutcome(items, waitMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitMs) {
    const snapshot = await items.readItems();
    const hasOutcome = snapshot.some((item) => item?.type === 'progress' || item?.type === 'error' || item?.type === 'play');
    if (hasOutcome) {
      await delay(1200);
      return items.readItems();
    }
    await delay(500);
  }
  return items.readItems();
}

function buildTelemetrySummary({ device, tvHost, hostIp, telemetryUrl, launchPayload, items }) {
  const typeCounts = Object.create(null);
  for (const item of items) {
    const type = String(item?.type ?? 'unknown');
    typeCounts[type] = Number(typeCounts[type] ?? 0) + 1;
  }

  const latestEnvironment = [...items].reverse().find((item) => item?.type === 'environment') ?? null;
  const latestAttempt = [...items].reverse().find((item) => item?.type === 'attempt-switch') ?? null;
  const latestAttemptFailure = [...items].reverse().find((item) => item?.type === 'attempt-failure') ?? null;
  const latestError = [...items].reverse().find((item) => item?.type === 'error') ?? null;
  const latestPlay = [...items].reverse().find((item) => item?.type === 'play') ?? null;
  const latestProgress = [...items].reverse().find((item) => item?.type === 'progress') ?? null;

  return {
    device,
    tvHost,
    hostIp,
    telemetryUrl: telemetryUrl || null,
    launchPayload,
    telemetryCount: items.length,
    typeCounts,
    latestEnvironment,
    latestAttempt,
    latestAttemptFailure,
    latestPlay,
    latestProgress,
    latestError,
    result: latestProgress ? 'playing' : latestError ? 'error' : items.length > 0 ? 'partial' : 'no-telemetry',
  };
}

function runNodeScript(scriptPath, extraArgs) {
  const result = spawnSync(process.execPath, [resolve(root, scriptPath), ...extraArgs], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${scriptPath} 执行失败，退出码 ${result.status ?? 1}`);
  }
}

function resolveAresLaunchCliBin() {
  const cliBin = resolve(globalNpmRoot, '@webos-tools', 'cli', 'bin', 'ares-launch.js');

  if (!existsSync(cliBin)) {
    throw new Error('未找到 ares-launch.js，请先确认已全局安装 @webos-tools/cli。');
  }

  return cliBin;
}

function runAresLaunch(deviceName, launchPayload) {
  const cliBin = resolveAresLaunchCliBin();

  const cliArgs = ['-y', '-p', 'node@16', 'node', cliBin, String(appInfo.id), '-d', deviceName];
  for (const [key, rawValue] of Object.entries(launchPayload)) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }
    cliArgs.push('-p', `${key}=${String(rawValue)}`);
  }

  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', buildPowerShellCommand('npx.cmd', cliArgs)], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    })
    : spawnSync('npx', cliArgs, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`ares-launch 执行失败，退出码 ${result.status ?? 1}`);
  }
}

function closeRunningApp(deviceName) {
  const cliBin = resolveAresLaunchCliBin();
  const cliArgs = ['-y', '-p', 'node@16', 'node', cliBin, '-c', String(appInfo.id), '-d', deviceName];
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', buildPowerShellCommand('npx.cmd', cliArgs)], {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    })
    : spawnSync('npx', cliArgs, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
    });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`ares-launch 关闭应用失败，退出码 ${result.status ?? 1}`);
  }
}

function readDeviceHost(deviceName) {
  if (!existsSync(novacomDevicesFile)) {
    return '';
  }

  try {
    const devices = JSON.parse(readFileSync(novacomDevicesFile, 'utf8'));
    if (!Array.isArray(devices)) {
      return '';
    }
    const matched = devices.find((item) => String(item?.name ?? '') === deviceName);
    return String(matched?.host ?? '');
  } catch {
    return '';
  }
}

function pickLocalIp(tvHost) {
  const allIpv4 = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) {
        continue;
      }
      allIpv4.push(entry.address);
    }
  }

  if (allIpv4.length === 0) {
    return '';
  }

  if (isIpv4(tvHost)) {
    const tvPrefix = tvHost.split('.').slice(0, 3).join('.');
    const sameSubnet = allIpv4.find((ip) => ip.split('.').slice(0, 3).join('.') === tvPrefix);
    if (sameSubnet) {
      return sameSubnet;
    }
  }

  return allIpv4.find(isPrivateIpv4) ?? allIpv4[0] ?? '';
}

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

function extractBvid(input) {
  const matched = String(input ?? '').match(/BV[0-9A-Za-z]{10}/i);
  return matched ? matched[0] : '';
}

function buildSessionId(bvid) {
  return `${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')}-${sanitizeFilePart(bvid)}`;
}

function sanitizeFilePart(value) {
  return String(value ?? 'session').replace(/[^a-z0-9._-]+/gi, '-');
}

function buildPowerShellCommand(command, commandArgs) {
  return `& ${quotePowerShell(command)} ${commandArgs.map(quotePowerShell).join(' ')}`.trim();
}

function quotePowerShell(value) {
  return `'${String(value ?? '').replace(/'/g, "''")}'`;
}

function ensureParentDir(file) {
  const parent = dirname(file);
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
}

function buildCorsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) {
    return fallback;
  }
  return args[index + 1];
}

function hasFlag(name) {
  return args.includes(name);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function getCommandName(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const errorOutput = String(result.stderr ?? '').trim();
    throw new Error(`${command} ${args.join(' ')} 失败${errorOutput ? `：${errorOutput}` : ''}`);
  }

  return String(result.stdout ?? '').trim();
}

function isIpv4(value) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(String(value ?? ''));
}

function isPrivateIpv4(value) {
  const input = String(value ?? '');
  return input.startsWith('10.')
    || input.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./u.test(input);
}

async function tryFetchTelemetryItems(url) {
  try {
    return await fetchTelemetryItems(url);
  } catch {
    return null;
  }
}

async function fetchTelemetryItems(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`telemetry items 接口失败（${response.status}）`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

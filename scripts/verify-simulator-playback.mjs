import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createServer as createNetServer } from 'node:net';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = 'F:\\CodeProjects\\bilibili_webos';
const HOST = '127.0.0.1';
const POPULAR_API = 'https://api.bilibili.com/x/web-interface/popular?pn=1&ps=1';
const IS_WINDOWS = process.platform === 'win32';
const OVERRIDE_BVID = process.env.VERIFY_PLAYER_BVID?.trim() ?? '';
const OVERRIDE_CID = Number(process.env.VERIFY_PLAYER_CID ?? 0);
const OVERRIDE_TITLE = process.env.VERIFY_PLAYER_TITLE?.trim() ?? '';
const OVERRIDE_PART = process.env.VERIFY_PLAYER_PART?.trim() ?? '';

function getCommandName(name) {
  return IS_WINDOWS ? `${name}.cmd` : name;
}

function quoteArg(value) {
  if (value.length === 0) {
    return '""';
  }
  if (!/[\s"]/u.test(value)) {
    return value;
  }
  return `"${value.replace(/"/g, '\\"')}"`;
}

function runCommand(command, args, options = {}) {
  let result;
  if (IS_WINDOWS) {
    const commandLine = [command, ...args].map(quoteArg).join(' ');
    result = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', commandLine], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: false,
      ...options,
    });
  } else {
    result = spawnSync(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: false,
      ...options,
    });
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
}

async function pickFreePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, HOST, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(undefined);
    });
  });
  if (!port) {
    throw new Error('未能分配 telemetry 端口');
  }
  return port;
}

async function fetchSampleVideo() {
  if (OVERRIDE_BVID && OVERRIDE_CID > 0 && OVERRIDE_TITLE) {
    return {
      bvid: OVERRIDE_BVID,
      cid: OVERRIDE_CID,
      title: OVERRIDE_TITLE,
      part: OVERRIDE_PART,
    };
  }

  const response = await fetch(POPULAR_API);
  if (!response.ok) {
    throw new Error(`热门视频接口失败（${response.status}）`);
  }

  const payload = await response.json();
  const item = payload?.data?.list?.[0];
  if (!item?.bvid || !item?.cid || !item?.title) {
    throw new Error('未拿到可用于模拟器验证的视频样本');
  }

    return {
      bvid: String(item.bvid),
      cid: Number(item.cid),
      title: String(item.title),
      part: '',
    };
}

async function createTelemetryServer(port) {
  const items = [];
  const server = createServer((req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? `${HOST}:${port}`}`);

    if (req.method === 'GET' && requestUrl.pathname === '/health') {
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      });
      res.end(JSON.stringify({ ok: true, count: items.length }, null, 2));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/items') {
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
      });
      res.end(JSON.stringify({ items }, null, 2));
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      res.end();
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/telemetry') {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          items.push(payload);
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
          });
          res.end(JSON.stringify({ ok: true }, null, 2));
        } catch (error) {
          res.writeHead(400, {
            'content-type': 'application/json; charset=utf-8',
            'access-control-allow-origin': '*',
          });
          res.end(JSON.stringify({
            ok: false,
            message: error instanceof Error ? error.message : 'invalid payload',
          }, null, 2));
        }
      });
      return;
    }

    res.writeHead(404, {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
    });
    res.end(JSON.stringify({ ok: false, message: 'not found' }, null, 2));
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, resolve);
  });

  return {
    items,
    close: async () => new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(undefined);
      });
    }),
  };
}

async function main() {
  const port = await pickFreePort();
  const telemetryUrl = `http://${HOST}:${port}/telemetry`;
  const telemetryServer = await createTelemetryServer(port);

  try {
    const sample = await fetchSampleVideo();
    console.log('模拟器验证样本：', sample);
    console.log('telemetry:', telemetryUrl);

    const env = {
      ...process.env,
      VITE_BOOT_ROUTE: 'player',
      VITE_BOOT_PLAYER_BVID: sample.bvid,
      VITE_BOOT_PLAYER_CID: String(sample.cid),
      VITE_BOOT_PLAYER_TITLE: sample.title,
      VITE_BOOT_PLAYER_PART: sample.part ?? '',
      VITE_DEBUG_TELEMETRY_URL: telemetryUrl,
    };

    runCommand(getCommandName('npm'), ['run', 'build:webos'], { env });
    runCommand('node', ['.\\scripts\\webos-cli.mjs', 'simulator']);

    console.log('等待 Simulator 回传 telemetry...');
    await delay(30000);

    console.log(JSON.stringify({ telemetryCount: telemetryServer.items.length, items: telemetryServer.items }, null, 2));

    const hasProgress = telemetryServer.items.some((item) => item?.type === 'progress');
    if (hasProgress) {
      console.log('Simulator 播放验证成功');
      return;
    }

    throw new Error('未收到 progress 事件，Simulator 播放验证失败');
  } finally {
    await telemetryServer.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

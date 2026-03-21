import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import process from 'node:process';

const ROOT = 'F:\\CodeProjects\\bilibili_webos';
const GATEWAY_HOST = '127.0.0.1';
const POPULAR_API = 'https://api.bilibili.com/x/web-interface/popular?pn=1&ps=1';
const IS_WINDOWS = process.platform === 'win32';

function getCommandName(name) {
  return IS_WINDOWS ? `${name}.cmd` : name;
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
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, GATEWAY_HOST, resolve);
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
    throw new Error('未能分配媒体网关端口');
  }
  return port;
}

function startGateway(port) {
  const child = spawn('node', ['.\\scripts\\media-gateway.mjs'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
    shell: false,
    env: {
      ...process.env,
      BILI_MEDIA_GATEWAY_HOST: GATEWAY_HOST,
      BILI_MEDIA_GATEWAY_PORT: String(port),
    },
  });
  child.unref();
  return child.pid;
}

function stopGateway(pid) {
  if (!pid) {
    return;
  }

  try {
    process.kill(pid);
  } catch {
    // 网关已经退出时不需要额外处理。
  }
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

async function waitForGateway(gatewayUrl) {
  for (let index = 0; index < 10; index += 1) {
    try {
      const response = await fetch(`${gatewayUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // 网关尚未就绪时继续轮询。
    }
    await delay(1000);
  }

  throw new Error('媒体网关启动超时');
}

async function fetchSampleVideo() {
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
    title: '模拟器验证视频',
  };
}

async function fetchTelemetry(telemetryUrl) {
  const response = await fetch(telemetryUrl);
  if (!response.ok) {
    throw new Error(`读取 telemetry 失败（${response.status}）`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

async function main() {
  const gatewayPort = await pickFreePort();
  const gatewayUrl = `http://${GATEWAY_HOST}:${gatewayPort}`;
  const telemetryUrl = `${gatewayUrl}/__telemetry`;
  const gatewayPid = startGateway(gatewayPort);

  try {
    console.log(`媒体网关已启动，PID=${gatewayPid}，PORT=${gatewayPort}`);
    await waitForGateway(gatewayUrl);

    const sampleVideo = await fetchSampleVideo();
    console.log('使用验证样本：', sampleVideo);

    const env = {
      ...process.env,
      VITE_BOOT_ROUTE: 'player',
      VITE_BOOT_PLAYER_BVID: sampleVideo.bvid,
      VITE_BOOT_PLAYER_CID: String(sampleVideo.cid),
      VITE_BOOT_PLAYER_TITLE: sampleVideo.title,
      VITE_BILI_MEDIA_PROXY_BASE: `${gatewayUrl}/play-source?bvid={bvid}&cid={cid}&quality={quality}&candidateIndex={candidateIndex}`,
      VITE_DEBUG_TELEMETRY_URL: telemetryUrl,
    };

    runCommand(getCommandName('npm'), ['run', 'build:webos'], { env });
    runCommand('node', ['.\\scripts\\webos-cli.mjs', 'simulator']);

    console.log('等待模拟器回传 telemetry...');
    await delay(20000);

    const items = await fetchTelemetry(telemetryUrl);
    console.log(JSON.stringify({ telemetryCount: items.length, items }, null, 2));

    if (items.some((item) => item?.type === 'play')) {
      console.log('模拟器代理验证成功：已收到 play 事件');
      return;
    }

    throw new Error('模拟器代理验证失败：未收到 play 事件');
  } finally {
    stopGateway(gatewayPid);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

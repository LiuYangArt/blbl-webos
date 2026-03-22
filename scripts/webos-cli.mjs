import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const buildDir = resolve(root, 'build', 'webos');
const devMenuConfigFile = resolve(root, '_dev', 'dev-menu.config.bat');
const appInfo = JSON.parse(readFileSync(resolve(root, 'appinfo.json'), 'utf8'));
const appId = appInfo.id;
const appMain = appInfo.main ?? 'index.html';
const packageFile = resolve(root, `${appInfo.id}_${appInfo.version}_all.ipk`);
const installedAppMainFile = `/media/developer/apps/usr/palm/applications/${appId}/${appMain}`;

const [, , action, ...restArgs] = process.argv;
const isWindows = process.platform === 'win32';

const getCommandName = (name) => (isWindows ? `${name}.cmd` : name);
const quoteArg = (value) => {
  if (value.length === 0) {
    return '""';
  }

  if (!/[\s"]/u.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
};

const runProcess = (command, args, options) => {
  if (isWindows) {
    const commandLine = [command, ...args].map(quoteArg).join(' ');
    return spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', commandLine], options);
  }

  return spawnSync(command, args, options);
};

const getArg = (name, fallback) => {
  const index = restArgs.indexOf(name);
  if (index >= 0 && restArgs[index + 1]) {
    return restArgs[index + 1];
  }
  return fallback;
};

const buildLaunchParamsArgs = (value) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return [];
  }

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed).flatMap(([key, rawValue]) => {
        if (rawValue === undefined || rawValue === null || rawValue === '') {
          return [];
        }
        const serialized = typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue);
        return ['--params', `${key}=${serialized}`];
      });
    }
  } catch {
    // 允许直接透传已有的 key=value 或 CLI 原生参数串。
  }

  return ['--params', normalized];
};

const getConfigValue = (name) => {
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
};

const device = getArg('--device', process.env.WEBOS_DEVICE ?? getConfigValue('DEVICE') ?? 'tv');
const simulatorVersion = getArg('--simulator-version', process.env.WEBOS_SIMULATOR_VERSION ?? getConfigValue('SIMULATOR_VERSION') ?? '25');
const simulatorPath = getArg('--simulator-path', process.env.WEBOS_SIMULATOR_PATH ?? getConfigValue('SIMULATOR_PATH') ?? '');
const simulatorParams = getArg('--params', '{}');
const launchParams = getArg('--params', '');
const simulatorMediaProxyPort = getArg('--media-proxy-port', process.env.WEBOS_SIMULATOR_MEDIA_PROXY_PORT ?? '19033');
const installWaitMsRaw = getArg('--wait-ms', process.env.WEBOS_INSTALL_WAIT_MS ?? '8000');

const run = (command, args, options = {}) => {
  const result = runProcess(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const runDetached = (command, args, options = {}) => {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    shell: false,
    ...options,
  });

  child.unref();
};

const sleep = (ms) => new Promise((resolveSleep) => {
  setTimeout(resolveSleep, ms);
});

const parseWaitMs = (value) => {
  const waitMs = Number(value);
  if (!Number.isFinite(waitMs) || waitMs < 0) {
    throw new Error(`--wait-ms 必须是大于等于 0 的毫秒数，当前收到: ${value}`);
  }
  return waitMs;
};

const capture = (command, args) => {
  const result = runProcess(command, args, {
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(stderr || `${command} failed with exit code ${result.status ?? 1}`);
  }

  return result.stdout.trim();
};

const globalNpmRoot = isWindows
  ? resolve(process.env.APPDATA ?? resolve(process.env.USERPROFILE ?? '', 'AppData', 'Roaming'), 'npm', 'node_modules')
  : capture(getCommandName('npm'), ['root', '-g']);
const cliPackageDir = resolve(globalNpmRoot, '@webos-tools', 'cli');
const cliBinDir = resolve(cliPackageDir, 'bin');

const resolveCliBin = (name) => resolve(cliBinDir, `${name}.js`);

const resolveSimulatorExecutable = (path, version) => {
  if (!path) {
    throw new Error('未设置 Simulator 路径。请通过 --simulator-path 传入，或设置环境变量 WEBOS_SIMULATOR_PATH');
  }

  const entries = readdirSync(path, { withFileTypes: true });
  const preferredPrefix = `webOS_TV_${version}_Simulator_`;
  const executable = entries.find(
    (entry) =>
      entry.isFile() &&
      entry.name.startsWith(preferredPrefix) &&
      entry.name.endsWith(isWindows ? '.exe' : ''),
  ) ?? entries.find((entry) => entry.isFile() && entry.name.includes('Simulator') && (!isWindows || entry.name.endsWith('.exe')));

  if (!executable) {
    throw new Error(`在 ${path} 中未找到 Simulator 可执行文件`);
  }

  return resolve(path, executable.name);
};

const ensureCliInstalled = () => {
  if (!existsSync(cliPackageDir)) {
    throw new Error('未检测到 @webos-tools/cli 全局安装。请先执行 npm install -g @webos-tools/cli');
  }
};

const runCliWithNode16 = (name, args) => {
  ensureCliInstalled();
  const cliBin = resolveCliBin(name);

  if (!existsSync(cliBin)) {
    throw new Error(`未找到 ${name}.js，请检查 @webos-tools/cli 安装是否完整`);
  }

  run(getCommandName('npx'), ['-y', '-p', 'node@16', 'node', cliBin, ...args]);
};

const runCliWithNode16AllowFailure = (name, args) => {
  ensureCliInstalled();
  const cliBin = resolveCliBin(name);

  if (!existsSync(cliBin)) {
    throw new Error(`未找到 ${name}.js，请检查 @webos-tools/cli 安装是否完整`);
  }

  const result = runProcess(getCommandName('npx'), ['-y', '-p', 'node@16', 'node', cliBin, ...args], {
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 0;
};

const captureCliWithNode16 = (name, args) => {
  ensureCliInstalled();
  const cliBin = resolveCliBin(name);

  if (!existsSync(cliBin)) {
    throw new Error(`未找到 ${name}.js，请检查 @webos-tools/cli 安装是否完整`);
  }

  return capture(getCommandName('npx'), ['-y', '-p', 'node@16', 'node', cliBin, ...args]);
};

const ensureBuildPrepared = () => {
  if (!existsSync(buildDir)) {
    throw new Error('未找到 build/webos，请先运行 npm run build:webos');
  }
};

const ensurePackageReady = () => {
  if (!existsSync(packageFile)) {
    throw new Error('未找到 IPK 包，请先运行 npm run webos:package');
  }
};

const extractEntryScriptName = (html, sourceLabel) => {
  const match = html.match(/(?:assets\/)?(index(?:-legacy)?-[^"'\s>]+\.js)/u);
  if (!match?.[1]) {
    throw new Error(`${sourceLabel} 中未找到 index 入口脚本`);
  }
  return match[1];
};

const getLocalEntryScriptName = () => {
  ensureBuildPrepared();
  const localAppMainFile = resolve(buildDir, appMain);
  if (!existsSync(localAppMainFile)) {
    throw new Error(`本地构建产物缺少入口文件: ${localAppMainFile}`);
  }

  const html = readFileSync(localAppMainFile, 'utf8');
  return extractEntryScriptName(html, `本地入口文件 ${localAppMainFile}`);
};

const getInstalledEntryScriptName = () => {
  try {
    const html = captureCliWithNode16('ares-novacom', ['--device', device, '--run', `cat ${installedAppMainFile}`]);
    return extractEntryScriptName(html, `电视入口文件 ${installedAppMainFile}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `无法读取电视上的已安装入口文件（device=${device}）。请先确认电视已唤醒、Developer Mode 会话仍有效，且设备 IP/端口可连通。原始错误: ${message}`,
    );
  }
};

const verifyInstalledEntry = () => {
  const localEntry = getLocalEntryScriptName();
  console.log(`本地入口: ${localEntry}`);
  const installedEntry = getInstalledEntryScriptName();
  console.log(`电视入口: ${installedEntry}`);

  if (localEntry !== installedEntry) {
    throw new Error(
      `电视安装内容仍不是当前构建。本地入口=${localEntry}，电视入口=${installedEntry}。请优先升 appinfo.json 版本后重新 package + reinstall。`,
    );
  }

  console.log('电视实际入口与本地构建一致。');
  return { localEntry, installedEntry };
};

const packageApp = () => {
  ensureBuildPrepared();
  runCliWithNode16('ares-package', ['--no-minify', buildDir]);
};

const installPackage = () => {
  ensurePackageReady();
  runCliWithNode16('ares-install', ['--device', device, packageFile]);
};

const reinstallPackage = () => {
  ensurePackageReady();

  const removeStatus = runCliWithNode16AllowFailure('ares-install', ['--device', device, '--remove', appId]);
  if (removeStatus === 0) {
    console.log(`已先卸载旧包: ${appId}`);
  } else {
    console.log(`旧包卸载返回状态 ${removeStatus}，继续安装新包。`);
  }

  runCliWithNode16('ares-install', ['--device', device, packageFile]);
};

const launchApp = () => {
  const cliArgs = ['--device', device];
  cliArgs.push(...buildLaunchParamsArgs(launchParams));
  cliArgs.push(appId);
  runCliWithNode16('ares-launch', cliArgs);
};

switch (action) {
  case 'doctor': {
    ensureCliInstalled();
    console.log(`@webos-tools/cli: ok (${cliPackageDir})`);
    console.log('node16-runner: npx -p node@16');
    console.log(`ares-package: ${existsSync(resolveCliBin('ares-package')) ? 'ok' : 'missing'}`);
    console.log(`ares-install: ${existsSync(resolveCliBin('ares-install')) ? 'ok' : 'missing'}`);
    console.log(`ares-launch: ${existsSync(resolveCliBin('ares-launch')) ? 'ok' : 'missing'}`);
    console.log(`ares-novacom: ${existsSync(resolveCliBin('ares-novacom')) ? 'ok' : 'missing'}`);
    break;
  }
  case 'package': {
    packageApp();
    break;
  }
  case 'install': {
    installPackage();
    break;
  }
  case 'reinstall': {
    reinstallPackage();
    break;
  }
  case 'launch': {
    launchApp();
    break;
  }
  case 'verify-installed-entry': {
    verifyInstalledEntry();
    break;
  }
  case 'deploy': {
    const installWaitMs = parseWaitMs(installWaitMsRaw);
    packageApp();
    reinstallPackage();

    if (installWaitMs > 0) {
      console.log(`等待电视完成写盘与索引刷新: ${installWaitMs}ms`);
      await sleep(installWaitMs);
    }

    verifyInstalledEntry();
    launchApp();
    break;
  }
  case 'list': {
    runCliWithNode16('ares-install', ['--device', device, '--list']);
    break;
  }
  case 'remove': {
    runCliWithNode16('ares-install', ['--device', device, '--remove', appId]);
    break;
  }
  case 'hosted': {
    ensureBuildPrepared();
    runCliWithNode16('ares-launch', ['-H', buildDir, '-d', device]);
    break;
  }
  case 'simulator': {
    ensureBuildPrepared();

    runDetached(process.execPath, [resolve(root, 'scripts', 'simulator-media-proxy.mjs'), '--port', simulatorMediaProxyPort], {
      cwd: root,
    });

    const simulatorExecutable = resolveSimulatorExecutable(simulatorPath, simulatorVersion);
    runDetached(simulatorExecutable, [buildDir, simulatorParams], {
      cwd: simulatorPath,
    });
    console.log(`已启动 Simulator ${simulatorVersion}: ${simulatorExecutable}`);
    console.log(`应用目录: ${buildDir}`);
    console.log(`启动参数: ${simulatorParams}`);
    console.log(`媒体代理: http://127.0.0.1:${simulatorMediaProxyPort}`);
    break;
  }
  default: {
    console.log(
      'Usage: node ./scripts/webos-cli.mjs <doctor|package|install|reinstall|verify-installed-entry|deploy|launch|list|remove|hosted|simulator> [--device tv] [--params <json>] [--wait-ms 8000] [--simulator-version 25] [--simulator-path <path>]',
    );
  }
}

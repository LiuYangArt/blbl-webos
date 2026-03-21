import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const buildDir = resolve(root, 'build', 'webos');
const devMenuConfigFile = resolve(root, '_dev', 'dev-menu.config.bat');
const appInfo = JSON.parse(readFileSync(resolve(root, 'appinfo.json'), 'utf8'));
const appId = appInfo.id;
const packageFile = resolve(root, `${appInfo.id}_${appInfo.version}_all.ipk`);

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

switch (action) {
  case 'doctor': {
    ensureCliInstalled();
    console.log(`@webos-tools/cli: ok (${cliPackageDir})`);
    console.log('node16-runner: npx -p node@16');
    console.log(`ares-package: ${existsSync(resolveCliBin('ares-package')) ? 'ok' : 'missing'}`);
    console.log(`ares-install: ${existsSync(resolveCliBin('ares-install')) ? 'ok' : 'missing'}`);
    console.log(`ares-launch: ${existsSync(resolveCliBin('ares-launch')) ? 'ok' : 'missing'}`);
    break;
  }
  case 'package': {
    if (!existsSync(buildDir)) {
      throw new Error('未找到 build/webos，请先运行 npm run build:webos');
    }
    runCliWithNode16('ares-package', ['--no-minify', buildDir]);
    break;
  }
  case 'install': {
    if (!existsSync(packageFile)) {
      throw new Error('未找到 IPK 包，请先运行 npm run webos:package');
    }
    runCliWithNode16('ares-install', ['--device', device, packageFile]);
    break;
  }
  case 'launch': {
    runCliWithNode16('ares-launch', ['--device', device, appId]);
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
    if (!existsSync(buildDir)) {
      throw new Error('未找到 build/webos，请先运行 npm run build:webos');
    }
    runCliWithNode16('ares-launch', ['-H', buildDir, '-d', device]);
    break;
  }
  case 'simulator': {
    if (!existsSync(buildDir)) {
      throw new Error('未找到 build/webos，请先运行 npm run build:webos');
    }

    const simulatorExecutable = resolveSimulatorExecutable(simulatorPath, simulatorVersion);
    runDetached(simulatorExecutable, [buildDir, simulatorParams], {
      cwd: simulatorPath,
    });
    console.log(`已启动 Simulator ${simulatorVersion}: ${simulatorExecutable}`);
    console.log(`应用目录: ${buildDir}`);
    console.log(`启动参数: ${simulatorParams}`);
    break;
  }
  default: {
    console.log('Usage: node ./scripts/webos-cli.mjs <doctor|package|install|launch|list|remove|hosted|simulator> [--device tv] [--simulator-version 25] [--simulator-path <path>]');
  }
}

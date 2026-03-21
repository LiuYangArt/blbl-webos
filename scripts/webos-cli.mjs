import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const buildDir = resolve(root, 'build', 'webos');
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

const device = getArg('--device', 'tv');

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
  default: {
    console.log('Usage: node ./scripts/webos-cli.mjs <doctor|package|install|launch|list|remove|hosted> [--device tv]');
  }
}

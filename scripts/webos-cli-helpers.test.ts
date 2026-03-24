import { describe, expect, it } from 'vitest';
import {
  createInstallPlan,
  parseJsonObjectArg,
  withSimulatorMediaProxyParam,
} from './webos-cli-helpers.mjs';

describe('webos-cli helpers', () => {
  it('更新安装只执行安装步骤，以尽量保留应用数据', () => {
    expect(createInstallPlan({
      strategy: 'update',
      device: 'tv',
      packageFile: 'app.ipk',
      appId: 'app.id',
    })).toEqual([
      {
        key: 'install',
        allowFailure: false,
        args: ['--device', 'tv', 'app.ipk'],
      },
    ]);
  });

  it('清洁重装会先卸载旧包再安装新包', () => {
    expect(createInstallPlan({
      strategy: 'clean',
      device: 'tv',
      packageFile: 'app.ipk',
      appId: 'app.id',
    })).toEqual([
      {
        key: 'remove',
        allowFailure: true,
        args: ['--device', 'tv', '--remove', 'app.id'],
      },
      {
        key: 'install',
        allowFailure: false,
        args: ['--device', 'tv', 'app.ipk'],
      },
    ]);
  });

  it('未知安装策略会直接抛错，避免脚本静默走错路径', () => {
    expect(() => createInstallPlan({
      strategy: 'unknown',
      device: 'tv',
      packageFile: 'app.ipk',
      appId: 'app.id',
    })).toThrow('未知安装策略: unknown');
  });

  it('空字符串参数会被解析为空对象，便于追加 simulator 默认参数', () => {
    expect(parseJsonObjectArg('')).toEqual({});
  });

  it('非 JSON 参数串保持原样，避免破坏已有 CLI 透传行为', () => {
    expect(parseJsonObjectArg('route=ui-debug')).toBeNull();
    expect(withSimulatorMediaProxyParam('route=ui-debug', '19033')).toBe('route=ui-debug');
  });

  it('simulator 启动参数会自动补上本地媒体代理地址', () => {
    expect(withSimulatorMediaProxyParam('{"route":"player"}', '19033')).toBe(
      '{"route":"player","mediaProxyOrigin":"http://127.0.0.1:19033"}',
    );
  });

  it('如果用户已经手动指定媒体代理地址，则保留原值不覆盖', () => {
    expect(
      withSimulatorMediaProxyParam(
        '{"route":"player","mediaProxyOrigin":"http://192.168.50.81:19091"}',
        '19033',
      ),
    ).toBe('{"route":"player","mediaProxyOrigin":"http://192.168.50.81:19091"}');
  });
});

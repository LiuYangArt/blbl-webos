import { describe, expect, it } from 'vitest';
import { createInstallPlan } from './webos-cli-helpers.mjs';

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
});

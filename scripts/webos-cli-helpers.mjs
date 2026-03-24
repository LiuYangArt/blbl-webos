export function createInstallPlan({ strategy, device, packageFile, appId }) {
  if (strategy === 'update') {
    return [
      {
        key: 'install',
        allowFailure: false,
        args: ['--device', device, packageFile],
      },
    ];
  }

  if (strategy === 'clean') {
    return [
      {
        key: 'remove',
        allowFailure: true,
        args: ['--device', device, '--remove', appId],
      },
      {
        key: 'install',
        allowFailure: false,
        args: ['--device', device, packageFile],
      },
    ];
  }

  throw new Error(`未知安装策略: ${strategy}`);
}

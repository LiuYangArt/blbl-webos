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

export function parseJsonObjectArg(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return {};
  }

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // 非 JSON 参数串保持原样透传。
  }

  return null;
}

export function withSimulatorMediaProxyParam(rawParams, port) {
  const parsed = parseJsonObjectArg(rawParams);
  if (!parsed) {
    return rawParams;
  }

  if (typeof parsed.mediaProxyOrigin === 'string' && parsed.mediaProxyOrigin.trim()) {
    return JSON.stringify(parsed);
  }

  return JSON.stringify({
    ...parsed,
    mediaProxyOrigin: `http://127.0.0.1:${port}`,
  });
}

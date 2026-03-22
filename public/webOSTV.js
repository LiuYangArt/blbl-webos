(function () {
  var existingWebOS = window.webOS || {};
  var userAgent = String((window.navigator && window.navigator.userAgent) || '').toLowerCase();
  var looksLikeRealWebOs = Boolean(window.PalmSystem) || userAgent.indexOf('web0s') >= 0 || userAgent.indexOf('smarttv') >= 0;

  function normalizeLaunchParams(raw) {
    if (!raw) {
      return null;
    }

    if (typeof raw === 'string') {
      return raw;
    }

    if (typeof raw === 'object') {
      try {
        return JSON.stringify(raw);
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  function syncLaunchParams() {
    var current = normalizeLaunchParams(window.launchParams);
    if (current) {
      window.launchParams = current;
      return;
    }

    var palmParams = normalizeLaunchParams(window.PalmSystem && window.PalmSystem.launchParams);
    if (palmParams) {
      window.launchParams = palmParams;
    }
  }

  function readLaunchParamsObject() {
    var raw = window.launchParams || (window.PalmSystem && window.PalmSystem.launchParams) || null;
    if (!raw) {
      return null;
    }

    if (typeof raw === 'object') {
      return raw;
    }

    if (typeof raw !== 'string') {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function reportBootScriptEvent() {
    var launchParams = readLaunchParamsObject();
    var telemetryUrl = launchParams && typeof launchParams.debugTelemetryUrl === 'string'
      ? launchParams.debugTelemetryUrl
      : '';

    if (!telemetryUrl) {
      return;
    }

    try {
      fetch(telemetryUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          type: 'boot-script',
          bvid: launchParams && typeof launchParams.bvid === 'string' ? launchParams.bvid : '',
          cid: launchParams && Number(launchParams.cid) > 0 ? Number(launchParams.cid) : 0,
          sourceUrl: '',
          quality: '',
          codec: '',
          sourceTypeLabel: 'public/webOSTV.js',
          message: '启动引导脚本已执行',
          details: {
            looksLikeRealWebOs: looksLikeRealWebOs,
            hasPalmSystem: Boolean(window.PalmSystem),
            launchParamKeys: launchParams ? Object.keys(launchParams) : [],
          },
          timestamp: new Date().toISOString(),
        }),
      }).catch(function () {
        return undefined;
      });
    } catch (error) {
      return undefined;
    }
  }

  function platformBack() {
    if (window.PalmSystem && typeof window.PalmSystem.platformBack === 'function') {
      window.PalmSystem.platformBack();
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    }
  }

  function defaultKeyboard() {
    return {
      isShowing: function () {
        return false;
      },
    };
  }

  function fetchAppRootPath() {
    return window.location.origin + '/';
  }

  syncLaunchParams();
  reportBootScriptEvent();

  if (looksLikeRealWebOs) {
    window.webOS = Object.assign({}, existingWebOS, {
      platformBack: existingWebOS.platformBack || platformBack,
      keyboard: existingWebOS.keyboard || defaultKeyboard(),
      fetchAppRootPath: existingWebOS.fetchAppRootPath || fetchAppRootPath,
    });
    return;
  }

  window.webOS = Object.assign({}, existingWebOS, {
    platformBack: existingWebOS.platformBack || platformBack,
    keyboard: existingWebOS.keyboard || defaultKeyboard(),
    deviceInfo: existingWebOS.deviceInfo || function (callback) {
      callback({
        modelName: 'browser-dev',
        sdkVersion: 'dev',
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      });
    },
    fetchAppRootPath: existingWebOS.fetchAppRootPath || fetchAppRootPath,
  });
})();

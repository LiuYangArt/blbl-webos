(function () {
  if (window.webOS) {
    return;
  }

  window.webOS = {
    platformBack: function () {
      if (window.PalmSystem && typeof window.PalmSystem.platformBack === 'function') {
        window.PalmSystem.platformBack();
        return;
      }

      if (window.history.length > 1) {
        window.history.back();
      }
    },
    keyboard: {
      isShowing: function () {
        return false;
      },
    },
    deviceInfo: function (callback) {
      callback({
        modelName: 'browser-dev',
        sdkVersion: 'dev',
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      });
    },
    fetchAppRootPath: function () {
      return window.location.origin + '/';
    },
  };
})();

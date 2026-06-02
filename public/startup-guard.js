(function () {
  var RELOAD_KEY = '__sgs_startup_reload__';
  var DEBOUNCE_MS = 60000;
  var TIMEOUT_MS = 25000;
  setTimeout(function () {
    try {
      var root = document.getElementById('root');
      var loader = root && root.querySelector('.initial-loader');
      if (!loader) return;
      var last = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
      if (Date.now() - last < DEBOUNCE_MS) return;
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      location.reload(true);
    } catch (e) {}
  }, TIMEOUT_MS);
})();

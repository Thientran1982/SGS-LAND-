(function () {
  // Inject no-transition style FIRST to prevent FOUC flash when applying initial dark/light theme.
  // Without this: dark-mode users see a white flash (#FAFAF8 → dark) on every page load
  // because critical.css has `transition: background-color 0.3s ease` on body.
  var noTrans = document.createElement('style');
  noTrans.id = 'sgs-no-transitions';
  noTrans.textContent = 'html,body{transition:none!important}';
  document.head.appendChild(noTrans);

  try {
    var localTheme = localStorage.getItem('sgs-theme');
    var sysTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = (localTheme === 'dark' || localTheme === 'light') ? localTheme : sysTheme;
    // Use ID selector for reliable single-tag targeting (no media-query ambiguity).
    var meta = document.getElementById('theme-color-meta') ||
               document.querySelector('meta[name="theme-color"]');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      if (meta) meta.setAttribute('content', '#0D1F33');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      if (meta) meta.setAttribute('content', '#1B3A5C');
    }
  } catch (e) {}
  try {
    var canonical = document.getElementById('canonical-url');
    if (canonical) canonical.setAttribute('href', window.location.origin);
    var ogUrl = document.getElementById('og-url');
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);
  } catch (e) {}
  try {
    var raw = localStorage.getItem('sgs_custom_theme');
    if (raw) {
      var ct = JSON.parse(raw);
      if (ct && ct.primaryColor) {
        var hex = ct.primaryColor;
        var m = /^#([a-fA-F0-9]{6})$/.exec(hex);
        if (m) {
          var r = parseInt(m[1].slice(0, 2), 16);
          var g = parseInt(m[1].slice(2, 4), 16);
          var b = parseInt(m[1].slice(4, 6), 16);
          var dr = Math.max(0, r - 28).toString(16).padStart(2, '0');
          var dg = Math.max(0, g - 28).toString(16).padStart(2, '0');
          var db = Math.max(0, b - 28).toString(16).padStart(2, '0');
          var lr = Math.min(255, r + 170).toString(16).padStart(2, '0');
          var lg = Math.min(255, g + 170).toString(16).padStart(2, '0');
          var lb = Math.min(255, b + 170).toString(16).padStart(2, '0');
          document.documentElement.style.setProperty('--primary-600', hex);
          document.documentElement.style.setProperty('--primary-hover', '#' + dr + dg + db);
          document.documentElement.style.setProperty('--primary-subtle', '#' + lr + lg + lb);
        }
      }
      if (ct && ct.fontFamily && ct.fontFamily !== 'Inter') {
        var fontUrls = {
          'Be Vietnam Pro': 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600;700;800&display=swap',
          'Plus Jakarta Sans': 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap',
          'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
          'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap'
        };
        var url = fontUrls[ct.fontFamily];
        if (url) {
          var link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = url;
          document.head.appendChild(link);
        }
        document.documentElement.style.setProperty('--custom-font', "'" + ct.fontFamily + "', sans-serif");
      }
      if (ct && ct.fontScale && ct.fontScale !== 'default') {
        var sizeMap = { compact: '13px', large: '17px' };
        var sz = sizeMap[ct.fontScale];
        if (sz) document.documentElement.style.setProperty('--custom-font-size', sz);
      }
      var bgRules = [];
      bgRules.push('--bg-app: #FFFFFF;');
      bgRules.push('--bg-sidebar: #FFFFFF;');
      bgRules.push('--bg-surface: #FFFFFF;');
      bgRules.push('--bg-elevated: #FFFFFF;');
      if (bgRules.length > 0) {
        var styleEl = document.createElement('style');
        styleEl.id = 'sgs-custom-theme-bg';
        styleEl.textContent = ':root.light { ' + bgRules.join(' ') + ' }';
        document.head.appendChild(styleEl);
      }
    }
  } catch (e) {}

  // Re-enable transitions after browser has painted with the correct initial theme.
  // Double rAF ensures the style has been committed before re-enabling.
  window.requestAnimationFrame(function() {
    window.requestAnimationFrame(function() {
      var el = document.getElementById('sgs-no-transitions');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  });
})();

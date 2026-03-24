(function () {
  try {
    var localTheme = localStorage.getItem('sgs_theme');
    var sysTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = (localTheme === 'dark' || localTheme === 'light') ? localTheme : sysTheme;
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#050505');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
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
    }
  } catch (e) {}
})();

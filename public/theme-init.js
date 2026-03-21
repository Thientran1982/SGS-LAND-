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
})();

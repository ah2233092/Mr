// Runs before first paint: apply the saved theme so there is no white flash.
(function () {
  var t = 'system';
  try { t = localStorage.getItem('theme') || 'system'; } catch (e) {}
  var dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();

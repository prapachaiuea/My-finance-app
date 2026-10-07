/* FinFlow — start-up, service worker, updates. Loaded last. */
(function (root) {
  'use strict';
  const { U, S, I18N, t, UI } = root;
  let reg = null, errShown = 0;

  function boot() {
    S.migrate();
    I18N.setLang(S.rawGet(S.K.lang) === 'en' ? 'en' : 'th');
    S.on('error', () => UI.toast(t('storage_full'), '⚠️', { ms: 6000 }));
    UI.applyTheme(); UI.applyLang();
    FFSettings.applyRecurring(false);
    try { history.replaceState({ p: 'home' }, ''); } catch (_) { }
    UI.go('home', { force: true, noPush: true });
    if (FFSettings.pinEnabled()) FFSettings.lock();
    // home-screen shortcuts: ?action=add | scan
    const act = new URLSearchParams(location.search).get('action');
    const deep = act || new URLSearchParams(location.search).get('page');       // ?action=add|scan (home-screen shortcuts) or ?page=<name>
    if (deep && document.getElementById('page-' + deep) && !FFSettings.pinEnabled()) { UI.go(deep); try { history.replaceState({ p: deep }, '', location.pathname); } catch (_) { } }
    S.requestPersist();
    registerSW();
    // a new day started while the app stayed open: add today's recurring items, refresh "today" labels
    let day = U.dateStr();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && U.dateStr() !== day) { day = U.dateStr(); FFSettings.applyRecurring(false); UI.applyLang(); UI.refresh(); } });
    root.addEventListener('error', e => { if (errShown++ < 2) UI.toast(t('error_generic'), '⚠️'); console.error(e.error || e.message); });
    root.addEventListener('unhandledrejection', e => { if (errShown++ < 2) UI.toast(t('error_generic'), '⚠️'); console.error(e.reason); });
  }

  /* ---------- service worker: offline use + safe updates ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || !(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
    navigator.serviceWorker.register('sw.js').then(r => {
      reg = r;
      r.addEventListener('updatefound', () => {
        const nw = r.installing; if (!nw) return;
        nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) UI.toast(t('update_found'), '⬇️', { ms: 5000, action: { label: t('retry') === 'ลองอีกครั้ง' ? 'รีโหลด' : 'Reload', fn: () => location.reload() } }); });
      });
    }).catch(() => { });
  }
  async function checkUpdate() {
    try {
      if (!reg && 'serviceWorker' in navigator) reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { const r = await fetch('js/version.js', { cache: 'no-store' }); const m = /FF_VERSION\s*=\s*'([^']+)'/.exec(await r.text()); if (m && m[1] !== root.FF_VERSION) { UI.toast(t('update_found'), '⬇️'); setTimeout(() => location.reload(), 900); } else UI.toast(t('update_none'), '✓'); return; }
      await reg.update();
      if (reg.installing || reg.waiting) { UI.toast(t('update_found'), '⬇️'); setTimeout(() => location.reload(), 1200); } else UI.toast(t('update_none'), '✓');
    } catch (_) { UI.toast(t('update_fail'), '⚠️'); }
  }
  root.FFApp = { checkUpdate };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);

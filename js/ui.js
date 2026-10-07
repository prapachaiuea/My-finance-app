/* FinFlow — UI core: navigation (with Android back-button support), toast/undo, confirm, bottom sheets, event delegation,
   shared renderers. Page modules register themselves with UI.page(name, {show}) and UI.act(name, fn). */
(function (root) {
  'use strict';
  const { U, S, C, I18N, t } = root;
  const $ = id => document.getElementById(id);
  const UI = { $, ACT: {}, PAGES: {}, hooks: { refresh: [] } };
  const now = new Date();
  UI.month = { y: now.getFullYear(), m: now.getMonth() };

  UI.act = (name, fn) => { UI.ACT[name] = fn; };
  UI.page = (name, def) => { UI.PAGES[name] = def; };

  /* ---------- navigation ---------- */
  const ROOT = ['home', 'scan', 'add', 'analytics', 'settings'];
  const PARENT = { all: 'home', goals: 'home', report: 'analytics', categories: 'settings', accounts: 'settings', recurring: 'settings', budgets: 'settings' };
  let current = 'home';
  UI.current = () => current;

  function show(p) {
    const next = $('page-' + p); if (!next) return false;
    const old = $('page-' + current);
    if (old && old !== next) { old.classList.remove('active'); old.classList.add('exit'); setTimeout(() => old.classList.remove('exit'), 300); }
    next.classList.add('active'); next.scrollTop = 0;
    current = p; if (p !== 'report') document.title = 'FinFlow';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.id === 'nav-' + (ROOT.includes(p) ? p : (PARENT[p] === 'settings' ? 'settings' : PARENT[p] || 'home'))));
    const d = UI.PAGES[p]; if (d && d.show) { try { d.show(); } catch (e) { console.error('page ' + p, e); } }
    return true;
  }
  UI.go = (p, opt) => {
    if (p === current && !(opt && opt.force)) { const d = UI.PAGES[p]; if (d && d.show) d.show(); return; }
    closeAllSheets(true);
    if (!show(p)) return;
    if (!(opt && opt.noPush)) { try { history.pushState({ p }, ''); } catch (_) { } }
  };
  UI.back = () => {
    if (openSheets.length) { closeSheet(openSheets[openSheets.length - 1]); return; }
    if (history.state && history.state.p && history.length > 1) { history.back(); return; }
    UI.go(PARENT[current] || 'home', { noPush: true });
  };
  root.addEventListener('popstate', e => {
    if (openSheets.length) { closeSheet(openSheets[openSheets.length - 1], true); try { history.pushState({ p: current }, ''); } catch (_) { } return; }
    const p = (e.state && e.state.p) || 'home';
    closeAllSheets(true); show(p);
  });
  UI.refresh = () => { const d = UI.PAGES[current]; if (d && d.show) d.show(); UI.hooks.refresh.forEach(f => { try { f(); } catch (_) { } }); };

  /* ---------- sheets ---------- */
  const openSheets = [];
  function openSheet(id) {
    const el = $(id); if (!el) return;
    el.classList.add('open');
    if (!openSheets.includes(id)) openSheets.push(id);       // no history entry: the Android back button is intercepted in the popstate handler instead
  }
  function closeSheet(id, fromPop) {
    const el = $(id); if (!el) return;
    el.classList.remove('open');
    const i = openSheets.indexOf(id); if (i >= 0) openSheets.splice(i, 1);
  }
  function closeAllSheets(silent) { openSheets.slice().forEach(id => { $(id).classList.remove('open'); }); openSheets.length = 0; }
  UI.openSheet = openSheet; UI.closeSheet = closeSheet;
  UI.act('closeSheet', (arg, el) => { const o = el.closest('[data-overlay]'); if (o) closeSheet(o.id); });
  document.addEventListener('click', e => { const o = e.target; if (o && o.hasAttribute && o.hasAttribute('data-overlay') && o.classList.contains('open')) closeSheet(o.id); });

  /* ---------- toast ---------- */
  let toastTimer;
  UI.toast = (msg, icon, opt) => {
    clearTimeout(toastTimer);
    $('toast-msg').textContent = msg; $('toast-icon').textContent = icon || '✓';
    const a = $('toast-action'); a.hidden = true; a.onclick = null;
    if (opt && opt.action) { a.textContent = opt.action.label; a.hidden = false; a.onclick = () => { $('toast').classList.remove('show'); clearTimeout(toastTimer); opt.action.fn(); }; }
    $('toast').classList.add('show');
    toastTimer = setTimeout(() => { $('toast').classList.remove('show'); if (opt && opt.onExpire) opt.onExpire(); }, (opt && opt.ms) || (opt && opt.action ? 6000 : 2500));
  };

  /* ---------- confirm (promise) ---------- */
  UI.confirm = (msg, okLabel, cancelLabel) => new Promise(res => {
    $('confirm-msg').textContent = msg; $('confirm-ok').textContent = okLabel || t('confirm'); $('confirm-cancel').textContent = cancelLabel || t('cancel');
    const ov = $('sheet-confirm'); ov.classList.add('open');
    const done = v => { ov.classList.remove('open'); $('confirm-ok').onclick = $('confirm-cancel').onclick = null; res(v); };
    $('confirm-ok').onclick = () => done(true); $('confirm-cancel').onclick = () => done(false);
  });

  /* ---------- event delegation ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest && e.target.closest('[data-act],[data-go]');
    if (!el) return;
    if (el.hasAttribute('data-go')) { UI.go(el.getAttribute('data-go')); return; }
    const fn = UI.ACT[el.getAttribute('data-act')];
    if (fn) { try { const r = fn(el.getAttribute('data-arg'), el, e); if (r && r.catch) r.catch(err => { console.error(err); UI.toast(t('error_generic'), '⚠️'); }); } catch (err) { console.error(err); UI.toast(t('error_generic'), '⚠️'); } }
  });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"]')) { e.preventDefault(); e.target.click(); }
    if (e.key === 'Escape' && openSheets.length) closeSheet(openSheets[openSheets.length - 1]);
  });
  UI.act('back', () => UI.back());

  /* ---------- theme / language ---------- */
  UI.isDark = () => S.rawGet(S.K.theme) !== 'light';
  UI.applyTheme = () => {
    const dark = UI.isDark();
    if (dark) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', 'light');
    const mc = document.querySelector('meta[name="theme-color"]'); if (mc) mc.content = dark ? '#0A0A0A' : '#F5F5F7';
    const b = $('theme-toggle'); if (b) { b.classList.toggle('on', dark); b.setAttribute('aria-checked', dark); }
    const i = $('theme-icon'); if (i) i.textContent = dark ? '🌙' : '☀️';
  };
  UI.act('toggleTheme', () => { try { localStorage.setItem(S.K.theme, UI.isDark() ? 'light' : 'dark'); } catch (_) { } UI.applyTheme(); });
  UI.applyLang = () => {
    I18N.apply(document);
    $('lang-th').classList.toggle('active', I18N.getLang() === 'th'); $('lang-en').classList.toggle('active', I18N.getLang() === 'en');
    const h = new Date().getHours(); $('home-greeting').textContent = h < 12 ? t('greet_m') : h < 17 ? t('greet_a') : t('greet_e');
    $('version-sub').textContent = t('version', { v: root.FF_VERSION });
  };
  UI.act('setLang', l => { I18N.setLang(l); try { localStorage.setItem(S.K.lang, l); } catch (_) { } UI.applyLang(); UI.refresh(); });

  /* ---------- month selection shared by Home / Analytics ---------- */
  UI.changeMonth = d => { let { y, m } = UI.month; m += d; if (m > 11) { m = 0; y++; } if (m < 0) { m = 11; y--; } UI.month = { y, m }; UI.refresh(); };
  UI.act('monthPrev', () => UI.changeMonth(-1)); UI.act('monthNext', () => UI.changeMonth(1));
  UI.isCurrentMonth = () => { const n = new Date(); return UI.month.y === n.getFullYear() && UI.month.m === n.getMonth(); };

  /* ---------- shared renderers ---------- */
  const esc = U.esc;
  UI.acctName = a => { const x = S.accts().find(z => z.id === a); return x ? (x.name || t('acct_main')) : t('acct_main'); };
  UI.acctOptions = (sel, withExternal) => S.accts().map(a => `<option value="${esc(a.id)}"${a.id === sel ? ' selected' : ''}>${esc(a.emoji)} ${esc(a.name || t('acct_main'))}</option>`).join('')
    + (withExternal ? `<option value=""${sel === '' ? ' selected' : ''}>↗ ${esc(t('acct_external'))}</option>` : '');
  UI.catOptions = (type, sel) => {
    const cats = S.cats(type === 'income' ? 'income' : 'expense');
    let html = cats.map(c => `<option value="${esc(c.name)}"${c.name === sel ? ' selected' : ''}>${esc(c.emoji)} ${esc(I18N.catLabel(c.name))}</option>`).join('');
    if (sel && !cats.some(c => c.name === sel)) html = `<option value="${esc(sel)}" selected>${esc(S.catEmoji(type, sel) || '📦')} ${esc(I18N.catLabel(sel))}</option>` + html;   // category deleted after use: keep it editable
    return html;
  };
  UI.catEmoji = (type, name) => S.catEmoji(type === 'income' ? 'income' : 'expense', name) || (type === 'income' ? '💰' : '📦');

  UI.dayLabel = ds => ds === U.dateStr() ? t('today') : ds === U.addDays(U.dateStr(), -1) ? t('yesterday') : I18N.weekday(ds) + ' ' + I18N.dateLabel(ds, { noYear: true });

  UI.txRow = (tx, opt) => {
    const multi = S.accts().length > 1;
    let meta = esc(I18N.catLabel(tx.cat) || (tx.type === 'transfer' ? t('transfer_cat') : '')) + (tx.time ? `<span class="dot">·</span>${esc(tx.time)}` : '');
    if (tx.type === 'transfer') meta = esc(t('transfer')) + (multi || tx.toAcct ? `<span class="dot">·</span>${esc(UI.acctName(tx.acct))} → ${tx.toAcct ? esc(UI.acctName(tx.toAcct)) : '↗'}` : '') + (tx.time ? `<span class="dot">·</span>${esc(tx.time)}` : '');
    else if (multi) meta += `<span class="dot">·</span>${esc(UI.acctName(tx.acct))}`;
    const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '';
    if (opt && opt.selMode) {                              // multi-select: a tick box instead of swipe
      const on = opt.sel && opt.sel.has(tx.id);
      return `<div class="tx-swipe"><div class="tx-item sel-row${on ? ' on' : ''}" data-id="${tx.id}" data-act="selPick" data-arg="${tx.id}" role="checkbox" aria-checked="${!!on}" tabindex="0"><span class="sel-box">${on ? '✓' : ''}</span><div class="tx-emoji ${tx.type}">${esc(tx.emoji || '💳')}</div><div class="tx-info"><div class="tx-name">${esc(tx.name || I18N.catLabel(tx.cat))}</div><div class="tx-meta">${meta}</div></div><div class="tx-right"><div class="tx-amount ${tx.type}">${sign}${U.fmt(tx.amount)}</div></div></div></div>`;
    }
    // .tx-swipe = clipping wrapper; .swipe-bg = red action layer revealed underneath; .tx-item = the card that slides
    return `<div class="tx-swipe" data-id="${tx.id}">
      <div class="swipe-bg" data-act="swipeDelete" data-arg="${tx.id}" role="button" aria-label="${esc(t('delete'))}"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg><span>${esc(t('swipe_delete'))}</span></div>
      <div class="tx-item" data-id="${tx.id}" data-act="openTx" data-arg="${tx.id}" role="button" tabindex="0">
        <div class="tx-emoji ${tx.type}">${esc(tx.emoji || '💳')}</div>
        <div class="tx-info"><div class="tx-name">${esc(tx.name || I18N.catLabel(tx.cat))}${tx.hasImg ? '<span class="tx-badge">🧾</span>' : ''}</div><div class="tx-meta">${meta}</div></div>
        <div class="tx-right"><div class="tx-amount ${tx.type}">${sign}${U.fmt(tx.amount)}</div></div>
      </div>
    </div>`;
  };
  UI.groupedList = (list, opt) => {
    const seen = [], g = {};
    list.forEach(x => { if (!g[x.date]) { g[x.date] = []; seen.push(x.date); } g[x.date].push(x); });
    return seen.map(d => {
      const day = g[d]; let net = 0; day.forEach(x => { if (x.type === 'income') net += Math.round(x.amount * 100); else if (x.type === 'expense') net -= Math.round(x.amount * 100); });
      net /= 100;
      return `<div class="tx-day-block"><div class="tx-day-hdr"><span class="tx-day-lbl">${esc(UI.dayLabel(d))}</span><span class="tx-day-net ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '−'}${U.fmt(net)}</span></div><div class="tx-day-items">${day.map(x => UI.txRow(x, opt)).join('')}</div></div>`;
    }).join('');
  };

  /* money inputs: digits + one dot, max 2 decimals */
  UI.moneyInput = el => {
    if (!el || el._money) return; el._money = true;
    el.addEventListener('input', () => {
      let v = el.value.replace(/,/g, '.').replace(/[^\d.]/g, ''); const i = v.indexOf('.');
      if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '').slice(0, 2);
      if (v !== el.value) el.value = v;
    });
  };
  UI.readMoney = el => { const v = U.parseMoney(el.value); return isNaN(v) ? NaN : v; };

  /* ---------- delete with undo + swipe ---------- */
  UI.deleteTx = id => {
    const tx = S.delTx(id); if (!tx) return;
    let undone = false;
    UI.toast(t('deleted'), '🗑️', { action: { label: t('undo'), fn: () => { undone = true; S.addTx(tx); UI.refresh(); } }, onExpire: () => { if (!undone && tx.hasImg) S.delImg(tx.id); } });
    UI.refresh();
  };
  /* Swipe a row left: it follows the finger and a red delete layer fades in behind it.
     - short swipe  -> snaps open (tap the red area to delete)
     - long swipe / quick flick -> deletes straight away (with Undo)
     - tap on an open row, scroll, or swipe right -> closes it.  Works with touch, pen and mouse (pointer events). */
  const OPEN = 92;                      // px the row slides to when "parked" open
  let openRow = null;                   // currently open .tx-item
  const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) { } };
  function setX(item, x, animate) {
    item.style.transition = animate ? 'transform .22s cubic-bezier(.2,.8,.2,1)' : 'none';
    item.style.transform = x ? `translateX(${x}px)` : '';
    const wrap = item.parentElement; if (wrap) wrap.style.setProperty('--p', Math.min(1, Math.abs(x) / OPEN).toFixed(3));
  }
  function closeSwipe() { if (openRow) { setX(openRow, 0, true); openRow.parentElement.classList.remove('open'); openRow = null; } }
  function collapseAndDelete(wrap, id) {
    const h = wrap.offsetHeight; wrap.style.height = h + 'px'; wrap.style.transition = 'height .22s ease, margin .22s ease, opacity .22s ease';
    requestAnimationFrame(() => { wrap.style.height = '0'; wrap.style.marginTop = wrap.style.marginBottom = '0'; wrap.style.opacity = '0'; });
    setTimeout(() => UI.deleteTx(id), 230);
  }
  UI.act('swipeDelete', (id, el) => { const wrap = el.closest('.tx-swipe'); openRow = null; if (wrap) collapseAndDelete(wrap, +id); else UI.deleteTx(+id); });

  UI.attachSwipe = container => {
    if (!container || container._swipe) return; container._swipe = true;
    let it = null, sx = 0, sy = 0, base = 0, x = 0, mode = '', lastT = 0, lastX = 0, vel = 0, W = 360, pid = null, armed = false;
    container.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const item = e.target.closest('.tx-item'); if (!item || e.target.closest('.swipe-bg')) return;
      if (openRow && openRow !== item) closeSwipe();
      it = item; sx = e.clientX; sy = e.clientY; base = openRow === item ? -OPEN : 0; x = base; mode = ''; vel = 0; lastX = e.clientX; lastT = e.timeStamp; pid = e.pointerId; armed = false;
      W = item.parentElement.offsetWidth || 360;
    });
    container.addEventListener('pointermove', e => {
      if (!it || e.pointerId !== pid) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!mode) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { mode = 'scroll'; return; }        // vertical = let the page scroll
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { mode = 'drag'; try { it.setPointerCapture(pid); } catch (_) { } it.classList.add('dragging'); }
        else return;
      }
      if (mode !== 'drag') return;
      const dt = e.timeStamp - lastT; if (dt > 0) vel = (e.clientX - lastX) / dt; lastX = e.clientX; lastT = e.timeStamp;
      x = Math.min(0, Math.max(-W, base + dx));
      if (x < -W * 0.55) x = -W * 0.55 + (x + W * 0.55) * 0.25;                                  // rubber-band past the delete point
      setX(it, x, false);
      const past = x <= -W * 0.5; if (past !== armed) { armed = past; it.parentElement.classList.toggle('armed', past); if (past) buzz(12); }
    });
    const end = e => {
      if (!it || (e && e.pointerId !== pid)) return;
      const item = it; it = null; item.classList.remove('dragging');
      if (mode !== 'drag') return;
      item._swiped = true; setTimeout(() => { item._swiped = false; }, 60);
      const wrap = item.parentElement; wrap.classList.remove('armed');
      if (x <= -W * 0.5 || (vel < -0.9 && x < -OPEN * 0.6)) { setX(item, -W, true); buzz(18); const id = +wrap.getAttribute('data-id'); setTimeout(() => collapseAndDelete(wrap, id), 120); openRow = null; }
      else if (x < -OPEN * 0.45 && vel < 0.4) { setX(item, -OPEN, true); wrap.classList.add('open'); openRow = item; }
      else { setX(item, 0, true); wrap.classList.remove('open'); if (openRow === item) openRow = null; }
    };
    container.addEventListener('pointerup', end); container.addEventListener('pointercancel', end);
    // a tap on an open row only closes it; a drag never counts as a tap
    container.addEventListener('click', e => {
      const item = e.target.closest('.tx-item'); if (!item || e.target.closest('.swipe-bg')) return;
      if (item._swiped || openRow === item) { e.stopPropagation(); e.preventDefault(); if (openRow === item) closeSwipe(); }
    }, true);
  };
  /* one-time hint: the first row nudges left and back so people discover the gesture */
  UI.peekSwipe = item => { if (!item) return; setX(item, -46, true); setTimeout(() => setX(item, 0, true), 650); };
  document.addEventListener('scroll', () => closeSwipe(), true);
  document.addEventListener('pointerdown', e => { if (openRow && !e.target.closest('.tx-swipe')) closeSwipe(); }, true);

  root.UI = UI;
})(window);

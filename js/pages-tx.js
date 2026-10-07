/* FinFlow — Home, Add, transaction detail/edit sheet, All-transactions. */
(function (root) {
  'use strict';
  const { U, S, C, I18N, t, UI, LRN } = root;
  const $ = UI.$, esc = U.esc;

  /* =========================================================== HOME */
  const MAX_DAYS_HOME = 5;
  function monthTxs() { return C.monthTx(S.txs(), UI.month.y, UI.month.m); }

  function homeBanners() {
    const el = $('home-banners'), p = S.prefs(), txs = S.txs(), out = [];
    const nowMs = Date.now();
    if (!(p.dismissBackupUntil > nowMs) && txs.length >= 10) {
      if (!p.lastBackup) out.push(['', t('backup_reminder_never'), 'backup', 'dismissBackup']);
      else { const days = Math.floor((nowMs - p.lastBackup) / 86400000); if (days >= 7 && p.txSinceBackup > 0) out.push(['', t('backup_reminder', { n: days }), 'backup', 'dismissBackup']); }
    }
    const standalone = root.matchMedia && (root.matchMedia('(display-mode: standalone)').matches || navigator.standalone);
    if (!standalone && !p.installDismissed && txs.length >= 5 && /iPhone|iPad|Android/i.test(navigator.userAgent)) out.push(['info', t('install_hint'), '', 'dismissInstall']);
    const bud = S.budgetTotal();
    if (bud && UI.isCurrentMonth()) { const sp = C.totals(monthTxs()).expense; if (sp > bud) out.push(['red', t('bud_total100'), 'goBudgetFix', '']); }
    el.innerHTML = out.map(([cls, msg, act, dis]) => `<div class="banner ${cls}" ${act ? `data-act="${act}"` : ''} role="button" tabindex="0"><span>${esc(msg)}</span>${dis ? `<button class="x" data-act="${dis}" aria-label="close">✕</button>` : ''}</div>`).join('');
  }
  UI.act('dismissBackup', (a, el, e) => { e.stopPropagation(); S.patchPrefs({ dismissBackupUntil: Date.now() + 2 * 86400000 }); homeBanners(); });
  UI.act('dismissInstall', (a, el, e) => { e.stopPropagation(); S.patchPrefs({ installDismissed: true }); homeBanners(); });
  UI.act('goBudgetFix', () => UI.go('settings'));

  function renderHome() {
    const { y, m } = UI.month, txs = S.txs(), mt = C.monthTx(txs, y, m), tot = C.totals(mt);
    $('home-date').textContent = I18N.weekday(U.dateStr(), true) + ' ' + I18N.dateLabel(U.dateStr(), { noYear: true });
    $('hero-month-label').textContent = I18N.monthLabelLong(y, m);
    const accts = S.accts(), bal = C.balances(txs, accts);
    const be = $('hero-balance'); be.textContent = Math.abs(bal.total).toLocaleString('en-US', { minimumFractionDigits: Math.round(Math.abs(bal.total) * 100) % 100 ? 2 : 0, maximumFractionDigits: 2 });
    be.style.color = bal.total < 0 ? 'var(--red)' : 'var(--text)';
    be.previousElementSibling.textContent = bal.total < 0 ? '−฿' : '฿';
    const saved = U.sum(S.goals(), g => g.saved || 0);
    const av = $('hero-avail'); av.hidden = !(saved > 0);
    if (saved > 0) av.textContent = t('available') + ': ' + (bal.total - saved < 0 ? '−' : '') + U.fmt(bal.total - saved);
    $('hero-income').textContent = U.fmt(tot.income); $('hero-expense').textContent = U.fmt(tot.expense);
    // budget bar
    const bud = S.budgetTotal(), wrap = $('hero-budget-wrap'); wrap.hidden = !bud;
    if (bud) {
      const pct = Math.min(100, Math.round(tot.expense / bud * 100)), over = tot.expense > bud, col = over ? 'var(--red)' : pct >= 80 ? '#F5A623' : 'var(--green)';
      $('hero-budget-pct').textContent = Math.round(tot.expense / bud * 100) + '%'; $('hero-budget-pct').style.color = col;
      const f = $('hero-budget-fill'); f.style.width = pct + '%'; f.style.background = col;
    }
    const ins = $('hero-insight');
    if (bud && (tot.income > 0 || tot.expense > 0)) { const left = U.round2(bud - tot.expense); ins.textContent = left >= 0 ? t('budget_left', { v: U.fmt(left) }) : t('budget_over', { v: U.fmt(-left) }); ins.style.color = left < 0 ? 'var(--red)' : left / bud < 0.2 ? '#F5A623' : 'var(--text3)'; }
    else if (tot.income > 0 || tot.expense > 0) { ins.textContent = (tot.net >= 0 ? '+' : '−') + U.fmt(tot.net) + ' ' + t('this_month'); ins.style.color = 'var(--text3)'; }
    else ins.textContent = '';
    // accounts
    const chips = $('acct-chips'); chips.hidden = accts.length < 2;
    if (accts.length > 1) chips.innerHTML = accts.map(a => `<div class="acct-chip"><div class="n">${esc(a.emoji)} ${esc(a.name || t('acct_main'))}</div><div class="v" style="color:${bal.byAcct[a.id] < 0 ? 'var(--red)' : 'var(--text)'}">${bal.byAcct[a.id] < 0 ? '−' : ''}${U.fmt(bal.byAcct[a.id])}</div></div>`).join('');
    homeBanners();
    // recent: the selected month, newest 5 days
    const list = $('home-tx-list'), sorted = C.sortTx(mt);
    $('tx-total-count').textContent = txs.length || '';
    if (!sorted.length) {
      list.innerHTML = `<div class="empty"><div class="empty-icon">💸</div><div class="empty-title">${esc(txs.length ? t('no_tx_month') : t('no_tx'))}</div><div class="empty-sub">${esc(t('no_tx_sub'))}</div></div>`;
      return;
    }
    const days = [...new Set(sorted.map(x => x.date))].slice(0, MAX_DAYS_HOME), keep = new Set(days);
    list.innerHTML = UI.groupedList(sorted.filter(x => keep.has(x.date)));
    UI.attachSwipe(list);
    if (!S.prefs().swipeHint && UI.current() === 'home') { S.patchPrefs({ swipeHint: true }); setTimeout(() => UI.peekSwipe(list.querySelector('.tx-item')), 700); }
  }
  UI.page('home', { show: renderHome });

  /* =========================================================== ADD */
  let addType = 'expense', addCatTouched = false, saving = false;
  function nameSuggestions() {
    const idx = LRN.index(S.txs()), arr = Object.values(idx.names).concat(Object.values(idx.notes)).sort((a, b) => b.n - a.n);
    const seen = new Set(), out = [];
    for (const x of arr) { const k = LRN.nrm(x.text); if (!seen.has(k)) { seen.add(k); out.push(x.text); } if (out.length >= 80) break; }
    $('dl-names').innerHTML = out.map(s => `<option value="${esc(s)}"></option>`).join('');
  }
  function setAddType(ty) {
    addType = ty;
    document.querySelectorAll('#add-type .type-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === ty));
    $('f-cat-wrap').hidden = ty === 'transfer';
    if (ty !== 'transfer') { const cur = $('f-cat').value; $('f-cat').innerHTML = UI.catOptions(ty, addCatTouched ? cur : null); }
    const multi = S.accts().length > 1;
    $('f-acct-wrap').hidden = !(multi || ty === 'transfer');
    $('f-acct-lbl').textContent = ty === 'income' ? t('account') : t('from_acct');
    if (ty === 'income') $('f-acct-lbl').textContent = t('account');
    const a1 = $('f-acct'), keep = a1.value || 'main'; a1.innerHTML = UI.acctOptions(keep);
    $('f-acct2-wrap').hidden = ty !== 'transfer';
    if (ty === 'transfer') { const others = S.accts().filter(a => a.id !== a1.value); $('f-acct2').innerHTML = UI.acctOptions(others.length ? others[0].id : '', true); if (!others.length) $('f-acct2').value = ''; }
    if (ty === 'transfer' && !$('f-name').value) $('f-name').placeholder = t('transfer_cat');
    else $('f-name').placeholder = t('ph_desc');
  }
  UI.act('addType', ty => { setAddType(ty); });
  function resetAddDateTime(force) {
    if (force || !$('f-amount').value) { $('f-date').value = U.dateStr(); $('f-time').value = U.timeStr(); }
  }
  UI.page('add', { show() {
    nameSuggestions();
    if (!$('f-amount').value && !$('f-name').value) addCatTouched = false;
    setAddType(addType); resetAddDateTime(false);
    setTimeout(() => { try { $('f-amount').focus({ preventScroll: true }); } catch (_) { } }, 60);
  } });
  $('f-cat').addEventListener('change', () => { addCatTouched = true; });
  $('f-acct').addEventListener('change', () => { if (addType === 'transfer') { const o = S.accts().filter(a => a.id !== $('f-acct').value); $('f-acct2').innerHTML = UI.acctOptions(o.length ? o[0].id : '', true); if (!o.length) $('f-acct2').value = ''; } });
  $('f-name').addEventListener('change', () => {           // known description -> its usual category
    if (addCatTouched || addType === 'transfer') return;
    const idx = LRN.index(S.txs()), k = LRN.nrm($('f-name').value), e = idx.byText[k]; if (!e) return;
    const best = Object.entries(e.cats).sort((a, b) => b[1] - a[1])[0][0].split('|');
    if (best[0] === addType && S.cats(addType).some(c => c.name === best[1])) $('f-cat').value = best[1];
  });
  UI.moneyInput($('f-amount'));

  $('add-form').addEventListener('submit', async ev => {
    ev.preventDefault(); if (saving) return;
    const amount = UI.readMoney($('f-amount')), name = $('f-name').value.trim(), date = $('f-date').value, time = $('f-time').value || null, note = $('f-note').value.trim() || null;
    if (!(amount > 0)) { UI.toast(t('bad_amount'), '⚠️'); $('f-amount').focus(); return; }
    if (!U.isDateStr(date) || isNaN(U.parseDate(date))) { UI.toast(t('bad_date'), '⚠️'); return; }
    if (addType !== 'transfer' && !name) { UI.toast(t('fill_all'), '⚠️'); $('f-name').focus(); return; }
    const acct = $('f-acct').value || 'main', acct2 = $('f-acct2').value || '';
    if (addType === 'transfer' && acct2 && acct2 === acct) { UI.toast(t('same_acct'), '⚠️'); return; }
    saving = true;
    try {
      const tx = { id: U.uid(), type: addType, amount, name: name || t('transfer_cat'), date, time, note };
      if (addType === 'transfer') { tx.cat = ''; tx.emoji = '🔁'; tx.acct = acct; if (acct2) tx.toAcct = acct2; }
      else { tx.cat = $('f-cat').value; tx.emoji = UI.catEmoji(addType, tx.cat); if (S.accts().length > 1 && acct !== 'main') tx.acct = acct; }
      if (date > U.dateStr() && !(await UI.confirm(t('future_date', { d: I18N.dateLabel(date) }), t('save')))) return;
      const dup = C.findDuplicate(S.txs(), tx);
      if (dup && !(await UI.confirm(t('dup_warn', { n: dup.tx.name, a: U.fmt(dup.tx.amount), d: I18N.dateLabel(dup.tx.date, { noYear: true }), t: dup.tx.time || '' }), t('save')))) return;
      if (!S.addTx(tx)) return UI.toast(t('storage_full'), '⚠️', { ms: 5000 });
      S.patchPrefs({ txSinceBackup: (S.prefs().txSinceBackup || 0) + 1 });
      root.FFBudget && FFBudget.check(tx);
      $('f-amount').value = ''; $('f-name').value = ''; $('f-note').value = ''; addCatTouched = false; resetAddDateTime(true);
      UI.toast(t('saved'), '✅'); UI.month = { y: +date.slice(0, 4), m: +date.slice(5, 7) - 1 }; UI.go('home');
    } finally { saving = false; }
  });

  /* =========================================================== DETAIL / EDIT SHEET */
  let curTx = null, edType = 'expense', imgUrl = null;
  function row(label, val) { return `<div class="tx-detail-row"><span class="tx-detail-row-label">${esc(label)}</span><span class="tx-detail-row-val" style="text-align:right;max-width:62%;word-break:break-word">${val}</span></div>`; }
  async function openTx(id) {
    const tx = S.getTx(+id); if (!tx) return;
    curTx = tx;
    $('d-icon').textContent = tx.emoji || '💳'; $('d-icon').className = 'tx-detail-icon ' + tx.type;
    $('d-name').textContent = tx.name || I18N.catLabel(tx.cat);
    const sign = tx.type === 'income' ? '+' : tx.type === 'expense' ? '−' : '';
    $('d-amount').textContent = sign + U.fmt(tx.amount); $('d-amount').className = 'tx-detail-amount ' + tx.type;
    const multi = S.accts().length > 1;
    let rows = '';
    rows += row(t('type'), `<span class="tx-type-badge ${tx.type}">${esc(tx.type === 'income' ? t('income') : tx.type === 'expense' ? t('expense') : t('transfer'))}</span>`);
    if (tx.type !== 'transfer') rows += row(t('category'), esc((tx.emoji || '') + ' ' + I18N.catLabel(tx.cat)));
    rows += row(t('date'), esc(I18N.dateLabel(tx.date, { long: true }) + (tx.time ? ' · ' + tx.time : '')));
    if (tx.type === 'transfer') rows += row(t('from_acct'), esc(UI.acctName(tx.acct))) + row(t('to_acct'), tx.toAcct ? esc(UI.acctName(tx.toAcct)) : '↗ ' + esc(t('acct_external')));
    else if (multi) rows += row(t('account'), esc(UI.acctName(tx.acct)));
    if (tx.payee && tx.payee !== tx.name) rows += row(t('payee'), esc(tx.payee));
    if (tx.note) rows += row(t('note'), esc(tx.note));
    $('d-rows').innerHTML = rows;
    $('tx-view').classList.remove('hidden'); $('tx-edit').classList.remove('active');
    const im = $('d-img'); im.hidden = true; if (imgUrl) { URL.revokeObjectURL(imgUrl); imgUrl = null; }
    if (tx.hasImg) S.getImg(tx.id).then(b => { if (b && curTx && curTx.id === tx.id) { imgUrl = URL.createObjectURL(b); im.src = imgUrl; im.hidden = false; } });
    UI.openSheet('sheet-tx');
  }
  UI.act('openTx', id => openTx(id));
  UI.act('viewImg', (a, el) => { const v = $('img-viewer'); v.querySelector('img').src = el.src; v.hidden = false; });
  $('d-img').setAttribute('data-act', 'viewImg');
  UI.act('closeViewer', () => { $('img-viewer').hidden = true; });
  UI.viewImage = src => { const v = $('img-viewer'); v.querySelector('img').src = src; v.hidden = false; };

  function edSetType(ty) {
    edType = ty;
    document.querySelectorAll('#ed-type .type-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === ty));
    $('ed-cat-wrap').hidden = ty === 'transfer';
    const cur = (curTx && curTx.type === ty) ? curTx.cat : $('ed-cat').value;
    if (ty !== 'transfer') $('ed-cat').innerHTML = UI.catOptions(ty, cur);
    const multi = S.accts().length > 1;
    $('ed-acct-wrap').hidden = !(multi || ty === 'transfer'); $('ed-acct2-wrap').hidden = ty !== 'transfer';
    $('ed-acct-lbl').textContent = ty === 'income' ? t('account') : t('from_acct');
  }
  UI.act('edType', ty => edSetType(ty));
  UI.act('txEdit', () => {
    const tx = curTx; if (!tx) return;
    $('ed-amount').value = tx.amount; $('ed-name').value = tx.name || ''; $('ed-date').value = tx.date; $('ed-time').value = tx.time || ''; $('ed-note').value = tx.note || '';
    $('ed-acct').innerHTML = UI.acctOptions(tx.acct || 'main'); $('ed-acct2').innerHTML = UI.acctOptions(tx.toAcct || '', true);
    edSetType(tx.type); UI.moneyInput($('ed-amount'));
    $('tx-view').classList.add('hidden'); $('tx-edit').classList.add('active');
  });
  UI.act('txEditCancel', () => { $('tx-view').classList.remove('hidden'); $('tx-edit').classList.remove('active'); });
  UI.act('txEditSave', async () => {
    const tx = curTx; if (!tx) return;
    const amount = UI.readMoney($('ed-amount')), name = $('ed-name').value.trim(), date = $('ed-date').value;
    if (!(amount > 0)) return UI.toast(t('bad_amount'), '⚠️');
    if (!U.isDateStr(date) || isNaN(U.parseDate(date))) return UI.toast(t('bad_date'), '⚠️');
    if (edType !== 'transfer' && !name) return UI.toast(t('fill_all'), '⚠️');
    const acct = $('ed-acct').value || 'main', acct2 = $('ed-acct2').value || '';
    if (edType === 'transfer' && acct2 && acct2 === acct) return UI.toast(t('same_acct'), '⚠️');
    if (date > U.dateStr() && date !== tx.date && !(await UI.confirm(t('future_date', { d: I18N.dateLabel(date) }), t('save')))) return;
    const n = { ...tx, type: edType, amount, name: name || t('transfer_cat'), date, time: $('ed-time').value || null, note: $('ed-note').value.trim() || null };
    delete n.acct; delete n.toAcct;
    if (edType === 'transfer') { n.cat = ''; n.emoji = '🔁'; n.acct = acct; if (acct2) n.toAcct = acct2; }
    else { n.cat = $('ed-cat').value; n.emoji = UI.catEmoji(edType, n.cat); if (acct !== 'main') n.acct = acct; }
    if (!S.putTx(n)) return UI.toast(t('storage_full'), '⚠️');
    UI.closeSheet('sheet-tx'); UI.toast(t('updated'), '✅'); UI.refresh();
  });
  UI.act('txDelete', async () => {
    const tx = curTx; if (!tx) return;
    UI.closeSheet('sheet-tx'); UI.deleteTx(tx.id);
  });
  $('sheet-tx').addEventListener('transitionend', () => { if (!$('sheet-tx').classList.contains('open') && imgUrl) { URL.revokeObjectURL(imgUrl); imgUrl = null; } });

  /* =========================================================== ALL TRANSACTIONS */
  const F = { type: 'all', scope: 'month', y: UI.month.y, m: UI.month.m, limit: 150 };
  function readFilters() {
    const f = { type: F.type, q: $('all-search').value, date: $('all-day').value, min: U.parseMoney($('amt-min').value) || 0, max: U.parseMoney($('amt-max').value) || 0 };
    if (F.scope === 'month' && !f.date) f.from = U.monthKey(F.y, F.m) + '-01', f.to = U.monthKey(F.y, F.m) + '-31';
    if (F.scope === 'month' && f.date) { /* a specific day overrides the month */ }
    return f;
  }
  function renderAll() {
    $('all-month').value = U.monthKey(F.y, F.m); $('all-month-nav').hidden = F.scope !== 'month';
    const list = C.sortTx(C.filterTx(S.txs(), readFilters())), tot = C.totals(list);
    $('all-count').textContent = t('items', { n: list.length }) + ' · ' + t('in_out', { i: U.fmt(tot.income), o: U.fmt(tot.expense) });
    const box = $('all-tx-list');
    if (!list.length) { box.innerHTML = `<div class="empty"><div class="empty-icon">🗓️</div><div class="empty-title">${esc(t('no_results'))}</div><div class="empty-sub">${F.scope === 'month' ? esc(I18N.monthLabelLong(F.y, F.m)) : ''}</div></div>`; return; }
    const shown = list.slice(0, F.limit);
    box.innerHTML = UI.groupedList(shown) + (list.length > shown.length ? `<button class="btn-ghost mt12" data-act="allMore">${esc(t('see_all'))} (${list.length - shown.length})</button>` : '');
    UI.attachSwipe(box);
  }
  UI.page('all', { show() { F.y = UI.month.y; F.m = UI.month.m; F.limit = 150; renderAll(); } });
  UI.act('allMore', () => { F.limit += 300; renderAll(); });
  UI.act('allPrev', () => { F.m--; if (F.m < 0) { F.m = 11; F.y--; } $('all-day').value = ''; F.limit = 150; renderAll(); });
  UI.act('allNext', () => { F.m++; if (F.m > 11) { F.m = 0; F.y++; } $('all-day').value = ''; F.limit = 150; renderAll(); });
  UI.act('allScope', s => { F.scope = s; document.querySelectorAll('#all-scope button').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === s)); F.limit = 150; renderAll(); });
  UI.act('allType', ty => { F.type = ty; document.querySelectorAll('#all-types .filter-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === ty)); F.limit = 150; renderAll(); });
  UI.act('clearFilters', () => { $('all-search').value = ''; $('all-day').value = ''; $('amt-min').value = ''; $('amt-max').value = ''; F.type = 'all'; document.querySelectorAll('#all-types .filter-tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === 'all')); F.limit = 150; renderAll(); });
  $('all-month').addEventListener('change', e => { const v = e.target.value; if (/^\d{4}-\d{2}$/.test(v)) { F.y = +v.slice(0, 4); F.m = +v.slice(5) - 1; $('all-day').value = ''; F.limit = 150; renderAll(); } });
  $('all-day').addEventListener('change', () => { const v = $('all-day').value; if (v) { F.y = +v.slice(0, 4); F.m = +v.slice(5, 7) - 1; } F.limit = 150; renderAll(); });
  const rerender = U.debounce(() => { F.limit = 150; renderAll(); }, 120);
  ['all-search', 'amt-min', 'amt-max'].forEach(id => $(id).addEventListener('input', rerender));
  UI.moneyInput($('amt-min')); UI.moneyInput($('amt-max'));

  root.FFTx = { openTx, renderHome, suggestNames: nameSuggestions };
})(window);

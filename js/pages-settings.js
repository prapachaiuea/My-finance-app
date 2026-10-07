/* FinFlow — Settings, categories, accounts, recurring, goals, backup/restore, PIN lock. */
(function (root) {
  'use strict';
  const { U, S, C, I18N, t, UI, LRN } = root;
  const $ = UI.$, esc = U.esc;

  /* =========================================================== SETTINGS */
  function toggle(id, on) { const b = $(id); if (b) { b.classList.toggle('on', !!on); b.setAttribute('aria-checked', !!on); } }
  const pinEnabled = () => S.rawGet(S.K.pinOn) === 'true' && !!(S.rawGet(S.K.pinHash) || S.rawGet(S.K.pin));
  function renderSettings() {
    UI.applyTheme();
    const bud = S.budgetTotal(); $('budget-input').value = bud > 0 ? bud : '';
    toggle('pin-toggle', pinEnabled()); $('autolock-row').hidden = !pinEnabled(); toggle('autolock-toggle', S.prefs().autolock !== false);
    toggle('saveimg-toggle', S.prefs().saveImg !== false);
    toggle('notif-toggle', S.prefs().notif && 'Notification' in root && Notification.permission === 'granted');
    const lb = S.prefs().lastBackup; $('backup-sub').textContent = t('backup_sub') + ' · ' + t('last_backup') + ': ' + (lb ? I18N.dateLabel(U.dateStr(new Date(lb))) : t('never'));
    $('share-row').hidden = !(navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] }));
    storageInfo();
  }
  async function storageInfo() {
    const u = await S.usage(), p = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted().catch(() => false) : false;
    const kb = u ? (u.used > 1048576 ? (u.used / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(u.used / 1024)) + ' KB') : '—';
    $('storage-sub').textContent = t('storage_sub', { u: kb, p: p ? t('persist_yes') : t('persist_no') });
  }
  UI.page('settings', { show: renderSettings });
  UI.moneyInput($('budget-input'));
  UI.act('saveBudget', () => { const v = U.parseMoney($('budget-input').value); S.setBudgetTotal(isNaN(v) ? 0 : v); UI.toast(t('bud_saved'), '✅'); });
  UI.act('toggleSaveImg', () => { S.patchPrefs({ saveImg: S.prefs().saveImg === false }); renderSettings(); });
  UI.act('toggleNotif', async () => {
    if (S.prefs().notif) { S.patchPrefs({ notif: false }); return renderSettings(); }
    if (!('Notification' in root)) return UI.toast(t('notif_denied'), '⚠️');
    let p = Notification.permission; if (p === 'default') p = await Notification.requestPermission();
    if (p === 'granted') S.patchPrefs({ notif: true }); else UI.toast(t('notif_denied'), '⚠️', { ms: 4000 });
    renderSettings();
  });

  /* =========================================================== BACKUP / RESTORE / CSV / WIPE */
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  const backupFile = () => new File([JSON.stringify(S.exportAll(), null, 2)], 'finflow_backup_' + U.dateStr() + '.json', { type: 'application/json' });
  const markBackup = () => { S.patchPrefs({ lastBackup: Date.now(), txSinceBackup: 0 }); renderSettings(); };
  UI.act('backup', () => { if (navigator.standalone && navigator.canShare) return UI.ACT.backupShare(); download(backupFile(), backupFile().name); markBackup(); UI.toast(t('backup_done'), '💾'); if (UI.current() === 'home') UI.refresh(); });
  UI.act('backupShare', async () => { const f = backupFile(); try { await navigator.share({ files: [f], title: 'FinFlow backup' }); markBackup(); } catch (e) { if (e && e.name !== 'AbortError') { download(f, f.name); markBackup(); } } });
  UI.act('pickRestore', () => $('restore-input').click());
  $('restore-input').addEventListener('change', e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    if (file.size > 30 * 1048576) return UI.toast(t('restore_err'), '⚠️');
    const rd = new FileReader();
    rd.onload = async () => {
      let parsed; try { parsed = S.parseBackup(JSON.parse(String(rd.result).replace(/^﻿/, ''))); } catch (_) { return UI.toast(t('restore_err'), '⚠️'); }
      if (!(await UI.confirm(t('restore_confirm', { n: parsed.data.tx.length }), t('restore')))) return;
      await S.snapshot('restore'); S.applyBackup(parsed.data); S.migrate();
      I18N.setLang(S.rawGet(S.K.lang) || 'th'); UI.applyLang(); UI.applyTheme(); FFSettings.applyRecurring(true);
      UI.toast(t('restore_done', { n: parsed.data.tx.length }) + (parsed.dropped ? ' · ' + t('restore_dropped', { n: parsed.dropped }) : ''), '📥', { ms: 4000 });
      S.patchPrefs({ lastBackup: Date.now(), txSinceBackup: 0 }); UI.go('home', { force: true });
    };
    rd.readAsText(file);
  });
  UI.act('exportCSV', () => {
    const txs = C.sortTx(S.txs()).reverse(); if (!txs.length) return UI.toast(t('no_data'), 'ℹ️');
    const cell = v => { v = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    const rows = txs.map(x => [x.date, x.time || '', x.type, x.amount, x.cat, x.name, x.note || '', x.payee || '', UI.acctName(x.acct), x.type === 'transfer' ? (x.toAcct ? UI.acctName(x.toAcct) : '') : ''].map((v, i) => i === 3 ? v : cell(v)).join(','));
    download(new Blob(['﻿' + 'Date,Time,Type,Amount,Category,Description,Note,Payee,Account,ToAccount\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' }), 'finflow_' + U.dateStr() + '.csv');
    UI.toast(t('csv_done'), '📤');
  });
  UI.act('clearAll', async () => {
    if (!(await UI.confirm(t('clear_confirm'), t('clear_all')))) return;
    await S.snapshot('clear'); S.wipeAll(true); FFSettings.resetUI();
    UI.toast(t('cleared'), '🗑️'); UI.go('home', { force: true });
  });
  UI.act('undoWipe', async () => {
    const snaps = await S.snapshots(); if (!snaps.length) return UI.toast(t('nothing_to_undo'), 'ℹ️');
    const s = snaps[0]; let parsed; try { parsed = S.parseBackup(s.data); } catch (_) { return UI.toast(t('restore_err'), '⚠️'); }
    if (!(await UI.confirm(t('undo_confirm', { d: I18N.dateLabel(U.dateStr(new Date(s.at))) + ' ' + U.timeStr(new Date(s.at)), n: parsed.data.tx.length }), t('undo')))) return;
    await S.snapshot('undo'); S.applyBackup(parsed.data); S.migrate(); UI.toast(t('restore_done', { n: parsed.data.tx.length }), '↩️'); UI.go('home', { force: true });
  });
  UI.act('checkUpdate', () => root.FFApp && FFApp.checkUpdate());

  /* =========================================================== CATEGORIES */
  let catEdit = null;     // {type, old}
  function renderCategories() {
    ['expense', 'income'].forEach(type => {
      $(type === 'expense' ? 'exp-cat-grid' : 'inc-cat-grid').innerHTML = S.cats(type).map(c => `<div class="cat-chip" data-act="catEdit" data-arg="${type}|${esc(c.name)}" role="button" tabindex="0"><span class="cat-chip-emoji">${esc(c.emoji)}</span><span class="cat-chip-name">${esc(I18N.catLabel(c.name))}${c.refund ? `<span class="tx-badge">${esc(t('cat_refund_tag'))}</span>` : ''}</span><button class="cat-chip-del" data-act="catDelete" data-arg="${type}|${esc(c.name)}" aria-label="${esc(t('delete'))}">✕</button></div>`).join('');
    });
  }
  UI.page('categories', { show: renderCategories });
  const splitArg = a => { const i = a.indexOf('|'); return [a.slice(0, i), a.slice(i + 1)]; };
  function openCat(type, old) {
    catEdit = { type, old: old || null };
    const c = old ? S.cats(type).find(x => x.name === old) : null;
    $('cat-title').textContent = t(old ? 'cat_edit_title' : 'cat_add_title');
    $('cat-emoji').value = c ? c.emoji : ''; $('cat-name').value = c ? c.name : ''; $('cat-note').hidden = !old;
    UI.openSheet('sheet-cat'); setTimeout(() => $('cat-name').focus(), 250);
  }
  UI.act('catRefundToggle', () => { catEdit.refund = !catEdit.refund; cat-refund.classList.toggle('on', catEdit.refund); cat-refund.setAttribute('aria-checked', catEdit.refund); });
  UI.act('catAdd', type => openCat(type, null));
  UI.act('catEdit', (a, el, e) => { if (e.target.closest('.cat-chip-del')) return; const [type, name] = splitArg(a); openCat(type, name); });
  UI.act('catSave', () => {
    const { type, old } = catEdit, name = $('cat-name').value.trim(), emoji = $('cat-emoji').value.trim() || '📦';
    if (!name) return UI.toast(t('fill_all'), '⚠️');
    const cats = S.cats(type).map(c => ({ ...c }));
    if (cats.some(c => c.name.toLowerCase() === name.toLowerCase() && c.name !== old)) return UI.toast(t('cat_exists'), '⚠️');
    if (old) {
      const c = cats.find(x => x.name === old); c.name = name; c.emoji = emoji; if (type === 'income') { if (catEdit.refund) c.refund = true; else delete c.refund; } S.setCats(type, cats);
      if (old !== name || true) {   // propagate rename/emoji to existing transactions, budgets and learned payees
        const txs = S.txs().map(x => (x.type === type && x.cat === old) ? { ...x, cat: name, emoji } : x); S.setTxs(txs);
        if (old !== name) {
          const bud = S.catBudgets(); if (type === 'expense' && bud[old] !== undefined) { bud[name] = bud[old]; delete bud[old]; S.setCatBudgets(bud); }
          const L = S.learn(); ['byAcct', 'byName'].forEach(k => Object.values(L[k] || {}).forEach(e => { if (e.type === type && e.cat === old) e.cat = name; })); S.setLearn(L);
        }
      }
    } else { cats.push(type === 'income' && catEdit.refund ? { emoji, name, refund: true } : { emoji, name }); S.setCats(type, cats); }
    UI.closeSheet('sheet-cat'); renderCategories(); UI.toast(t('saved'), '✅');
  });
  UI.act('catDelete', async a => {
    const [type, name] = splitArg(a), cats = S.cats(type);
    if (cats.length <= 1) return UI.toast(t('cat_last'), '⚠️');
    const n = S.txs().filter(x => x.type === type && x.cat === name).length;
    if (!(await UI.confirm(t('cat_delete_confirm', { c: I18N.catLabel(name), n }), t('delete')))) return;
    S.setCats(type, cats.filter(c => c.name !== name)); const bud = S.catBudgets(); if (bud[name] !== undefined) { delete bud[name]; S.setCatBudgets(bud); }
    renderCategories(); UI.toast(t('deleted'), '✓');
  });

  /* =========================================================== ACCOUNTS */
  let acctEdit = null;
  function renderAccounts() {
    const bal = C.balances(S.txs(), S.accts());
    $('acct-list').innerHTML = S.accts().map(a => { const v = bal.byAcct[a.id]; return `<div class="list-card" data-act="acctEdit" data-arg="${esc(a.id)}" role="button" tabindex="0"><div class="ic">${esc(a.emoji)}</div><div class="mid"><div class="t">${esc(a.name || t('acct_main'))}</div><div class="s">${esc(t('acct_opening'))}: ${U.fmt(a.opening || 0)}</div></div><div class="r" style="color:${v < 0 ? 'var(--red)' : 'var(--text)'}">${v < 0 ? '−' : ''}${U.fmt(v)}</div>${a.id !== 'main' ? `<button class="icon-btn" data-act="acctDelete" data-arg="${esc(a.id)}" aria-label="${esc(t('delete'))}">✕</button>` : ''}</div>`; }).join('')
      + (S.accts().length > 1 ? `<div class="list-card" style="background:none;border-style:dashed"><div class="mid"><div class="t">${esc(t('balance'))}</div></div><div class="r">${bal.total < 0 ? '−' : ''}${U.fmt(bal.total)}</div></div>` : '');
  }
  UI.page('accounts', { show: renderAccounts });
  function openAcct(id) {
    acctEdit = id; const a = id ? S.accts().find(x => x.id === id) : null;
    $('acct-title').textContent = t(id ? 'acct_edit_title' : 'acct_add_title'); $('acct-emoji').value = a ? a.emoji : '💳'; $('acct-name').value = a ? a.name : ''; $('acct-name').placeholder = id === 'main' ? t('acct_main') : t('acct_name');
    $('acct-opening').value = a && a.opening ? a.opening : ''; UI.moneyInput($('acct-opening')); UI.openSheet('sheet-acct');
  }
  UI.act('acctAdd', () => openAcct(null));
  UI.act('acctEdit', (id, el, e) => { if (e.target.closest('.icon-btn')) return; openAcct(id); });
  UI.act('acctSave', () => {
    const name = $('acct-name').value.trim(), emoji = $('acct-emoji').value.trim() || '🏦', opening = U.parseMoney($('acct-opening').value || '0');
    if (acctEdit !== 'main' && !name) return UI.toast(t('fill_all'), '⚠️');
    if (isNaN(opening)) return UI.toast(t('bad_amount'), '⚠️');
    const list = S.accts().map(a => ({ ...a }));
    if (acctEdit) { const a = list.find(x => x.id === acctEdit); a.name = name; a.emoji = emoji; a.opening = opening; }
    else list.push({ id: 'a' + U.uid().toString(36), name, emoji, opening });
    S.setAccts(list); UI.closeSheet('sheet-acct'); renderAccounts(); UI.toast(t('saved'), '✅');
  });
  UI.act('acctDelete', async id => {
    const a = S.accts().find(x => x.id === id); if (!a) return;
    if (S.txs().some(x => x.acct === id || x.toAcct === id) || S.recurring().some(r => r.acct === id)) return UI.toast(t('acct_in_use'), '⚠️', { ms: 4000 });
    if (!(await UI.confirm(t('acct_delete_confirm', { n: a.name }), t('delete')))) return;
    S.setAccts(S.accts().filter(x => x.id !== id)); renderAccounts();
  });

  /* =========================================================== RECURRING */
  let recEdit = null, recTy = 'expense';
  function renderRecurring() {
    const recs = S.recurring(), box = $('rec-list');
    if (!recs.length) { box.innerHTML = `<div class="empty" style="padding:32px 0"><div class="empty-icon">🔄</div><div class="empty-title">${esc(t('rec_empty'))}</div><div class="empty-sub">${esc(t('rec_empty_sub'))}</div></div>`; return; }
    box.innerHTML = recs.map(r => `<div class="list-card" data-act="recEdit" data-arg="${r.id}" role="button" tabindex="0"><div class="ic" style="background:${r.type === 'income' ? 'var(--green-dim)' : 'var(--red-dim)'}">${esc(r.emoji)}</div><div class="mid"><div class="t">${esc(r.name)}</div><div class="s">${esc(I18N.catLabel(r.cat))} · ${esc(t('rec_every', { d: r.day }))}</div></div><div class="r" style="color:${r.type === 'income' ? 'var(--green)' : 'var(--red)'}">${r.type === 'income' ? '+' : '−'}${U.fmt(r.amount)}</div><button class="small-btn primary" data-act="recNow" data-arg="${r.id}" aria-label="${esc(t('rec_now'))}">+</button><button class="icon-btn" data-act="recDelete" data-arg="${r.id}" aria-label="${esc(t('delete'))}">✕</button></div>`).join('');
  }
  UI.page('recurring', { show: renderRecurring });
  function setRecTy(ty, selCat) {
    recTy = ty; document.querySelectorAll('#rec-type .type-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === ty));
    $('rec-cat').innerHTML = UI.catOptions(ty, selCat);
  }
  UI.act('recType', ty => setRecTy(ty));
  function openRec(id) {
    recEdit = id; const r = id ? S.recurring().find(x => x.id === +id) : null;
    $('rec-title-lbl').textContent = t(r ? 'rec_edit_title' : 'rec_add_title'); setRecTy(r ? r.type : 'expense', r && r.cat);
    $('rec-amount').value = r ? r.amount : ''; $('rec-name').value = r ? r.name : ''; $('rec-day').value = r ? r.day : ''; $('rec-note').value = r ? (r.note || '') : '';
    $('rec-acct-wrap').hidden = S.accts().length < 2; $('rec-acct').innerHTML = UI.acctOptions(r && r.acct || 'main');
    UI.moneyInput($('rec-amount')); UI.openSheet('sheet-rec'); setTimeout(() => $('rec-name').focus(), 250);
  }
  UI.act('recAdd', () => openRec(null));
  UI.act('recEdit', (id, el, e) => { if (e.target.closest('.small-btn,.icon-btn')) return; openRec(id); });
  UI.act('recSave', () => {
    const amount = U.parseMoney($('rec-amount').value), name = $('rec-name').value.trim(), day = parseInt($('rec-day').value);
    if (!(amount > 0) || !name || !(day >= 1 && day <= 31)) return UI.toast(t('fill_all'), '⚠️');
    const cat = $('rec-cat').value, emoji = UI.catEmoji(recTy, cat), note = $('rec-note').value.trim(), acct = S.accts().length > 1 ? $('rec-acct').value : undefined;
    const list = S.recurring().map(r => ({ ...r }));
    if (recEdit) { const r = list.find(x => x.id === +recEdit); Object.assign(r, { type: recTy, amount, name, cat, emoji, note, day, acct }); }
    else list.push({ id: U.uid(), type: recTy, amount, name, cat, emoji, note, day, acct, start: U.monthKey(new Date().getFullYear(), new Date().getMonth()) + '-01' });
    S.setRecurring(list); UI.closeSheet('sheet-rec'); applyRecurring(); renderRecurring(); UI.toast(t('saved'), '✅');
  });
  UI.act('recDelete', async (id, el, e) => { e.stopPropagation(); if (!(await UI.confirm(t('rec_delete_confirm'), t('delete')))) return; S.setRecurring(S.recurring().filter(r => r.id !== +id)); renderRecurring(); UI.toast(t('deleted'), '✓'); });
  UI.act('recNow', (id, el, e) => {
    e.stopPropagation(); const r = S.recurring().find(x => x.id === +id); if (!r) return; const n = new Date();
    S.addTx({ id: U.uid(), type: r.type, amount: r.amount, name: r.name, cat: r.cat, emoji: r.emoji, note: r.note || null, date: U.dateStr(n), time: U.timeStr(n), acct: r.acct });
    UI.toast(t('rec_added_now', { n: r.name }), '✅');
  });
  /** add every missing occurrence up to today; never twice for the same month even if the user deleted the transaction */
  function applyRecurring(silent) {
    const rules = S.recurring(); if (!rules.length) return 0;
    const r = C.dueRecurring(rules, S.recDone(), U.dateStr(), U.uid);
    S.setRecDone(r.done);
    if (r.txs.length) { S.addTxs(r.txs); if (!silent) setTimeout(() => UI.toast(t('rec_added', { n: r.txs.length }), '🔄'), 600); }
    return r.txs.length;
  }

  /* =========================================================== GOALS */
  let goalEdit = null, contrib = null;
  function renderGoals() {
    const goals = S.goals(), box = $('goals-list'), cols = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--red)'];
    if (!goals.length) { box.innerHTML = `<div class="empty" style="padding:32px 0"><div class="empty-icon">🎯</div><div class="empty-title">${esc(t('goal_empty'))}</div><div class="empty-sub">${esc(t('goal_empty_sub'))}</div></div>`; return; }
    box.innerHTML = goals.map((g, i) => { const pct = Math.min(100, g.target > 0 ? Math.floor(g.saved / g.target * 100) : 0), col = cols[i % cols.length], done = g.saved >= g.target;
      return `<div class="goal-card"><div class="goal-card-header"><span class="goal-emoji-big">${esc(g.emoji || '🎯')}</span><span class="goal-name">${esc(g.name)}</span><button class="icon-btn" data-act="goalEdit" data-arg="${g.id}" aria-label="${esc(t('edit'))}">✎</button><button class="goal-del-btn" data-act="goalDelete" data-arg="${g.id}" aria-label="${esc(t('delete'))}">✕</button></div>
        <div class="goal-amounts-row"><span class="goal-saved-amt" style="color:${col}">${U.fmt(g.saved)}</span><span class="goal-target-lbl">/ ${U.fmt(g.target)}</span></div>
        <div class="goal-track"><div class="goal-fill" style="width:${pct}%;background:${col}"></div></div>
        <div class="goal-meta"><span>${esc(t('goal_pct', { p: pct }))}</span>${done ? `<span style="color:${col};font-weight:700">🎉 ${esc(t('goal_reached'))}</span>` : `<span>${esc(t('goal_togo', { v: U.fmt(g.target - g.saved) }))}</span>`}</div>
        <div style="display:grid;grid-template-columns:${done || g.saved <= 0 ? '1fr' : '2fr 1fr'};gap:8px">${!done ? `<button class="goal-contrib-btn" style="border-color:${col};color:${col}" data-act="goalContrib" data-arg="${g.id}|add">${esc(t('goal_contrib'))}</button>` : ''}${g.saved > 0 ? `<button class="goal-contrib-btn" style="background:var(--bg3);border-color:var(--border2);color:var(--text2)" data-act="goalContrib" data-arg="${g.id}|out">${esc(t('goal_withdraw'))}</button>` : ''}</div></div>`; }).join('')
      + `<div class="info-box mb12">${esc(t('goal_total_saved'))}: <b>${U.fmt(U.sum(goals, g => g.saved))}</b></div>`;
  }
  UI.page('goals', { show: renderGoals });
  function openGoal(id) {
    goalEdit = id; const g = id ? S.goals().find(x => x.id === +id) : null;
    $('goal-title').textContent = t(g ? 'goal_edit_title' : 'goal_add_title'); $('goal-emoji').value = g ? g.emoji : '🎯'; $('goal-name').value = g ? g.name : ''; $('goal-target').value = g ? g.target : '';
    UI.moneyInput($('goal-target')); UI.openSheet('sheet-goal'); setTimeout(() => $('goal-name').focus(), 250);
  }
  UI.act('goalAdd', () => openGoal(null)); UI.act('goalEdit', id => openGoal(id));
  UI.act('goalSave', () => {
    const name = $('goal-name').value.trim(), target = U.parseMoney($('goal-target').value), emoji = $('goal-emoji').value.trim() || '🎯';
    if (!name || !(target > 0)) return UI.toast(t('fill_all'), '⚠️');
    const list = S.goals().map(g => ({ ...g }));
    if (goalEdit) { const g = list.find(x => x.id === +goalEdit); g.name = name; g.target = target; g.emoji = emoji; g.saved = Math.min(g.saved, target); }
    else list.push({ id: U.uid(), emoji, name, target, saved: 0 });
    S.setGoals(list); UI.closeSheet('sheet-goal'); renderGoals(); UI.toast(t('saved'), '🎯');
  });
  UI.act('goalDelete', async id => { if (!(await UI.confirm(t('goal_delete_confirm'), t('delete')))) return; S.setGoals(S.goals().filter(g => g.id !== +id)); renderGoals(); UI.toast(t('deleted'), '✓'); });
  UI.act('goalContrib', a => { const [id, mode] = a.split('|'), g = S.goals().find(x => x.id === +id); if (!g) return; contrib = { id: +id, mode }; $('contrib-title').textContent = t(mode === 'out' ? 'goal_withdraw_from' : 'goal_save_to', { n: g.name }); $('contrib-amount').value = ''; UI.moneyInput($('contrib-amount')); UI.openSheet('sheet-contrib'); setTimeout(() => $('contrib-amount').focus(), 250); });
  UI.act('contribSave', () => {
    const amt = U.parseMoney($('contrib-amount').value); if (!(amt > 0)) return UI.toast(t('bad_amount'), '⚠️');
    const list = S.goals().map(g => ({ ...g })), g = list.find(x => x.id === contrib.id); if (!g) return;
    if (contrib.mode === 'out') { if (amt > g.saved) return UI.toast(t('goal_over'), '⚠️'); g.saved = U.round2(g.saved - amt); }
    else g.saved = Math.min(g.target, U.round2(g.saved + amt));
    S.setGoals(list); UI.closeSheet('sheet-contrib'); renderGoals(); UI.toast(g.saved >= g.target && contrib.mode !== 'out' ? '🎉 ' + t('goal_reached') : t('goal_saved'), '✅');
  });

  /* =========================================================== PIN LOCK */
  let pinMode = 'verify', pinBuf = '', pinTemp = '';
  const enc = new TextEncoder();
  async function hashPin(pin, salt) {
    try { if (root.crypto && crypto.subtle) { const d = await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + pin)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); } } catch (_) { }
    let h = 2166136261; const s = salt + ':' + pin + ':finflow'; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return 'f' + (h >>> 0).toString(16);
  }
  function dots() { for (let i = 0; i < 4; i++) $('pd' + i).classList.toggle('filled', i < pinBuf.length); }
  function prompt(key, err, vars) { const p = $('pin-prompt'); p.textContent = t(key, vars); p.classList.toggle('err', !!err); }
  function showPin(mode) {
    pinMode = mode; pinBuf = ''; pinTemp = ''; dots();
    $('pin-overlay').classList.remove('hidden'); $('pin-cancel').hidden = mode === 'verify'; $('pin-cancel').textContent = t('pin_cancel');
    prompt(mode === 'set' ? 'pin_set' : 'pin_enter'); lockCheck();
  }
  function hidePin() { $('pin-overlay').classList.add('hidden'); pinBuf = ''; dots(); }
  let lockTimer = null;
  const isLocked = () => (S.get(S.K.pinFail, { until: 0 }).until || 0) > Date.now();
  function lockCheck() {
    const f = S.get(S.K.pinFail, { n: 0, until: 0 }), left = Math.ceil((f.until - Date.now()) / 1000);
    clearInterval(lockTimer);
    if (left > 0) { const tick = () => { const l = Math.ceil((f.until - Date.now()) / 1000); if (l <= 0) { clearInterval(lockTimer); prompt('pin_enter'); } else prompt('pin_locked', true, { s: l }); }; tick(); lockTimer = setInterval(tick, 500); return true; }
    return false;
  }
  async function pinDone() {
    const entered = pinBuf;
    if (pinMode === 'set') { pinTemp = entered; pinBuf = ''; pinMode = 'confirm'; dots(); return prompt('pin_confirm'); }
    if (pinMode === 'confirm') {
      if (entered !== pinTemp) { pinBuf = ''; pinTemp = ''; pinMode = 'set'; dots(); return prompt('pin_mismatch', true); }
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(S.K.pinSalt, salt); localStorage.setItem(S.K.pinHash, await hashPin(entered, salt)); localStorage.setItem(S.K.pinOn, 'true'); localStorage.removeItem(S.K.pin);
      hidePin(); renderSettings(); return UI.toast(t('pin_set_ok'), '🔐');
    }
    // verify / disable
    if (lockCheck()) { pinBuf = ''; dots(); return; }
    const salt = S.rawGet(S.K.pinSalt) || '', h = S.rawGet(S.K.pinHash), legacy = S.rawGet(S.K.pin);
    let ok = false;
    if (h) ok = (await hashPin(entered, salt)) === h; else if (legacy) { ok = entered === legacy; if (ok) { const s2 = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(S.K.pinSalt, s2); localStorage.setItem(S.K.pinHash, await hashPin(entered, s2)); localStorage.removeItem(S.K.pin); } }
    if (ok) {
      S.remove(S.K.pinFail);
      if (pinMode === 'disable') { ['pinOn', 'pinHash', 'pinSalt', 'pin'].forEach(k => localStorage.removeItem(S.K[k])); hidePin(); renderSettings(); return UI.toast(t('pin_off_ok'), '🔓'); }
      return hidePin();
    }
    const f = S.get(S.K.pinFail, { n: 0, until: 0 }); f.n++; if (f.n >= 5) { f.until = Date.now() + 30000 * Math.pow(2, Math.min(5, f.n - 5)); } S.set(S.K.pinFail, f);
    pinBuf = ''; dots(); if (!lockCheck()) { prompt('pin_wrong', true); setTimeout(() => { if (!isLocked()) prompt('pin_enter'); }, 1200); }
  }
  document.querySelectorAll('.pin-key[data-pin]').forEach(b => b.addEventListener('click', () => {
    const k = b.getAttribute('data-pin');
    if (k === 'del') { pinBuf = pinBuf.slice(0, -1); return dots(); }
    if (pinBuf.length >= 4) return; if (pinMode !== 'set' && pinMode !== 'confirm' && lockCheck()) return;
    pinBuf += k; dots(); if (pinBuf.length === 4) setTimeout(pinDone, 160);
  }));
  UI.act('togglePin', () => { if (pinEnabled()) showPin('disable'); else showPin('set'); });
  UI.act('pinCancel', () => { hidePin(); renderSettings(); });
  UI.act('toggleAutolock', () => { S.patchPrefs({ autolock: S.prefs().autolock === false }); renderSettings(); });
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (pinEnabled() && S.prefs().autolock !== false && hiddenAt && Date.now() - hiddenAt > 30000 && $('pin-overlay').classList.contains('hidden')) showPin('verify');
  });

  const FFSettings = {
    applyRecurring, pinEnabled, lock: () => showPin('verify'),
    resetUI() { UI.applyTheme(); UI.applyLang(); }
  };
  root.FFSettings = FFSettings;
})(window);

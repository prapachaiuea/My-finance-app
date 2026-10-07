/* FinFlow — Scan page: multi-slip queue, every field editable, warnings on anything the reader is not sure about. */
(function (root) {
  'use strict';
  const { U, S, C, I18N, t, UI, LRN, SLIP, OCR } = root;
  const $ = UI.$, esc = U.esc;

  let Q = [], seq = 0, running = false, idleTimer = null;

  const STATUS_KEY = { wait: 'st_wait', read: 'st_read', ready: 'st_ready', check: 'st_check', dup: 'st_dup', saved: 'st_saved', err: 'st_err', skip: 'st_skip' };
  const FIELD_OF = { f_amount_missing: 'amount', f_amount_disagree: 'amount', f_date_missing: 'date', f_date_disagree: 'date', f_date_future: 'date', f_time_missing: 'time', f_name_low: 'to', f_name_first: 'to', f_note_low: 'note', f_dup_certain: 'all', f_dup_prob: 'all', f_own: 'type', f_layout: 'all' };

  function flagsOf(it) { return it.flags || []; }
  function fieldFlag(it, f) { return flagsOf(it).filter(c => FIELD_OF[c] === f); }
  const warn = (it, f) => fieldFlag(it, f).length ? ' warn-input' : '';
  const noteHTML = (it, f) => fieldFlag(it, f).map(c => `<div class="flag-note">⚠️ ${esc(t(c))}</div>`).join('');

  function cardHTML(it, i) {
    const f = it.form, multi = S.accts().length > 1;
    const stKey = it.status;
    const kind = it.res && it.res.kind ? t('kind_' + it.res.kind) : '';
    const typeBtns = ['income', 'expense', 'transfer'].map(ty => `<button type="button" class="type-btn ${ty}-t${f.type === ty ? ' active' : ''}" data-act="scType" data-arg="${ty}">${esc(t('t_' + ty))}</button>`).join('');
    const catSel = f.type === 'transfer' ? '' : `<div class="field full"><div class="field-label">${esc(t('sc_cat'))}</div><div class="select-arrow"><select data-f="cat">${UI.catOptions(f.type, f.cat)}</select></div></div>`;
    const acctSel = (multi || f.type === 'transfer') ? `<div class="field${f.type === 'transfer' ? '' : ' full'}"><div class="field-label">${esc(f.type === 'income' ? t('account') : t('from_acct'))}</div><div class="select-arrow"><select data-f="acct">${UI.acctOptions(f.acct || 'main')}</select></div></div>` + (f.type === 'transfer' ? `<div class="field"><div class="field-label">${esc(t('to_acct'))}</div><div class="select-arrow"><select data-f="toAcct">${UI.acctOptions(f.toAcct || '', true)}</select></div></div>` : '') : '';
    const body = (it.status === 'wait' || it.status === 'read') ? `<div class="ocr-status" style="margin:0"><div class="ocr-spinner"></div><span class="ocr-text">${esc(it.status === 'wait' ? t('st_wait') : it.step ? t('scan_step', { s: t(it.step) }) : t('st_read'))}</span></div>`
      : it.status === 'saved' || it.status === 'skip' ? '' : `
      <div class="${it.own && f.type !== 'transfer' ? 'banner info' : 'hidden-x'}" ${it.own && f.type !== 'transfer' ? 'data-act="scAsTransfer"' : 'hidden'} style="margin:0 0 10px"><span>${esc(t('f_own'))}</span></div>
      <div class="type-toggle three">${typeBtns}</div>
      <div class="sc-grid">
        <div class="field full${warn(it, 'amount') ? ' warn' : ''}"><div class="field-label">${esc(t('sc_amount'))}</div><div class="amount-prefix"><input class="amount-field" type="text" inputmode="decimal" data-f="amount" value="${esc(f.amount)}" placeholder="0.00"/></div>${noteHTML(it, 'amount')}</div>
        <div class="field${warn(it, 'date') ? ' warn' : ''}"><div class="field-label">${esc(t('sc_date'))}</div><input type="date" data-f="date" value="${esc(f.date)}"/>${noteHTML(it, 'date')}</div>
        <div class="field${warn(it, 'time') ? ' warn' : ''}"><div class="field-label">${esc(t('sc_time'))}</div><input type="time" data-f="time" value="${esc(f.time)}"/>${noteHTML(it, 'time')}</div>
        <div class="field full${warn(it, 'to') ? ' warn' : ''}"><div class="field-label">${esc(t('sc_to'))}</div><input type="text" data-f="payee" maxlength="120" value="${esc(f.payee)}"/>${noteHTML(it, 'to')}${it.learned ? `<div class="ok-note">✓ ${esc(t('f_learned'))}</div>` : ''}</div>
        <div class="field full"><div class="field-label">${esc(t('sc_desc'))}</div><input type="text" data-f="name" maxlength="120" value="${esc(f.name)}" list="dl-names"/></div>
        <div class="field full${warn(it, 'note') ? ' warn' : ''}"><div class="field-label">${esc(t('sc_note'))}</div><input type="text" data-f="note" maxlength="200" value="${esc(f.note)}"/>${noteHTML(it, 'note')}</div>
        ${catSel}${acctSel}
      </div>
      ${fieldFlag(it, 'all').map(c => `<div class="flag-note" style="margin-bottom:8px">⚠️ ${esc(t(c))}</div>`).join('')}
      <div class="sc-actions"><button class="btn-cancel" data-act="scSkip">${esc(t('skip_one'))}</button><button class="btn-save" data-act="scSave">${esc(t('save_one'))}</button></div>`;
    return `<div class="sc-card ${it.status === 'saved' ? 'saved' : ''}" data-i="${i}" data-id="${it.id}">
      <div class="sc-head"><img class="sc-thumb" src="${it.thumbUrl || ''}" alt="" data-act="scZoom"/><div><div class="sc-title">#${i + 1}${kind ? ' · ' + esc(kind) : ''}</div><span class="sc-status ${stKey}">${esc(t(STATUS_KEY[it.status]))}</span></div></div>${body}</div>`;
  }
  function renderQueue() {
    $('scan-queue').innerHTML = Q.map(cardHTML).join('');
    $('scan-tips').hidden = Q.length > 0;
    updateSaveAll();
  }
  function renderCard(it) {
    const i = Q.indexOf(it), el = $('scan-queue').querySelector(`.sc-card[data-id="${it.id}"]`);
    if (!el) return renderQueue();
    const tmp = document.createElement('div'); tmp.innerHTML = cardHTML(it, i); el.replaceWith(tmp.firstElementChild); UI.moneyInput($('scan-queue').querySelector(`.sc-card[data-id="${it.id}"] [data-f="amount"]`)); updateSaveAll();
  }
  function updateSaveAll() {
    const n = Q.filter(x => x.status === 'ready').length, b = $('scan-save-all');
    b.hidden = n < 2; b.textContent = t('save_all', { n });
  }

  /* ---------- reading ---------- */
  async function process() {
    if (running) return; running = true; clearTimeout(idleTimer);
    try {
      $('scan-status').hidden = false; $('scan-status-text').textContent = t('scan_loading'); $('scan-progress-bar').style.width = '3%';
      try { await OCR.ensure(); } catch (e) { Q.filter(x => x.status === 'wait').forEach(x => { x.status = 'err'; x.flags = []; }); renderQueue(); UI.toast(t('scan_loading_fail'), '⚠️', { ms: 6000 }); return; }
      for (;;) {
        const it = Q.find(x => x.status === 'wait'); if (!it) break;
        const idx = Q.indexOf(it) + 1, total = Q.length;
        it.status = 'read'; renderCard(it);
        $('scan-status-text').textContent = t('scan_reading', { i: idx, n: total });
        try {
          const r = await OCR.scan(it.file, { onStep: s => { it.step = s; const c = $('scan-queue').querySelector(`.sc-card[data-id="${it.id}"] .ocr-text`); if (c) c.textContent = t('scan_step', { s: t(s) }); }, onProgress: p => { $('scan-progress-bar').style.width = Math.round(((idx - 1) + p) / total * 100) + '%'; } });
          it.thumbBlob = r.thumb; if (r.thumb) { if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl); it.thumbUrl = URL.createObjectURL(r.thumb); }
          fill(it, SLIP.interpret(r.raw, { today: U.dateStr() }));
        } catch (e) { console.error('scan', e); it.status = 'err'; it.flags = []; it.form = it.form || blankForm(); }
        it.step = null; renderCard(it);
      }
    } finally {
      running = false; $('scan-status').hidden = true;
      idleTimer = setTimeout(() => OCR.terminate(), 90000);     // free the OCR engine's memory when idle
    }
  }
  function blankForm() { return { type: 'expense', amount: '', date: U.dateStr(), time: '', payee: '', name: '', note: '', cat: (S.cats('expense').find(c => c.name === 'Other') || S.cats('expense')[0] || {}).name || 'Other', acct: 'main', toAcct: '' }; }

  function fill(it, res) {
    it.res = res; it.flags = res.flags.map(f => f.code);
    const received = res.kind === 'receive';
    const sug = LRN.suggest({ recipient: received ? res.sender : res.recipient, recipientKey: received ? res.senderKey : res.recipientKey, note: res.note, ownHint: res.ownHint }, S.txs());
    const f = blankForm();
    f.amount = res.amount.value ? String(res.amount.value) : '';
    f.date = res.date || U.dateStr(); f.time = res.time || '';
    f.payee = received ? res.sender : res.recipient;
    f.name = sug.name || res.note || f.payee || ''; f.note = sug.note || '';
    f.type = received ? 'income' : sug.type === 'transfer' || (sug.own && sug.learned) ? 'transfer' : 'expense';
    if (f.type === 'income') { const c = S.cats('income'); f.cat = (LRN.keywordCat([f.note, f.name].join(' '), 'income', c) || (c.find(x => x.name === 'Other income') || c[0] || {}).name); }
    else if (f.type === 'transfer') f.cat = '';
    else f.cat = sug.cat || f.cat;
    it.form = f; it.learned = sug.learned; it.own = sug.own && f.type !== 'transfer';
    if (!sug.learned && f.payee && res.recipientKey && !received) it.flags.push('f_name_first');
    // duplicates
    const probe = { id: 0, type: f.type, amount: res.amount.value || 0, date: f.date, time: f.time || null, slipRef: res.slipRef || undefined };
    const dup = res.amount.value ? C.findDuplicate(S.txs(), probe) : null;
    if (dup) it.flags.push(dup.certain ? 'f_dup_certain' : 'f_dup_prob');
    if (it.own) it.flags.push('f_own');
    const blocking = it.flags.filter(c => c !== 'f_name_first' && c !== 'f_own');
    it.status = !res.amount.value && !res.date ? 'err' : dup && dup.certain ? 'dup' : (blocking.length || (it.flags.includes('f_name_first'))) ? 'check' : 'ready';
    if (it.status === 'err') it.flags = it.flags.concat([]);
  }

  /* ---------- input handling ---------- */
  function itemOf(el) { const c = el.closest('.sc-card'); return c ? Q.find(x => x.id === +c.getAttribute('data-id')) : null; }
  $('scan-queue').addEventListener('input', e => {
    const f = e.target.getAttribute && e.target.getAttribute('data-f'), it = itemOf(e.target); if (!f || !it) return;
    it.form[f] = e.target.value;
    const clear = { amount: ['f_amount_missing', 'f_amount_disagree'], date: ['f_date_missing', 'f_date_disagree', 'f_date_future'], time: ['f_time_missing'], payee: ['f_name_low', 'f_name_first'], note: ['f_note_low'] }[f];
    if (clear && it.flags.some(c => clear.includes(c))) { it.flags = it.flags.filter(c => !clear.includes(c)); e.target.closest('.field').classList.remove('warn'); e.target.classList.remove('warn-input'); const n = e.target.closest('.field').querySelectorAll('.flag-note'); n.forEach(x => x.remove()); }
  });
  $('scan-queue').addEventListener('change', e => { const f = e.target.getAttribute && e.target.getAttribute('data-f'), it = itemOf(e.target); if (f && it) it.form[f] = e.target.value; });
  UI.act('scType', (ty, el) => { const it = itemOf(el); if (!it) return; it.form.type = ty; it.form.cat = ty === 'transfer' ? '' : (ty === 'income' ? (S.cats('income')[0] || {}).name : (it.res ? LRN.suggest({ recipient: it.form.payee, recipientKey: it.res.recipientKey, note: it.form.note, ownHint: false }, S.txs()).cat : blankForm().cat)); it.own = false; it.flags = it.flags.filter(c => c !== 'f_own'); renderCard(it); });
  UI.act('scAsTransfer', (a, el) => { const it = itemOf(el); if (!it) return; it.form.type = 'transfer'; it.form.cat = ''; it.own = false; it.flags = it.flags.filter(c => c !== 'f_own'); renderCard(it); });
  UI.act('scZoom', (a, el) => { const it = itemOf(el); if (it && it.thumbUrl) UI.viewImage(it.thumbUrl); });
  UI.act('scSkip', (a, el) => { const it = itemOf(el); if (!it) return; it.status = 'skip'; renderCard(it); setTimeout(() => { Q = Q.filter(x => x !== it); if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl); renderQueue(); }, 400); });

  async function saveItem(it, silent) {
    const f = it.form, amount = U.parseMoney(f.amount);
    if (!(amount > 0)) { if (!silent) UI.toast(t('bad_amount'), '⚠️'); return false; }
    if (!U.isDateStr(f.date) || isNaN(U.parseDate(f.date))) { if (!silent) UI.toast(t('bad_date'), '⚠️'); return false; }
    const type = f.type, name = (f.name || f.payee || f.note || '').trim() || (type === 'transfer' ? t('transfer_cat') : t('from_slip'));
    const tx = { id: U.uid(), type, amount, name, date: f.date, time: U.validTime(f.time) ? f.time : null, note: (f.note || '').trim() || null, payee: (f.payee || '').trim() || undefined };
    if (type === 'transfer') { tx.cat = ''; tx.emoji = '🔁'; tx.acct = f.acct || 'main'; if (f.toAcct) tx.toAcct = f.toAcct; if (tx.toAcct && tx.toAcct === tx.acct) { if (!silent) UI.toast(t('same_acct'), '⚠️'); return false; } }
    else { tx.cat = f.cat; tx.emoji = UI.catEmoji(type, f.cat); if (f.acct && f.acct !== 'main') tx.acct = f.acct; }
    if (it.res && it.res.slipRef) tx.slipRef = it.res.slipRef;
    const dup = C.findDuplicate(S.txs(), tx);
    if (dup && !silent && !(await UI.confirm(t(dup.certain ? 'f_dup_certain' : 'dup_warn', { n: dup.tx.name, a: U.fmt(dup.tx.amount), d: I18N.dateLabel(dup.tx.date, { noYear: true }), t: dup.tx.time || '' }) + '\n' + t('save') + '?', t('save')))) return false;
    if (f.date > U.dateStr() && !silent && !(await UI.confirm(t('future_date', { d: I18N.dateLabel(f.date) }), t('save')))) return false;
    if (S.prefs().saveImg && it.thumbBlob) { if (await S.putImg(tx.id, it.thumbBlob)) tx.hasImg = true; }
    if (!S.addTx(tx)) { if (!silent) UI.toast(t('storage_full'), '⚠️', { ms: 5000 }); if (tx.hasImg) S.delImg(tx.id); return false; }
    // learn: who is this account, what do I call it, which category, and which accounts are mine
    if (it.res) {
      const key = it.res.kind === 'receive' ? it.res.senderKey : it.res.recipientKey;
      LRN.remember({ key, recipient: tx.payee || '', name: tx.name, cat: tx.cat, emoji: tx.emoji, type: tx.type });
      if (it.res.senderKey && it.res.kind !== 'receive') LRN.addMine(it.res.senderKey);
      if (type === 'transfer' && it.res.recipientKey) LRN.addMine(it.res.recipientKey);
    }
    S.patchPrefs({ txSinceBackup: (S.prefs().txSinceBackup || 0) + 1 });
    FFBudget && FFBudget.check(tx);
    it.status = 'saved'; return true;
  }
  UI.act('scSave', async (a, el) => { const it = itemOf(el); if (!it || it.busy) return; it.busy = true; try { if (await saveItem(it)) { UI.toast(t('saved'), '✅'); renderCard(it); afterSave(); } } finally { it.busy = false; } });
  UI.act('scanSaveAll', async () => {
    let n = 0; for (const it of Q.filter(x => x.status === 'ready')) { if (await saveItem(it, true)) { n++; renderCard(it); } }
    if (n) UI.toast(t('saved') + ' ×' + n, '✅'); afterSave();
  });
  function afterSave() {
    updateSaveAll();
    if (Q.length && Q.every(x => ['saved', 'skip'].includes(x.status))) { const last = Q.filter(x => x.status === 'saved').map(x => x.form.date).sort().pop(); if (last) UI.month = { y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 }; setTimeout(() => { Q = []; renderQueue(); UI.go('home'); }, 700); }
  }

  /* ---------- picking files ---------- */
  $('slip-input').addEventListener('change', e => {
    const files = [...e.target.files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name)); e.target.value = '';
    if (!files.length) return;
    Q = Q.filter(x => { const done = x.status === 'saved' || x.status === 'skip'; if (done && x.thumbUrl) URL.revokeObjectURL(x.thumbUrl); return !done; });     // finished cards make room for the new batch
    files.slice(0, 40).forEach(f => Q.push({ id: ++seq, file: f, status: 'wait', thumbUrl: URL.createObjectURL(f), flags: [], form: blankForm() }));
    renderQueue(); process();
  });
  UI.page('scan', { show() { root.FFTx && FFTx.suggestNames(); renderQueue(); } });
  root.addEventListener('pagehide', () => { try { OCR.terminate(); } catch (_) { } });
})(window);

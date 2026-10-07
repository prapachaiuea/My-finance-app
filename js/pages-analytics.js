/* FinFlow — Analytics, budgets (+ alerts), summary report. */
(function (root) {
  'use strict';
  const { U, S, C, I18N, t, UI } = root;
  const $ = UI.$, esc = U.esc;
  const COLORS = ['#00D28F', '#60A5FA', '#A78BFA', '#FFB347', '#FF6B6B', '#34D399', '#F472B6', '#FBBF24', '#818CF8'];
  let catBarType = 'expense', lblMode = 'amount';

  /* "open the All-transactions page with these filters" — used by every drill-down on this page */
  const drill = f => UI.openAll(f);

  function meter(pct, over) {
    const col = over ? 'var(--red)' : pct >= 80 ? '#F5A623' : 'var(--green)';
    return `<div class="meter"><div style="width:${Math.min(100, pct)}%;background:${col}"></div></div>`;
  }
  const signed = (v, sym) => (v < 0 ? '−' : '') + U.fmt(v);

  /* =========================================================== BUDGET / FORECAST / ALERTS */
  function renderBudgetCard(y, m, txs) {
    const total = S.budgetTotal(), per = S.catBudgets(), has = total > 0 || Object.values(per).some(v => +v > 0);
    $('budget-card').hidden = !has; if (!has) return;
    const st = C.budgetStatus(txs, y, m, total, per);
    const col = st.over ? 'var(--red)' : st.pct >= 80 ? '#F5A623' : 'var(--green)';
    $('budget-progress-content').innerHTML = total ? `
      <div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:13px;color:var(--text2)">${U.fmt(st.spent)} <span style="color:var(--text3)">/ ${U.fmt(total)}</span></span><span style="font-size:14px;font-weight:800;color:${col}">${st.pct}%</span></div>
      ${meter(st.pct, st.over)}
      ${st.over ? `<div class="flag-note" style="color:var(--red)">⚠️ ${esc(t('over_by', { v: U.fmt(st.spent - total) }))}</div>` : st.pct >= 80 ? `<div class="flag-note">⚡ ${esc(t('remaining_pct', { p: 100 - st.pct }))}</div>` : ''}` : '';
    $('cat-budget-content').innerHTML = st.cats.length ? `<div class="chart-subtitle" style="margin-bottom:8px">${esc(t('cat_budgets'))}</div>` + st.cats.map(c => `
      <div class="tap-row" data-act="drillCat" data-arg="${esc(c.cat)}" role="button" tabindex="0" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>${esc(UI.catEmoji('expense', c.cat))} ${esc(I18N.catLabel(c.cat))}</span><span style="color:${c.over ? 'var(--red)' : 'var(--text2)'}">${U.fmt(c.used)} / ${U.fmt(c.limit)} · ${c.pct}%</span></div>${meter(c.pct, c.over)}</div>`).join('') : '';
  }

  function renderForecast(y, m, txs, tot) {
    const today = U.dateStr(), p = C.projection(txs, y, m, today), card = $('forecast-card');
    card.hidden = !(p.running && p.spent > 0); if (card.hidden) return;
    const [py, pm] = C.prevMonth(y, m), lastFull = C.totals(C.monthTx(txs, py, pm)).expense, bud = S.budgetTotal();
    let html = `<div class="fc-row"><div><div class="fc-lbl">${esc(t('fc_spent'))}</div><div class="fc-val">${U.fmt(p.spent)}</div><div class="fc-sub">${p.day}/${p.dim} · ${esc(t('fc_per_day', { v: U.fmt(p.perDay) }))}</div></div><div style="text-align:right"><div class="fc-lbl">${esc(t('fc_projected'))}</div><div class="fc-val" style="color:var(--amber)">≈ ${U.fmt(p.projected)}</div></div></div>`;
    html += meter(Math.round(p.day / p.dim * 100), false).replace('background:var(--green)', 'background:var(--blue)');
    const notes = [];
    if (p.lump > 0) notes.push(t('fc_lump', { v: U.fmt(p.lump) }));
    if (lastFull > 0) { const d = Math.round((p.projected - lastFull) / lastFull * 100); notes.push(t('fc_vs_last', { p: (d > 0 ? '+' : '') + d + '%' })); }
    if (tot.income > 0) { const left = U.round2(tot.income - p.projected); notes.push(left >= 0 ? t('fc_left_income', { v: U.fmt(left) }) : t('fc_over_income', { v: U.fmt(-left) })); }
    if (bud > 0) { const d = U.round2(bud - p.projected); notes.push(d >= 0 ? t('fc_budget_ok', { v: U.fmt(d) }) : t('fc_budget_over', { v: U.fmt(-d) })); }
    html += notes.map(n => `<div class="fc-note">${esc(n)}</div>`).join('');
    $('forecast-body').innerHTML = html;
  }

  function renderAlerts(y, m, txs, tot) {
    const out = [], today = U.dateStr();
    if (tot.income > 0 && tot.expense > tot.income) out.push(`<div class="banner red"><span>⚠️ ${esc(t('al_over_income', { v: U.fmt(tot.expense - tot.income) }))}</span></div>`);
    if (!S.budgetTotal() && UI.isCurrentMonth()) { const v = C.suggestBudget(txs, y, m); if (v > 0) out.push(`<div class="banner info" data-act="suggestBudget" data-arg="${v}" role="button" tabindex="0"><span>💡 ${esc(t('al_set_budget', { v: U.fmt(v) }))}</span></div>`); }
    $('an-alerts').innerHTML = out.join('');
  }
  UI.act('suggestBudget', async v => { if (!(await UI.confirm(t('al_budget_q', { v: U.fmt(+v) }), t('save')))) return; S.setBudgetTotal(+v); UI.toast(t('al_budget_set', { v: U.fmt(+v) }), '🎯'); renderAnalytics(); });

  /* =========================================================== CHARTS */
  function renderDonut(list) {
    const svg = $('donut-svg'), legend = $('donut-legend');
    const cats = C.catTotals(list, catBarType);
    if (!cats.length) { svg.innerHTML = `<text x="55" y="58" text-anchor="middle" fill="var(--text3)" font-size="11">${esc(t('no_data'))}</text>`; legend.innerHTML = ''; svg.setAttribute('aria-label', t('no_data')); return; }
    const entries = cats.slice(0, 6).map(c => ({ ...c, drill: c.cat })), rest = cats.slice(6).reduce((s, c) => s + c.total, 0);
    if (rest > 0) entries.push({ cat: t('other_cats'), total: U.round2(rest), drill: null });
    const total = entries.reduce((s, c) => s + c.total, 0), R = 32, circ = 2 * Math.PI * R;
    let off = 0, html = '';
    entries.forEach((c, i) => {
      const len = c.total / total * circ;
      html += `<circle cx="55" cy="55" r="${R}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 55 55)" opacity="0.92"/>`;
      off += len;
    });
    svg.innerHTML = html; svg.setAttribute('aria-label', entries.map(c => I18N.catLabel(c.cat) + ' ' + Math.round(c.total / total * 100) + '%').join(', '));
    legend.innerHTML = entries.map((c, i) => `<div class="legend-item${c.drill ? ' tap-row' : ''}" ${c.drill ? `data-act="drillCat" data-arg="${esc(c.drill)}" role="button" tabindex="0"` : ''}><div class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></div><span class="legend-label">${esc(I18N.catLabel(c.cat))}</span><span class="legend-amt">${U.fmtShort(c.total)}</span><span class="legend-pct">${Math.round(c.total / total * 100)}%</span></div>`).join('');
  }
  UI.act('catBarType', ty => { catBarType = ty; document.querySelectorAll('#cat-seg button').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === ty)); const list = C.monthTx(S.txs(), UI.month.y, UI.month.m); renderDonut(list); renderCatBars(list); });
  UI.act('drillCat', cat => drill({ cat, type: catBarType === 'income' ? 'income' : 'expense', month: UI.month }));

  function last6(y, m) { const a = []; for (let i = 5; i >= 0; i--) { let mm = m - i, yy = y; if (mm < 0) { mm += 12; yy--; } a.push([yy, mm]); } return a; }
  let barData = [];
  function renderBars(txs, y, m) {
    barData = last6(y, m).map(([yy, mm], i) => { const l = C.monthTx(txs, yy, mm); return { y: yy, m: mm, label: t('months_short')[mm], val: C.totals(l).expense, n: l.length, cur: i === 5 }; });
    const max = Math.max(...barData.map(x => x.val), 1);
    $('bar-chart').innerHTML = barData.map((x, i) => `<div class="bar-col tap-row" data-act="barPick" data-arg="${i}" role="button" tabindex="0"><div class="bar-val">${x.val > 0 ? U.fmtShort(x.val) : ''}</div><div class="bar-fill ${x.cur ? 'active-bar' : 'past-bar'}" style="height:${Math.max(6, Math.round(x.val / max * 80))}px"></div><div class="bar-month">${esc(x.label)}</div></div>`).join('');
    $('bar-info').innerHTML = esc(t('tap_hint'));
  }
  UI.act('barPick', i => {
    const x = barData[+i]; if (!x) return;
    document.querySelectorAll('#bar-chart .bar-fill').forEach((b, k) => b.classList.toggle('picked', k === +i));
    $('bar-info').innerHTML = `<span>${esc(t('info_line', { a: I18N.monthLabel(x.y, x.m), v: U.fmt(x.val), n: x.n }))}</span> <button class="small-btn primary" data-act="barOpen" data-arg="${i}">${esc(t('view_tx'))}</button>`;
  });
  UI.act('barOpen', i => { const x = barData[+i]; if (x) drill({ month: { y: x.y, m: x.m }, type: 'expense' }); });

  function renderLine(txs, y, m) {
    const svg = $('line-svg'), W = Math.max(220, svg.parentElement.clientWidth - 36 || 300), H = 90, pad = 10;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const ms = last6(y, m).map(([yy, mm]) => C.totals(C.monthTx(txs, yy, mm)));
    const max = Math.max(...ms.map(x => Math.max(x.income, x.expense)), 1), xs = (W - pad * 2) / 5;
    const Y = v => H - pad - Math.round(v / max * (H - pad * 2));
    const pts = k => ms.map((x, i) => `${pad + i * xs},${Y(x[k])}`).join(' ');
    svg.innerHTML = `<polyline points="${pts('income')}" fill="none" stroke="var(--green)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><polyline points="${pts('expense')}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`
      + ms.map((x, i) => `<circle cx="${pad + i * xs}" cy="${Y(x.income)}" r="3" fill="var(--green)"/><circle cx="${pad + i * xs}" cy="${Y(x.expense)}" r="3" fill="var(--red)"/>`).join('');
  }
  function renderNW(txs, y, m) {
    const svg = $('nw-svg'), W = Math.max(220, svg.parentElement.clientWidth - 36 || 300), H = 60, pad = 10, accts = S.accts();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const months = last6(y, m), pts = months.map(([yy, mm]) => C.balanceAt(txs, accts, yy, mm));
    const mn = Math.min(...pts), mx = Math.max(...pts), range = mx - mn || 1, xs = (W - pad * 2) / 5;
    const Y = v => H - pad - Math.round((v - mn) / range * (H - pad * 2));
    const line = pts.map((v, i) => `${pad + i * xs},${Y(v)}`).join(' '), last = pts[5], col = last >= 0 ? 'var(--green)' : 'var(--red)';
    svg.innerHTML = `<defs><linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.25"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
      <polygon points="${pad},${Y(pts[0])} ${line} ${pad + 5 * xs},${H + 4} ${pad},${H + 4}" fill="url(#nwg)"/><polyline points="${line}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map((v, i) => `<circle cx="${pad + i * xs}" cy="${Y(v)}" r="3" fill="${col}"/>`).join('')}`;
    const now = $('nw-now'); now.textContent = signed(last); now.style.color = last >= 0 ? 'var(--green)' : 'var(--red)';
    $('nw-trend-labels').innerHTML = months.map(([, mm]) => `<span style="flex:1;text-align:center;font-size:9px;color:var(--text3)">${esc(t('months_short')[mm])}</span>`).join('');
  }

  let heatDay = {}, heatY = 0, heatM = 0;
  function renderHeat(list, y, m) {
    heatY = y; heatM = m;
    const days = U.daysInMonth(y, m), first = new Date(y, m, 1).getDay(), tot = C.dayTotals(list, 'expense'), max = Math.max(...Object.values(tot), 1);
    const cnt = {}; list.forEach(x => { if (x.type === 'expense') { const d = +x.date.slice(8, 10); cnt[d] = (cnt[d] || 0) + 1; } }); heatDay = { tot, cnt };
    const today = U.dateStr(); let html = t('wd_short').map(l => `<div class="hm-day-label">${esc(l)}</div>`).join('');
    for (let i = 0; i < first; i++) html += '<div class="hm-cell" style="background:none"></div>';
    for (let d = 1; d <= days; d++) {
      const v = tot[d] || 0, lvl = v === 0 ? 'l0' : v < max * .25 ? 'l1' : v < max * .5 ? 'l2' : v < max * .75 ? 'l3' : 'l4';
      html += `<div class="hm-cell tap-row ${lvl}${U.monthKey(y, m) + '-' + U.p2(d) === today ? ' today' : ''}" data-act="hmPick" data-arg="${d}" role="button" tabindex="0" aria-label="${esc(t('day_n', { d }))}: ${U.fmt(v)}"></div>`;
    }
    $('heatmap').innerHTML = html; $('hm-info').innerHTML = esc(t('tap_hint'));
  }
  UI.act('hmPick', d => {
    const v = heatDay.tot[+d] || 0, n = heatDay.cnt[+d] || 0, ds = U.monthKey(heatY, heatM) + '-' + U.p2(+d);
    $('hm-info').innerHTML = `<span>${esc(t('info_line', { a: I18N.dateLabel(ds, { noYear: true }), v: v ? U.fmt(v) : t('no_spend'), n }))}</span> ${n ? `<button class="small-btn primary" data-act="hmOpen" data-arg="${ds}">${esc(t('view_tx'))}</button>` : ''}`;
  });
  UI.act('hmOpen', ds => drill({ date: ds }));

  function renderWeekday(txs, y, m) {
    const avg = C.weekdayAvg(txs, y, m, 3, U.dateStr()), max = Math.max(...avg, 1), peak = avg.indexOf(Math.max(...avg));
    $('weekday-chart').innerHTML = avg.map((v, i) => `<div class="bar-col"><div class="bar-val">${v > 0 ? U.fmtShort(v) : ''}</div><div class="bar-fill ${i === peak && v > 0 ? 'active-bar' : 'past-bar'}" style="height:${Math.max(6, Math.round(v / max * 80))}px"></div><div class="bar-month">${esc(t('wd_short')[i])}</div></div>`).join('');
  }

  function renderCatBars(list) {
    const arr = C.catTotals(list, catBarType).slice(0, 6), box = $('cat-bars');
    if (!arr.length) { box.innerHTML = `<div style="text-align:center;padding:16px;font-size:13px;color:var(--text3)">${esc(catBarType === 'expense' ? t('no_exp_month') : t('no_inc_month'))}</div>`; return; }
    const max = arr[0].total; let prev = {};
    if (catBarType === 'expense') {                                  // change vs the previous period (same number of days while the month runs)
      const { y, m } = UI.month, cmp = C.comparePeriod(S.txs(), y, m, U.dateStr()), [py, pm] = C.prevMonth(y, m);
      C.catTotals(C.monthUpTo(S.txs(), py, pm, cmp.day), 'expense').forEach(c => { prev[c.cat] = c.total; });
      const cur = {}; C.catTotals(C.monthUpTo(S.txs(), y, m, cmp.day), 'expense').forEach(c => { cur[c.cat] = c.total; }); prev._cur = cur;
    }
    box.innerHTML = arr.map(c => {
      let delta = '';
      if (catBarType === 'expense') { const p = prev[c.cat] || 0, n = (prev._cur && prev._cur[c.cat]) || 0; if (p > 0) { const d = Math.round((n - p) / p * 100); if (d !== 0) delta = `<span class="delta ${d > 0 ? 'up' : 'down'}" title="${esc(t('vs_prev_cat'))}">${d > 0 ? '▲' : '▼'}${Math.abs(d)}%</span>`; } else if (n > 0) delta = `<span class="delta up">NEW</span>`; }
      return `<div class="cat-bar-row tap-row" data-act="drillCat" data-arg="${esc(c.cat)}" role="button" tabindex="0"><div class="cat-bar-icon">${esc(c.emoji || '📦')}</div><div class="cat-bar-info"><div class="cat-bar-name">${esc(I18N.catLabel(c.cat))} ${delta}</div><div class="cat-bar-track"><div class="cat-bar-fill ${catBarType === 'income' ? 'income-fill' : ''}" style="width:${Math.round(c.total / max * 100)}%"></div></div></div><div class="cat-bar-amt">${U.fmt(c.total)}</div></div>`;
    }).join('');
  }

  function renderLabels(list) {
    const arr = C.topLabels(list).sort((a, b) => lblMode === 'count' ? (b.n - a.n || b.total - a.total) : (b.total - a.total)).slice(0, 8), box = $('label-list');
    if (!arr.length) { box.innerHTML = `<div style="text-align:center;padding:16px;font-size:13px;color:var(--text3)">${esc(t('no_exp_month'))}</div>`; return; }
    box.innerHTML = arr.map(x => `<div class="list-row tap-row" data-act="drillLabel" data-arg="${esc(x.label)}" role="button" tabindex="0"><span class="lr-name">${esc(x.label)}</span><span class="lr-n">${esc(t('times_n', { n: x.n }))}</span><span class="lr-amt">${U.fmt(x.total)}</span></div>`).join('');
  }
  UI.act('lblMode', mode => { lblMode = mode; document.querySelectorAll('#lbl-seg button').forEach(b => b.classList.toggle('active', b.getAttribute('data-arg') === mode)); renderLabels(C.monthTx(S.txs(), UI.month.y, UI.month.m)); });
  UI.act('drillLabel', q => drill({ q, month: UI.month, type: 'expense' }));

  /* =========================================================== PAGE */
  function renderAnalytics() {
    const { y, m } = UI.month, txs = S.txs(), list = C.monthTx(txs, y, m), tot = C.totals(list), today = U.dateStr();
    $('analytics-month').textContent = I18N.monthLabel(y, m);
    $('an-expense').textContent = U.fmt(tot.expense);
    const rs = $('an-expense-sub'); rs.hidden = !(tot.refunds > 0); if (tot.refunds > 0) rs.textContent = t('an_refund_sub', { v: U.fmt(tot.refunds) });
    const cmp = C.comparePeriod(txs, y, m, today), vs = $('an-vs'), vsSub = $('an-vs-sub');
    $('an-vs-label').textContent = cmp.partial ? t('an_vs_period', { d: cmp.day }) : t('vs_last');
    vsSub.hidden = !(cmp.pct !== null); if (cmp.pct !== null) vsSub.textContent = U.fmt(cmp.now) + ' / ' + U.fmt(cmp.prev);
    if (cmp.pct === null) { vs.textContent = '—'; vs.style.color = 'var(--text)'; } else { vs.textContent = (cmp.pct > 0 ? '+' : '') + cmp.pct + '%'; vs.style.color = cmp.pct > 0 ? 'var(--red)' : 'var(--green)'; }
    const sr = $('an-savings-rate'); if (tot.income > 0) { const v = Math.round((tot.income - tot.expense) / tot.income * 100); sr.textContent = v + '%'; sr.style.color = v < 0 ? 'var(--red)' : 'var(--green)'; } else { sr.textContent = '—'; sr.style.color = 'var(--text)'; }
    const n = new Date(), elapsed = (y === n.getFullYear() && m === n.getMonth()) ? n.getDate() : U.daysInMonth(y, m);
    $('an-avg-daily').textContent = tot.expense > 0 ? U.fmt(tot.expense / elapsed) : '—';
    const big = Math.max(0, ...list.filter(x => x.type === 'expense').map(x => x.amount)); $('an-biggest').textContent = big > 0 ? U.fmt(big) : '—';
    $('an-tx-count').textContent = list.length;
    const net = C.balances(txs, S.accts()).total, ne = $('an-net-worth'); ne.textContent = (net < 0 ? '−' : '') + U.fmt(net); ne.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
    $('an-all-count').textContent = txs.length;
    renderAlerts(y, m, txs, tot); renderForecast(y, m, txs, tot); renderBudgetCard(y, m, txs);
    renderDonut(list); renderBars(txs, y, m); renderLine(txs, y, m); renderNW(txs, y, m); renderHeat(list, y, m); renderWeekday(txs, y, m); renderCatBars(list); renderLabels(list);
  }
  UI.page('analytics', { show: renderAnalytics });

  /* =========================================================== BUDGET ALERTS */
  const FFBudget = {
    async notify(msg) {
      UI.toast(msg, '⚡', { ms: 4500 });
      if (!S.prefs().notif || !('Notification' in root) || Notification.permission !== 'granted') return;
      try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg && reg.showNotification) await reg.showNotification('FinFlow', { body: msg, icon: 'icon.png' }); else new Notification('FinFlow', { body: msg, icon: 'icon.png' });
      } catch (_) { }
    },
    /** call after a transaction is saved. Fires each threshold at most once per month, only for the current month. */
    check(tx) {
      if (!tx || tx.type !== 'expense') return;
      const ym = tx.date.slice(0, 7), n = new Date(); if (ym !== U.monthKey(n.getFullYear(), n.getMonth())) return;
      const total = S.budgetTotal(), per = S.catBudgets(), st = C.budgetStatus(S.txs(), +ym.slice(0, 4), +ym.slice(5) - 1, total, per);
      const p = S.prefs(); const sent = (p.budgetSent && p.budgetSent.ym === ym) ? p.budgetSent.k : []; const fire = [];
      const mark = (k, msg) => { if (!sent.includes(k)) { sent.push(k); fire.push(msg); } };
      if (total) { if (st.pct >= 100) mark('t100', t('bud_total100')); else if (st.pct >= 80) mark('t80', t('bud_total80', { p: st.pct })); }
      st.cats.filter(c => c.cat === tx.cat).forEach(c => { if (c.pct >= 100) mark('c:' + c.cat + ':100', t('bud_alert100', { c: I18N.catLabel(c.cat) })); else if (c.pct >= 80) mark('c:' + c.cat + ':80', t('bud_alert80', { c: I18N.catLabel(c.cat), p: c.pct })); });
      if (fire.length) { S.patchPrefs({ budgetSent: { ym, k: sent } }); FFBudget.notify(fire.join(' · ')); }
    }
  };
  root.FFBudget = FFBudget;

  /* =========================================================== CATEGORY BUDGETS PAGE */
  UI.page('budgets', { show() {
    const per = S.catBudgets();
    $('bud-list').innerHTML = S.cats('expense').map(c => `<div class="bud-row"><span class="e">${esc(c.emoji)}</span><span class="n">${esc(I18N.catLabel(c.name))}</span><input type="text" inputmode="decimal" data-cat="${esc(c.name)}" value="${per[c.name] > 0 ? per[c.name] : ''}" placeholder="0" aria-label="${esc(I18N.catLabel(c.name))}"/></div>`).join('');
    $('bud-list').querySelectorAll('input').forEach(UI.moneyInput);
  } });
  UI.act('saveCatBudgets', () => {
    const o = {}; $('bud-list').querySelectorAll('input').forEach(i => { const v = U.parseMoney(i.value); if (v > 0) o[i.getAttribute('data-cat')] = v; });
    S.setCatBudgets(o); UI.toast(t('bud_saved'), '✅'); UI.back();
  });

  /* =========================================================== REPORT */
  const R = { mode: 'month', y: UI.month.y, m: UI.month.m };
  function pctBar(p) { return `<div class="meter" style="height:5px;margin-top:4px"><div style="width:${Math.min(100, p)}%;background:var(--green)"></div></div>`; }
  function renderReport() {
    const txs = S.txs(); let list, title;
    if (R.mode === 'month') { list = C.monthTx(txs, R.y, R.m); title = I18N.monthLabelLong(R.y, R.m); }
    else { list = txs.filter(x => x.date.slice(0, 4) === String(R.y)); title = (I18N.getLang() === 'th' ? R.y + 543 : R.y) + ''; }
    document.title = 'FinFlow-' + (R.mode === 'month' ? U.monthKey(R.y, R.m) : R.y);
    $('report-sub').textContent = title; $('rep-m').classList.toggle('active', R.mode === 'month'); $('rep-y').classList.toggle('active', R.mode === 'year');
    const tot = C.totals(list), sr = tot.income > 0 ? Math.round((tot.income - tot.expense) / tot.income * 100) : null;
    const cats = C.catTotals(list, 'expense'), top = list.filter(x => x.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
    let html = `<div class="rep-card"><h3>${esc(t('r_summary'))} · ${esc(title)}</h3><div class="rep-sum">
      <div>${esc(t('income'))}<b style="color:var(--green)">${U.fmt(tot.income)}</b></div><div>${esc(t('expense'))}<b style="color:var(--red)">${U.fmt(tot.expense)}</b></div>
      <div>${esc(t('net'))}<b>${tot.net < 0 ? '−' : ''}${U.fmt(tot.net)}</b></div><div>${esc(t('savings_rate'))}<b>${sr === null ? '—' : sr + '%'}</b></div>
      <div>${esc(t('tx_count'))}<b>${list.length}</b></div><div>${esc(t('transfer'))}<b style="color:var(--blue)">${U.fmt(tot.transfer)}</b></div>${tot.refunds > 0 ? `<div style="grid-column:1/-1">${esc(t('rep_refunds'))}<b>${U.fmt(tot.refunds)}</b></div>` : ''}</div></div>`;
    if (R.mode === 'year') {
      html += `<div class="rep-card"><h3>${esc(t('r_by_month'))}</h3><table class="rep-table"><tr><th></th><th class="n">${esc(t('income'))}</th><th class="n">${esc(t('expense'))}</th><th class="n">${esc(t('net'))}</th></tr>`
        + Array.from({ length: 12 }, (_, mm) => { const x = C.totals(C.monthTx(list, R.y, mm)); return `<tr><td>${esc(t('months_short')[mm])}</td><td class="n">${U.fmt(x.income)}</td><td class="n">${U.fmt(x.expense)}</td><td class="n">${x.net < 0 ? '−' : ''}${U.fmt(x.net)}</td></tr>`; }).join('') + '</table></div>';
    }
    html += `<div class="rep-card"><h3>${esc(t('r_by_cat'))}</h3>${cats.length ? '<table class="rep-table"><tr><th></th><th class="n">฿</th><th class="n">' + esc(t('r_pct')) + '</th></tr>' + cats.map(c => `<tr><td>${esc(c.emoji || '')} ${esc(I18N.catLabel(c.cat))}${pctBar(c.total / (tot.gross || 1) * 100)}</td><td class="n">${U.fmt(c.total)}</td><td class="n">${Math.round(c.total / (tot.gross || 1) * 100)}%</td></tr>`).join('') + '</table>' : `<div class="muted" style="font-size:13px">${esc(t('no_data'))}</div>`}</div>`;
    if (top.length) html += `<div class="rep-card"><h3>${esc(t('r_top'))}</h3><table class="rep-table">${top.map(x => `<tr><td>${esc(x.name)}<div class="faint" style="font-size:11px">${esc(I18N.dateLabel(x.date))}</div></td><td class="n">${U.fmt(x.amount)}</td></tr>`).join('')}</table></div>`;
    html += `<div class="faint" style="font-size:11px;text-align:center;margin:8px 0 16px">FinFlow ${esc(root.FF_VERSION)} · ${esc(t('r_generated', { d: I18N.dateLabel(U.dateStr()) }))}</div>`;
    $('report-body').innerHTML = html;
  }
  UI.page('report', { show() { R.y = UI.month.y; R.m = UI.month.m; renderReport(); } });
  UI.act('repMode', mode => { R.mode = mode; renderReport(); });
  UI.act('repPrev', () => { if (R.mode === 'month') { R.m--; if (R.m < 0) { R.m = 11; R.y--; } } else R.y--; renderReport(); });
  UI.act('repNext', () => { if (R.mode === 'month') { R.m++; if (R.m > 11) { R.m = 0; R.y++; } } else R.y++; renderReport(); });
  UI.act('printReport', () => { renderReport(); setTimeout(() => root.print(), 100); });
  root.addEventListener('afterprint', () => { document.title = 'FinFlow'; });
})(window);

/* FinFlow — pure calculations over transaction lists (no DOM, no storage access) so they can be unit-tested in Node. */
(function (root) {
  'use strict';
  const U = root.U || require('./util.js');

  const inMonth = (t, y, m) => t.date.slice(0, 7) === U.monthKey(y, m);
  function monthTx(txs, y, m) { return txs.filter(t => inMonth(t, y, m)); }

  /* Income categories flagged "refund" (money friends pay you back) reduce spending instead of counting as income. */
  let refundCats = new Set();
  function setRefunds(names) { refundCats = new Set(names || []); }

  /** income / expense totals. Transfers between own accounts are NOT income or spending.
   *  `expense` is NET of refunds; `gross` is what was actually paid out. net = income - expense (unchanged by refunds). */
  function totals(list) {
    let inc = 0, exp = 0, tr = 0, ref = 0;
    for (const t of list) {
      const c = Math.round(t.amount * 100);
      if (t.type === 'income') { if (refundCats.has(t.cat)) ref += c; else inc += c; }
      else if (t.type === 'expense') exp += c; else tr += c;
    }
    return { income: inc / 100, expense: (exp - ref) / 100, gross: exp / 100, refunds: ref / 100, transfer: tr / 100, net: (inc + ref - exp) / 100, count: list.length };
  }

  /* ---------- analytics helpers ---------- */
  /** transactions of month (y,m) up to and including `day` */
  function monthUpTo(txs, y, m, day) { const k = U.monthKey(y, m); return txs.filter(t => t.date.slice(0, 7) === k && +t.date.slice(8, 10) <= day); }
  /** spending so far vs the same days of the previous month (fair comparison while a month is still running) */
  function comparePeriod(txs, y, m, today) {
    const [py, pm] = prevMonth(y, m), cur = U.monthKey(y, m) === today.slice(0, 7);
    const day = cur ? +today.slice(8, 10) : U.daysInMonth(y, m);
    const now = totals(monthUpTo(txs, y, m, day)).expense, prev = totals(monthUpTo(txs, py, pm, Math.min(day, U.daysInMonth(py, pm)))).expense;
    return { now, prev, day, partial: cur && day < U.daysInMonth(y, m), pct: prev > 0 ? Math.round((now - prev) / prev * 100) : null };
  }
  /** Amount from which a single expense counts as a "lump" (rent, a big bill, an iPhone): the top 5 % of the last 120 days, at least ฿500.
   *  Lumps are paid once, so they must not be multiplied by the days left in the month. */
  function lumpThreshold(txs, today) {
    const from = U.addDays(today, -120), a = txs.filter(t => t.type === 'expense' && t.date >= from).map(t => t.amount).sort((x, y) => x - y);
    return a.length < 20 ? Infinity : Math.max(500, a[Math.floor(a.length * 0.95)]);
  }
  /** month-end forecast = what is already spent + the everyday (non-lump) daily rate x the days left.
   *  The daily rate blends this month so far with the last 3 full months (weight 7 days), so day 3 of a month is not extrapolated wildly. */
  function projection(txs, y, m, today) {
    const dim = U.daysInMonth(y, m), cur = U.monthKey(y, m) === today.slice(0, 7), day = cur ? +today.slice(8, 10) : dim, th = lumpThreshold(txs, today);
    const list = monthTx(txs, y, m), spent = totals(list).expense;
    let lump = 0, regular = 0; for (const t of list) if (t.type === 'expense') { if (t.amount >= th) lump += Math.round(t.amount * 100); else regular += Math.round(t.amount * 100); }
    lump /= 100; regular /= 100;
    let hReg = 0, hDays = 0, yy = y, mm = m; for (let i = 0; i < 3; i++) { [yy, mm] = prevMonth(yy, mm); const hl = monthTx(txs, yy, mm); if (!hl.length) continue; hDays += U.daysInMonth(yy, mm); for (const t of hl) if (t.type === 'expense' && t.amount < th) hReg += t.amount; }
    const hist = hDays ? hReg / hDays : null, perDay = day > 0 ? (hist === null ? regular / day : (regular + hist * 7) / (day + 7)) : 0;
    return { spent, lump: U.round2(lump), perDay: U.round2(perDay), projected: cur ? U.round2(spent + perDay * (dim - day)) : spent, day, dim, running: cur && day < dim };
  }  const C_monthTx = (txs, y, m) => monthTx(txs, y, m);
  /** average spend per calendar day for each weekday (0=Sun) across the `months` months ending at (y,m) */
  function weekdayAvg(txs, y, m, months, today) {
    const sums = [0, 0, 0, 0, 0, 0, 0], days = [0, 0, 0, 0, 0, 0, 0];
    let sy = y, sm = m - (months - 1); while (sm < 0) { sm += 12; sy--; }
    for (let i = 0; i < months; i++) {
      const yy = sy + Math.floor((sm + i) / 12), mm = (sm + i) % 12, dim = U.daysInMonth(yy, mm);
      for (let d = 1; d <= dim; d++) { const ds = U.monthKey(yy, mm) + '-' + U.p2(d); if (ds > today) break; days[new Date(yy, mm, d).getDay()]++; }
      for (const t of monthTx(txs, yy, mm)) if (t.type === 'expense') sums[new Date(+t.date.slice(0, 4), +t.date.slice(5, 7) - 1, +t.date.slice(8, 10)).getDay()] += Math.round(t.amount * 100);
    }
    return sums.map((s, i) => days[i] ? U.round2(s / 100 / days[i]) : 0);
  }
  const labelOf = t => String(t.note || t.name || '').trim();
  const labelKey = s => s.toLowerCase().normalize('NFC').replace(/[็-๎\s]/g, '').replace(/[^a-z0-9ก-๛]/g, '');
  /** group expenses by what they were for (the note you typed, else the name) */
  function topLabels(list) {
    const g = {};
    for (const t of list) { if (t.type !== 'expense') continue; const lab = labelOf(t), k = labelKey(lab); if (!k) continue; const o = g[k] = g[k] || { key: k, n: 0, total: 0, texts: {} }; o.n++; o.total += Math.round(t.amount * 100); o.texts[lab] = (o.texts[lab] || 0) + 1; }
    return Object.values(g).map(o => ({ key: o.key, label: Object.entries(o.texts).sort((a, b) => b[1] - a[1])[0][0], n: o.n, total: o.total / 100 }));
  }
  /** shortcuts for the Add page: your most frequent recent expenses with their usual amount and category */
  function frequentRecent(txs, today, days, limit) {
    const from = U.addDays(today, -days), g = {};
    for (const t of txs) { if (t.type !== 'expense' || t.date < from) continue; const lab = (t.name || '').trim(), k = labelKey(lab); if (!k) continue; const o = g[k] = g[k] || { name: lab, n: 0, last: t, amounts: {} }; o.n++; if (t.date + (t.time || '') >= o.last.date + (o.last.time || '')) o.last = t; o.amounts[t.amount] = (o.amounts[t.amount] || 0) + 1; }
    return Object.values(g).filter(o => o.n >= 2).sort((a, b) => b.n - a.n).slice(0, limit || 6).map(o => ({ name: o.name, n: o.n, amount: +Object.entries(o.amounts).sort((a, b) => b[1] - a[1])[0][0], cat: o.last.cat, emoji: o.last.emoji, acct: o.last.acct }));
  }
  /** a sensible monthly budget: average net spend of the last 3 finished months, rounded up to 500 */
  function suggestBudget(txs, y, m) {
    const v = []; let yy = y, mm = m; for (let i = 0; i < 3; i++) { [yy, mm] = prevMonth(yy, mm); const e = totals(monthTx(txs, yy, mm)).expense; if (e > 0) v.push(e); }
    return v.length ? Math.ceil(v.reduce((a, b) => a + b, 0) / v.length / 500) * 500 : 0;
  }

  /** Balance per account. transfer: money leaves `acct` (default main) and lands in `toAcct` when that account is tracked. */
  function balances(txs, accts) {
    const ids = new Set(accts.map(a => a.id));
    const by = {}; accts.forEach(a => { by[a.id] = Math.round((a.opening || 0) * 100); });
    const own = id => (id && ids.has(id) ? id : 'main');
    for (const t of txs) {
      const c = Math.round(t.amount * 100);
      if (t.type === 'income') by[own(t.acct)] += c;
      else if (t.type === 'expense') by[own(t.acct)] -= c;
      else { by[own(t.acct)] -= c; if (t.toAcct && ids.has(t.toAcct)) by[t.toAcct] += c; }
    }
    let total = 0; const out = {};
    for (const k in by) { out[k] = by[k] / 100; total += by[k]; }
    return { byAcct: out, total: total / 100 };
  }

  /** Running balance at the END of the given month (for the net-worth trend). */
  function balanceAt(txs, accts, y, m) {
    const end = U.monthKey(y, m);
    return balances(txs.filter(t => t.date.slice(0, 7) <= end), accts).total;
  }

  function catTotals(list, type) {
    const o = {}, emoji = {};
    for (const t of list) if (t.type === type) { o[t.cat] = Math.round(((o[t.cat] || 0) + t.amount) * 100) / 100; emoji[t.cat] = t.emoji; }
    return Object.entries(o).map(([cat, total]) => ({ cat, total, emoji: emoji[cat] })).sort((a, b) => b.total - a.total);
  }
  function dayTotals(list, type) {
    const o = {};
    for (const t of list) if (t.type === type) { const d = +t.date.slice(8, 10); o[d] = Math.round(((o[d] || 0) + t.amount) * 100) / 100; }
    return o;
  }
  function prevMonth(y, m) { return m === 0 ? [y - 1, 11] : [y, m - 1]; }

  /* ---------- budgets ---------- */
  function budgetStatus(txs, y, m, total, perCat) {
    const list = monthTx(txs, y, m), spent = totals(list).expense;
    const byCat = catTotals(list, 'expense');
    const cats = Object.entries(perCat || {}).filter(([, v]) => +v > 0).map(([cat, limit]) => {
      const used = (byCat.find(c => c.cat === cat) || { total: 0 }).total;
      return { cat, limit: +limit, used, pct: Math.round(used / limit * 100), over: used > limit };
    }).sort((a, b) => b.pct - a.pct);
    return { spent, total: total || 0, pct: total ? Math.round(spent / total * 100) : 0, over: total ? spent > total : false, cats };
  }

  /* ---------- duplicates ---------- */
  /** Returns the existing transaction that `t` duplicates, or null. Same slip reference = certain; same amount+date+time = probable. */
  function findDuplicate(txs, t) {
    if (t.slipRef) { const d = txs.find(x => x.slipRef && x.slipRef === t.slipRef); if (d) return { tx: d, certain: true }; }
    if (t.time) {
      const d = txs.find(x => x.id !== t.id && x.amount === t.amount && x.date === t.date && x.time === t.time && x.type === t.type);
      if (d) return { tx: d, certain: false };
    }
    return null;
  }

  /* ---------- recurring ---------- */
  /** Generate every missing occurrence from rule.start up to `today` (inclusive). Never regenerates a month already recorded in `done`,
   *  even if the user deleted that transaction afterwards. Returns {txs, done}. */
  function dueRecurring(rules, done, today, mkId) {
    const out = [], nd = JSON.parse(JSON.stringify(done || {}));
    const [ty, tm] = [+today.slice(0, 4), +today.slice(5, 7) - 1];
    for (const r of rules) {
      const key = String(r.id); nd[key] = nd[key] || [];
      let y = +(r.start || today).slice(0, 4), m = +(r.start || today).slice(5, 7) - 1;
      let guard = 0;
      while ((y < ty || (y === ty && m <= tm)) && guard++ < 600) {
        const ym = U.monthKey(y, m);
        const day = Math.min(Math.max(1, r.day), U.daysInMonth(y, m));
        const date = ym + '-' + U.p2(day);
        if (!nd[key].includes(ym) && date <= today) {
          out.push({ id: mkId(), type: r.type, amount: r.amount, name: r.name, cat: r.cat, emoji: r.emoji, note: r.note || null, date, time: null, recurringId: r.id, acct: r.acct });
          nd[key].push(ym);
        }
        m++; if (m > 11) { m = 0; y++; }
      }
    }
    return { txs: out, done: nd };
  }

  /* ---------- search / filter ---------- */
  function filterTx(list, f) {
    const q = (f.q || '').toLowerCase().trim();
    return list.filter(t => {
      if (f.type && f.type !== 'all' && t.type !== f.type) return false;
      if (f.date && t.date !== f.date) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.min > 0 && t.amount < f.min) return false;
      if (f.max > 0 && t.amount > f.max) return false;
      if (f.cat && t.cat !== f.cat) return false;
      if (f.acct && (t.acct || 'main') !== f.acct && t.toAcct !== f.acct) return false;
      if (q && !((t.name || '') + ' ' + (t.cat || '') + ' ' + (t.note || '') + ' ' + (t.payee || '')).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  const sortTx = list => list.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : ((b.time || '') < (a.time || '') ? -1 : (b.time || '') > (a.time || '') ? 1 : b.id - a.id)));

  const C = { setRefunds, monthUpTo, comparePeriod, projection, weekdayAvg, topLabels, labelKey, frequentRecent, suggestBudget, monthTx, totals, balances, balanceAt, catTotals, dayTotals, prevMonth, budgetStatus, findDuplicate, dueRecurring, filterTx, sortTx };
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  root.C = C;
})(typeof window !== 'undefined' ? window : globalThis);

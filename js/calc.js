/* FinFlow — pure calculations over transaction lists (no DOM, no storage access) so they can be unit-tested in Node. */
(function (root) {
  'use strict';
  const U = root.U || require('./util.js');

  const inMonth = (t, y, m) => t.date.slice(0, 7) === U.monthKey(y, m);
  function monthTx(txs, y, m) { return txs.filter(t => inMonth(t, y, m)); }

  /** income / expense totals. Transfers between own accounts are NOT income or spending. */
  function totals(list) {
    let inc = 0, exp = 0, tr = 0;
    for (const t of list) {
      const c = Math.round(t.amount * 100);
      if (t.type === 'income') inc += c; else if (t.type === 'expense') exp += c; else tr += c;
    }
    return { income: inc / 100, expense: exp / 100, transfer: tr / 100, net: (inc - exp) / 100, count: list.length };
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
      if (f.acct && (t.acct || 'main') !== f.acct && t.toAcct !== f.acct) return false;
      if (q && !((t.name || '') + ' ' + (t.cat || '') + ' ' + (t.note || '') + ' ' + (t.payee || '')).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  const sortTx = list => list.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : ((b.time || '') < (a.time || '') ? -1 : (b.time || '') > (a.time || '') ? 1 : b.id - a.id)));

  const C = { monthTx, totals, balances, balanceAt, catTotals, dayTotals, prevMonth, budgetStatus, findDuplicate, dueRecurring, filterTx, sortTx };
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  root.C = C;
})(typeof window !== 'undefined' ? window : globalThis);

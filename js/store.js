/* FinFlow — data layer. Everything lives in localStorage (same keys as v3.x so existing data keeps working),
   plus IndexedDB for slip thumbnails and safety snapshots. All reads are defensive: a corrupted value never crashes the app. */
(function (root) {
  'use strict';
  const U = root.U;

  const K = {
    tx: 'ff_tx', exp: 'ff_exp_cats', inc: 'ff_inc_cats', budget: 'ff_budget', goals: 'ff_goals',
    rec: 'ff_recurring', recDone: 'ff_rec_done', accts: 'ff_accts', catBud: 'ff_cat_budgets',
    learn: 'ff_learn', prefs: 'ff_prefs', lang: 'ff_lang', theme: 'ff_theme', schema: 'ff_schema',
    pin: 'ff_pin', pinHash: 'ff_pin_h', pinSalt: 'ff_pin_s', pinOn: 'ff_pin_enabled', pinFail: 'ff_pin_fail'
  };
  const SCHEMA = 3;

  const DEFAULT_EXP = [
    { emoji: '🍜', name: 'Food' }, { emoji: '🚗', name: 'Transport' }, { emoji: '💊', name: 'Health' },
    { emoji: '🛒', name: 'Shopping' }, { emoji: '🏠', name: 'Rent' }, { emoji: '🎬', name: 'Entertainment' },
    { emoji: '🧾', name: 'Bills' }, { emoji: '✈️', name: 'Travel' }, { emoji: '📦', name: 'Other' }
  ];
  const DEFAULT_INC = [
    { emoji: '💼', name: 'Salary' }, { emoji: '💻', name: 'Freelance' }, { emoji: '📈', name: 'Investment' },
    { emoji: '🎁', name: 'Bonus' }, { emoji: '💰', name: 'Other income' }
  ];
  const MAIN_ACCT = { id: 'main', name: '', emoji: '🏦', opening: 0 };   // name '' => localized "Main account"

  const listeners = { error: [], change: [] };
  function emit(k, a) { listeners[k].forEach(f => { try { f(a); } catch (_) { } }); }

  /* ---------- raw access ---------- */
  const memo = {};                       // key -> {raw, val}
  function rawGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function get(k, fallback) {
    const raw = rawGet(k);
    if (raw === null || raw === undefined) return fallback;
    const m = memo[k];
    if (m && m.raw === raw) return m.val;
    try { const val = JSON.parse(raw); memo[k] = { raw, val }; return val; }
    catch (_) { return fallback; }
  }
  function set(k, val) {
    const raw = JSON.stringify(val);
    try { localStorage.setItem(k, raw); memo[k] = { raw, val }; emit('change', k); return true; }
    catch (e) { emit('error', { key: k, error: e }); return false; }
  }
  function remove(k) { try { localStorage.removeItem(k); } catch (_) { } delete memo[k]; }
  function str(v, max) { return v === null || v === undefined ? '' : String(v).slice(0, max || 200); }

  /* ---------- transactions ---------- */
  const TYPES = ['income', 'expense', 'transfer'];
  function normTx(r) {
    if (!r || typeof r !== 'object') return null;
    if (!TYPES.includes(r.type)) return null;
    const amount = U.parseMoney(r.amount);
    if (!(amount > 0) || amount > 1e9) return null;
    if (!U.isDateStr(r.date) || isNaN(U.parseDate(r.date))) return null;
    const t = {
      id: Number.isFinite(+r.id) && +r.id > 0 ? +r.id : U.uid(),
      type: r.type, amount,
      name: str(r.name, 120), cat: str(r.cat, 60), emoji: str(r.emoji, 8) || (r.type === 'transfer' ? '🔁' : '💳'),
      date: r.date, time: U.validTime(r.time) ? r.time : null,
      note: r.note ? str(r.note, 200) : null
    };
    if (r.payee) t.payee = str(r.payee, 120);
    if (r.acct) t.acct = str(r.acct, 40);
    if (r.toAcct) t.toAcct = str(r.toAcct, 40);
    if (r.recurringId) t.recurringId = +r.recurringId || null;
    if (r.slipRef) t.slipRef = str(r.slipRef, 60);
    if (r.hasImg) t.hasImg = true;
    return t;
  }
  function txs() { const a = get(K.tx, []); return Array.isArray(a) ? a : []; }
  function setTxs(arr) { return set(K.tx, arr); }
  function addTx(t) { const a = txs().slice(); a.push(t); return setTxs(a); }
  function addTxs(list) { const a = txs().concat(list); return setTxs(a); }
  function putTx(t) {
    const a = txs().slice(), i = a.findIndex(x => x.id === t.id);
    if (i < 0) return false;
    a[i] = t; return setTxs(a);
  }
  function delTx(id) {
    const a = txs(), t = a.find(x => x.id === id);
    if (!t) return null;
    setTxs(a.filter(x => x.id !== id));
    return t;
  }
  function getTx(id) { return txs().find(x => x.id === id) || null; }

  /* ---------- categories ---------- */
  function cats(type) {
    const k = type === 'income' ? K.inc : K.exp;
    const a = get(k, null);
    if (Array.isArray(a) && a.length) return a.filter(c => c && typeof c.name === 'string');
    const d = (type === 'income' ? DEFAULT_INC : DEFAULT_EXP).map(c => ({ ...c }));
    set(k, d); return d;
  }
  function setCats(type, arr) { return set(type === 'income' ? K.inc : K.exp, arr); }
  /** income categories that are paybacks (friends returning money): they reduce spending instead of counting as income */
  const refundNames = () => cats('income').filter(c => c.refund).map(c => c.name);
  function catEmoji(type, name) { const c = cats(type).find(x => x.name === name); return c ? c.emoji : null; }

  /* ---------- accounts ---------- */
  function accts() {
    let a = get(K.accts, null);
    if (!Array.isArray(a) || !a.length) a = [{ ...MAIN_ACCT }];
    if (!a.some(x => x.id === 'main')) a.unshift({ ...MAIN_ACCT });
    return a;
  }
  function setAccts(a) { return set(K.accts, a); }

  /* ---------- small keyed stores ---------- */
  const budgetTotal = () => { const v = parseFloat(rawGet(K.budget) || '0'); return v > 0 ? v : 0; };
  const setBudgetTotal = v => { try { localStorage.setItem(K.budget, String(v > 0 ? U.round2(v) : 0)); } catch (_) { } emit('change', K.budget); };
  const catBudgets = () => { const o = get(K.catBud, {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; };
  const setCatBudgets = o => set(K.catBud, o);
  const goals = () => { const a = get(K.goals, []); return Array.isArray(a) ? a : []; };
  const setGoals = a => set(K.goals, a);
  const recurring = () => { const a = get(K.rec, []); return Array.isArray(a) ? a : []; };
  const setRecurring = a => set(K.rec, a);
  const recDone = () => { const o = get(K.recDone, {}); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; };
  const setRecDone = o => set(K.recDone, o);
  const learn = () => { const o = get(K.learn, null); return o && typeof o === 'object' ? o : { byAcct: {}, byName: {}, mine: [], notes: {} }; };
  const setLearn = o => set(K.learn, o);
  const prefs = () => ({ notif: false, saveImg: true, lastBackup: null, txSinceBackup: 0, dupWarn: true, ...(get(K.prefs, {}) || {}) });
  const setPrefs = p => set(K.prefs, p);
  function patchPrefs(patch) { const p = { ...prefs(), ...patch }; setPrefs(p); return p; }

  /* ---------- IndexedDB (images + snapshots) ---------- */
  let _db = null;
  function openDB() {
    if (_db) return _db;
    _db = new Promise((res, rej) => {
      if (!root.indexedDB) return rej(new Error('no idb'));
      const rq = indexedDB.open('finflow', 1);
      rq.onupgradeneeded = () => { const d = rq.result; if (!d.objectStoreNames.contains('img')) d.createObjectStore('img'); if (!d.objectStoreNames.contains('snap')) d.createObjectStore('snap'); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    _db.catch(() => { _db = null; });
    return _db;
  }
  async function idb(store, mode, fn) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(store, mode), st = tx.objectStore(store);
      const r = fn(st);
      tx.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
      tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
  }
  const putImg = (id, blob) => idb('img', 'readwrite', s => s.put(blob, id)).then(() => true).catch(() => false);
  const getImg = id => idb('img', 'readonly', s => s.get(id)).catch(() => undefined);
  const delImg = id => idb('img', 'readwrite', s => s.delete(id)).catch(() => { });
  const clearImgs = () => idb('img', 'readwrite', s => s.clear()).catch(() => { });

  /* ---------- backup / restore ---------- */
  function exportAll() {
    return {
      app: 'FinFlow', version: 2, appVersion: root.FF_VERSION, exported: new Date().toISOString(),
      transactions: txs(), expense_cats: cats('expense'), income_cats: cats('income'),
      budget: String(budgetTotal()), goals: goals(), recurring: recurring(), rec_done: recDone(),
      accounts: accts(), cat_budgets: catBudgets(), learn: learn(),
      settings: { lang: rawGet(K.lang) || 'th', theme: rawGet(K.theme) || 'dark', saveImg: prefs().saveImg }
    };
  }
  /** Validate + sanitise a parsed backup (v1 or v2). Does NOT write. Returns {data, dropped}. */
  function parseBackup(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.transactions)) throw new Error('invalid');
    const seen = new Set(); let dropped = 0; const out = [];
    for (const r of o.transactions) {
      const t = normTx(r);
      if (!t) { dropped++; continue; }
      while (seen.has(t.id)) t.id++;
      seen.add(t.id); out.push(t);
    }
    const okCats = a => Array.isArray(a) ? a.filter(c => c && typeof c.name === 'string' && c.name.trim()).map(c => (c.refund ? { emoji: str(c.emoji, 8) || '📦', name: str(c.name, 60), refund: true } : { emoji: str(c.emoji, 8) || '📦', name: str(c.name, 60) })) : null;
    const data = {
      tx: out,
      exp: okCats(o.expense_cats), inc: okCats(o.income_cats),
      budget: parseFloat(o.budget) > 0 ? parseFloat(o.budget) : 0,
      goals: Array.isArray(o.goals) ? o.goals.filter(g => g && typeof g.name === 'string' && +g.target > 0).map(g => ({ id: +g.id || U.uid(), emoji: str(g.emoji, 8) || '🎯', name: str(g.name, 80), target: U.round2(+g.target), saved: U.clamp(U.round2(+g.saved || 0), 0, U.round2(+g.target)) })) : null,
      recurring: Array.isArray(o.recurring) ? o.recurring.filter(r => r && +r.amount > 0 && ['income', 'expense'].includes(r.type)).map(r => ({ id: +r.id || U.uid(), type: r.type, amount: U.round2(+r.amount), name: str(r.name, 120), cat: str(r.cat, 60), emoji: str(r.emoji, 8) || '🔄', note: str(r.note, 200), day: U.clamp(parseInt(r.day) || 1, 1, 31), start: U.isDateStr(r.start) ? r.start : null, acct: r.acct ? str(r.acct, 40) : undefined })) : null,
      recDone: o.rec_done && typeof o.rec_done === 'object' && !Array.isArray(o.rec_done) ? o.rec_done : null,
      accounts: Array.isArray(o.accounts) ? o.accounts.filter(a => a && typeof a.id === 'string').map(a => ({ id: str(a.id, 40), name: str(a.name, 60), emoji: str(a.emoji, 8) || '🏦', opening: U.round2(+a.opening || 0) })) : null,
      catBudgets: o.cat_budgets && typeof o.cat_budgets === 'object' && !Array.isArray(o.cat_budgets) ? o.cat_budgets : null,
      learn: o.learn && typeof o.learn === 'object' ? o.learn : null,
      settings: o.settings && typeof o.settings === 'object' ? o.settings : null
    };
    return { data, dropped };
  }
  function applyBackup(data) {
    set(K.tx, data.tx);
    if (data.exp && data.exp.length) setCats('expense', data.exp);
    if (data.inc && data.inc.length) setCats('income', data.inc);
    setBudgetTotal(data.budget || 0);
    if (data.goals) setGoals(data.goals);
    if (data.recurring) setRecurring(data.recurring);
    if (data.recDone) setRecDone(data.recDone);
    if (data.accounts && data.accounts.length) setAccts(data.accounts);
    if (data.catBudgets) setCatBudgets(data.catBudgets);
    if (data.learn) setLearn(data.learn);
    if (data.settings) {
      if (['th', 'en'].includes(data.settings.lang)) try { localStorage.setItem(K.lang, data.settings.lang); } catch (_) { }
      if (['dark', 'light'].includes(data.settings.theme)) try { localStorage.setItem(K.theme, data.settings.theme); } catch (_) { }
    }
  }

  /* Snapshots protect against "clear all" / bad restore. Kept in IndexedDB (last 3). */
  async function snapshot(label) {
    try {
      const snap = { at: Date.now(), label: label || '', data: exportAll() };
      const cur = (await idb('snap', 'readonly', s => s.get('list'))) || [];
      cur.unshift(snap);
      await idb('snap', 'readwrite', s => s.put(cur.slice(0, 3), 'list'));
      return true;
    } catch (_) { return false; }
  }
  async function snapshots() { try { return (await idb('snap', 'readonly', s => s.get('list'))) || []; } catch (_) { return []; } }

  /* ---------- migration ---------- */
  function migrate() {
    const cur = parseInt(rawGet(K.schema) || '0');
    // always sanitise stored transactions (old versions wrote note:null, string amounts, etc.)
    const raw = get(K.tx, []);
    if (Array.isArray(raw)) {
      let changed = !Array.isArray(get(K.tx, null)) ? false : false;
      const seen = new Set(), out = [];
      for (const r of raw) {
        const t = normTx(r);
        if (!t) { changed = true; continue; }
        while (seen.has(t.id)) { t.id++; changed = true; }
        seen.add(t.id);
        if (JSON.stringify(t) !== JSON.stringify(r)) changed = true;
        out.push(t);
      }
      if (changed) set(K.tx, out);
    }
    // recurring rules created before v4: do not back-fill history, start from the current month
    if (cur < 2) {
      const rec = recurring(), now = U.dateStr();
      let ch = false;
      rec.forEach(r => { if (!r.start) { r.start = now.slice(0, 7) + '-01'; ch = true; } });
      if (ch) setRecurring(rec);
      // mark this month's already generated items as done so they are never generated twice
      const done = recDone(), all = txs();
      all.forEach(t => { if (t.recurringId) { const k = String(t.recurringId); (done[k] = done[k] || []); const ym = U.ymOf(t.date); if (!done[k].includes(ym)) done[k].push(ym); } });
      setRecDone(done);
    }
    if (cur < 3) {      // v4.1: auto-flag the usual payback categories once (user can change it in Categories)
      const inc = cats('income'); let ch = false;
      inc.forEach(c => { if (/เงินคืน|คืนเงิน|โอนคืน|refund|reimburs|pay ?back/i.test(c.name) && c.refund === undefined) { c.refund = true; ch = true; } });
      if (ch) setCats('income', inc);
    }
    try { localStorage.setItem(K.schema, String(SCHEMA)); } catch (_) { }
  }

  /* ---------- reset ---------- */
  function wipeAll(keepSettings) {
    Object.values(K).forEach(k => {
      if (keepSettings && [K.lang, K.theme, K.pin, K.pinHash, K.pinSalt, K.pinOn, K.schema].includes(k)) return;
      remove(k);
    });
    clearImgs();
  }

  async function requestPersist() {
    try { if (navigator.storage && navigator.storage.persist) { if (await navigator.storage.persisted()) return true; return await navigator.storage.persist(); } } catch (_) { }
    return false;
  }
  async function usage() { try { const e = await navigator.storage.estimate(); return { used: e.usage || 0, quota: e.quota || 0 }; } catch (_) { return null; } }

  const S = {
    K, DEFAULT_EXP, DEFAULT_INC, get, set, remove, rawGet, normTx,
    txs, setTxs, addTx, addTxs, putTx, delTx, getTx,
    cats, setCats, catEmoji, refundNames, accts, setAccts,
    budgetTotal, setBudgetTotal, catBudgets, setCatBudgets, goals, setGoals, recurring, setRecurring, recDone, setRecDone,
    learn, setLearn, prefs, setPrefs, patchPrefs,
    putImg, getImg, delImg, clearImgs, exportAll, parseBackup, applyBackup, snapshot, snapshots, migrate, wipeAll,
    requestPersist, usage,
    on: (k, f) => listeners[k].push(f)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  root.S = S;
})(typeof window !== 'undefined' ? window : globalThis);

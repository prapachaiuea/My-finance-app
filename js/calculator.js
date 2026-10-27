/* FinFlow — calculator: a keypad sheet attached to every amount field.
   Part 1 is pure (expression rules + evaluator, unit-tested); part 2 is the sheet and the buttons inside the fields. */
(function (root) {
  'use strict';
  const OPS = '+−×÷', MAXLEN = 12;
  const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

  /* ---------- evaluator (no eval) ----------
     null = nothing to show yet, NaN = cannot be calculated (divide by 0, broken formula).
     Percent works like a phone calculator:  100 + 10% = 110,  100 − 10% = 90,  100 × 10% = 10,  50% = 0.5 */
  function tokenize(s) {
    const out = []; let i = 0;
    while (i < s.length) {
      if (/[\d.]/.test(s[i])) { let j = i; while (j < s.length && /[\d.]/.test(s[j])) j++; out.push({ n: parseFloat(s.slice(i, j)) }); i = j; }
      else out.push({ o: s[i++] });
    }
    return out;
  }
  function evaluate(src) {
    let s = String(src || '').trim();
    while (s && OPS.includes(s[s.length - 1])) s = s.slice(0, -1).trim();          // dangling operator: ignore it
    if (!s) return null;
    const tk = tokenize(s); let i = 0;
    const peek = () => tk[i];
    function factor() {
      let neg = false; if (peek() && peek().o === '−') { neg = true; i++; }
      const t = tk[i++]; if (!t || t.n === undefined || isNaN(t.n)) throw 0;
      let v = neg ? -t.n : t.n, pct = false;
      if (peek() && peek().o === '%') { i++; v /= 100; pct = true; }
      return { v, pct };
    }
    function term() {
      let a = factor();
      while (peek() && (peek().o === '×' || peek().o === '÷')) {
        const o = tk[i++].o, b = factor();
        if (o === '÷' && b.v === 0) throw 0;
        a = { v: o === '×' ? a.v * b.v : a.v / b.v, pct: false };
      }
      return a;
    }
    try {
      let acc = term().v;
      while (peek() && (peek().o === '+' || peek().o === '−')) {
        const o = tk[i++].o, b = term(), add = b.pct ? acc * b.v : b.v;               // "a + b%" means b% of a
        acc = o === '+' ? acc + add : acc - add;
      }
      if (i < tk.length || !isFinite(acc)) return NaN;
      return r2(acc) + 0;                                                              // + 0 turns -0 into 0
    } catch (_) { return NaN; }
  }
  const usable = r => typeof r === 'number' && !isNaN(r) && r > 0 && r < 1e9;         // fits an amount field

  /* ---------- key rules: state {expr, fresh}; fresh = expr is a finished result (next digit starts over) ---------- */
  const lastNum = e => /[\d.]*$/.exec(e)[0];
  function press(st, k) {
    const e = st.expr, fresh = st.fresh;
    if (/^\d$/.test(k)) {
      if (fresh) return { expr: k, fresh: false };
      if (e.endsWith('%')) return st;
      const n = lastNum(e); if (n.replace('.', '').length >= MAXLEN) return st;
      return { expr: n === '0' ? e.slice(0, -1) + k : e + k, fresh: false };
    }
    if (k === '.') {
      if (fresh) return { expr: '0.', fresh: false };
      if (e.endsWith('%')) return st;
      const n = lastNum(e); if (n.includes('.')) return st;
      return { expr: e + (n ? '.' : '0.'), fresh: false };
    }
    if (OPS.includes(k)) {
      if (!e) return k === '−' ? { expr: '−', fresh: false } : st;
      if (e === '−') return st;
      return { expr: OPS.includes(e[e.length - 1]) ? e.slice(0, -1) + k : e + k, fresh: false };    // a second operator replaces the first
    }
    if (k === '%') return /\d$/.test(e) ? { expr: e + '%', fresh: false } : st;
    if (k === 'back') return { expr: fresh ? '' : e.slice(0, -1), fresh: false };
    if (k === 'clear') return { expr: '', fresh: false };
    if (k === '=') {
      const r = evaluate(e);
      return typeof r === 'number' && !isNaN(r) && Math.abs(r) < 1e12 ? { expr: String(r).replace('-', '−'), fresh: true } : st;
    }
    return st;
  }
  const hasOp = e => /[+−×÷%]/.test(e.slice(1));

  /* thousands separators and spaces around operators, for display only */
  function show(e) {
    return e.replace(/\d+(\.\d*)?/g, m => { const [a, b] = m.split('.'); return a.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (b !== undefined ? '.' + b : ''); })
      .replace(/[+−×÷]/g, (m, o) => o === 0 ? m : ' ' + m + ' ');
  }

  const API = { evaluate, press, usable, hasOp, show };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.FFCalc = API;
  if (typeof document === 'undefined') return;

  /* ====================================================== sheet + buttons */
  const { U, t, UI } = root, $ = UI.$, esc = U.esc;
  let st = { expr: '', fresh: false }, target = null;

  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="2.5" width="14" height="19" rx="3"/><line x1="8.5" y1="7.5" x2="15.5" y2="7.5"/><line x1="8.5" y1="12" x2="8.6" y2="12"/><line x1="12" y1="12" x2="12.1" y2="12"/><line x1="15.4" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="16.5" x2="8.6" y2="16.5"/><line x1="12" y1="16.5" x2="12.1" y2="16.5"/><line x1="15.4" y1="16.5" x2="15.5" y2="16.5"/></svg>';
  UI.calcButton = () => `<button type="button" class="calc-btn" data-act="calcOpen" data-i18n-title="calc_open" title="${esc(t('calc_open'))}" aria-label="${esc(t('calc_open'))}">${ICON}</button>`;

  const key = (k, label, cls, aria) => `<button type="button" class="ck${cls ? ' ' + cls : ''}" data-act="calcKey" data-arg="${k}"${aria ? ` data-i18n-title="${aria}" aria-label="${esc(t(aria))}"` : ''}>${label}</button>`;
  const sheet = document.createElement('div');
  sheet.className = 'modal-overlay calc-overlay'; sheet.id = 'sheet-calc'; sheet.setAttribute('data-overlay', '');
  sheet.innerHTML = `<div class="modal calc-sheet" role="dialog" aria-modal="true"><div class="modal-handle"></div>
    <div class="calc-screen"><div class="calc-expr" id="calc-expr"></div><div class="calc-preview" id="calc-preview" aria-live="polite"></div></div>
    <div class="calc-pad">
      ${key('clear', 'C', 'fn', 'calc_clear')}${key('back', '⌫', 'fn', 'calc_back')}${key('%', '%', 'fn')}${key('÷', '÷', 'op')}
      ${key('7', '7')}${key('8', '8')}${key('9', '9')}${key('×', '×', 'op')}
      ${key('4', '4')}${key('5', '5')}${key('6', '6')}${key('−', '−', 'op')}
      ${key('1', '1')}${key('2', '2')}${key('3', '3')}${key('+', '+', 'op')}
      ${key('0', '0', 'wide')}${key('.', '.')}${key('=', '=', 'eq')}
    </div>
    <button type="button" class="submit-btn" id="calc-use" data-act="calcUse" data-i18n="calc_use"></button></div>`;
  document.body.appendChild(sheet);

  function render() {
    const txt = show(st.expr), ex = $('calc-expr');
    ex.textContent = txt || '0'; ex.classList.toggle('empty', !txt);
    ex.setAttribute('data-size', txt.length > 22 ? 'xl' : txt.length > 13 ? 'l' : '');
    const r = evaluate(st.expr), pv = $('calc-preview');
    if (!st.fresh && hasOp(st.expr) && typeof r === 'number' && !isNaN(r)) { pv.textContent = '= ' + (r < 0 ? '−' : '') + U.fmt(r); pv.className = 'calc-preview'; }
    else if (!st.fresh && hasOp(st.expr) && typeof r === 'number') { pv.textContent = t('calc_invalid'); pv.className = 'calc-preview bad'; }
    else { pv.textContent = ''; pv.className = 'calc-preview'; }
    $('calc-use').disabled = !usable(r);
  }
  const send = k => { st = press(st, k); render(); };

  UI.act('calcOpen', (a, el) => {
    const inp = el.closest('.amount-prefix') && el.closest('.amount-prefix').querySelector('input'); if (!inp) return;
    target = inp; try { inp.blur(); } catch (_) { }                                 // keep the phone keyboard closed
    const v = U.parseMoney(inp.value);
    st = v > 0 ? { expr: String(v), fresh: true } : { expr: '', fresh: false };    // start from what is already in the field
    sheet.firstElementChild.setAttribute('aria-label', t('calc_title'));
    render(); UI.openSheet('sheet-calc');
  });
  UI.act('calcKey', k => send(k));
  UI.act('calcUse', () => {
    const r = evaluate(st.expr); if (!usable(r)) return;
    const inp = target; UI.closeSheet('sheet-calc');
    if (inp) { inp.value = Number.isInteger(r) ? String(r) : r.toFixed(2); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  /* hardware keyboard while the sheet is open */
  document.addEventListener('keydown', e => {
    if (!sheet.classList.contains('open') || e.ctrlKey || e.metaKey || e.altKey) return;
    const m = { '*': '×', x: '×', X: '×', '/': '÷', '-': '−', ',': '.', Backspace: 'back', Delete: 'clear', c: 'clear', C: 'clear', '=': '=' }, k = m[e.key] || e.key;
    if (e.key === 'Enter') { e.preventDefault(); if (hasOp(st.expr) && !st.fresh) send('='); else UI.ACT.calcUse(); return; }
    if (/^[\d.+−×÷%]$|^(back|clear|=)$/.test(k)) { e.preventDefault(); send(k); }
  });

  /* put a calculator button inside every amount field that is already on the page */
  document.querySelectorAll('.amount-prefix').forEach(p => {
    const inp = p.querySelector('input'); if (!inp || inp.hasAttribute('data-nocalc') || p.classList.contains('has-calc')) return;
    p.classList.add('has-calc'); p.insertAdjacentHTML('beforeend', UI.calcButton());
  });
})(typeof window !== 'undefined' ? window : globalThis);

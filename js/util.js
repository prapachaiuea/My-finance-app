/* FinFlow — small shared helpers (no DOM state). Loaded first. */
(function (root) {
  'use strict';

  /* ---------- HTML safety ---------- */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ESC[c]);
  }

  /* ---------- ids ---------- */
  let _lastId = 0;
  function uid() {
    let n = Date.now();
    if (n <= _lastId) n = _lastId + 1;
    _lastId = n;
    return n;
  }

  /* ---------- money ---------- */
  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
  function sum(arr, f) {
    let c = 0;
    for (const x of arr) c += Math.round((f ? f(x) : x) * 100);
    return c / 100;
  }
  function parseMoney(v) {
    if (typeof v === 'number') return isFinite(v) ? round2(v) : NaN;
    const s = String(v === null || v === undefined ? '' : v).replace(/[,\s฿]/g, '');
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    return round2(parseFloat(s));
  }
  function fmt(n) {
    const v = Math.abs(Number(n) || 0);
    return '฿' + v.toLocaleString('en-US', { minimumFractionDigits: Math.round(v * 100) % 100 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function fmtSigned(n) { return (n < 0 ? '−' : '') + fmt(n); }
  function fmtShort(n) {
    const v = Math.abs(n), s = n < 0 ? '−' : '';
    if (v >= 1e6) return s + '฿' + (Math.round(v / 1e5) / 10) + 'M';
    if (v >= 1e3) return s + '฿' + (Math.round(v / 100) / 10) + 'k';
    return s + '฿' + Math.round(v);
  }

  /* ---------- LOCAL dates (never use toISOString for a "today" string: it is UTC) ---------- */
  const p2 = n => String(n).padStart(2, '0');
  function dateStr(d) { d = d || new Date(); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function timeStr(d) { d = d || new Date(); return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
  function isDateStr(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  /** "YYYY-MM-DD" -> local Date at 00:00 (new Date(str) would be UTC and shift the day in some zones) */
  function parseDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    if (!m) return new Date(NaN);
    const y = +m[1], mo = +m[2], d = +m[3], x = new Date(y, mo - 1, d);
    return (x.getFullYear() === y && x.getMonth() === mo - 1 && x.getDate() === d) ? x : new Date(NaN);   // reject 2026-13-45 instead of rolling over
  }
  function ymOf(s) { return (s || '').slice(0, 7); }               // "2026-09"
  function monthKey(y, m) { return y + '-' + p2(m + 1); }           // m is 0-based
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); }
  function validDate(y, m, d) {                                     // m 1-based
    const x = new Date(y, m - 1, d);
    return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d;
  }
  function dateFromDOY(y, doy) {
    if (!(doy >= 1 && doy <= 366)) return null;
    const d = new Date(y, 0, doy);
    return d.getFullYear() === y ? dateStr(d) : null;
  }
  function validTime(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s || ''); }

  /* ---------- misc ---------- */
  function debounce(fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(() => fn.apply(c, a), ms); }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /** Levenshtein distance, early-exit above `max` (returns max+1). */
  function lev(a, b, max) {
    if (a === b) return 0;
    if (!a.length) return b.length; if (!b.length) return a.length;
    if (Math.abs(a.length - b.length) > (max === undefined ? 1e9 : max)) return (max || 0) + 1;
    let prev = new Array(b.length + 1), cur = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i; let rowMin = cur[0];
      for (let j = 1; j <= b.length; j++) {
        const c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (max !== undefined && rowMin > max) return max + 1;
      const t = prev; prev = cur; cur = t;
    }
    return prev[b.length];
  }
  function similarity(a, b) {
    if (!a || !b) return 0;
    const L = Math.max(a.length, b.length);
    return 1 - lev(a, b) / L;
  }

  const U = { esc, uid, round2, sum, parseMoney, fmt, fmtSigned, fmtShort, p2, dateStr, timeStr, isDateStr, parseDate, ymOf, monthKey, daysInMonth, addDays, validDate, dateFromDOY, validTime, debounce, clone, clamp, lev, similarity };
  if (typeof module !== 'undefined' && module.exports) module.exports = U;
  root.U = U;
})(typeof window !== 'undefined' ? window : globalThis);

/* FinFlow unit tests — plain Node, no dependencies:  node tests/run.js
   Uses only synthetic data (no real slips or personal records). */
'use strict';
const assert = require('assert');
const path = require('path');
global.window = global;
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
const J = f => path.join(__dirname, '..', 'js', f);
const U = require(J('util.js')), S = require(J('store.js')), C = require(J('calc.js')), SL = require(J('slip.js')), LRN = require(J('learn.js'));

let pass = 0, fail = 0;
function test(name, fn) { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e.message || e).split('\n').join('\n       ')); } }
const reads = (...a) => a.map(t => (typeof t === 'string' ? { t, c: 90 } : t));

console.log('util');
test('local date string is not UTC-shifted', () => assert.strictEqual(U.dateStr(new Date(2026, 0, 5, 0, 30)), '2026-01-05'));
test('parseDate rejects impossible dates', () => { assert(isNaN(U.parseDate('2026-13-45'))); assert(isNaN(U.parseDate('2026-02-30'))); assert.strictEqual(U.parseDate('2024-02-29').getDate(), 29); });
test('parseMoney', () => { assert.strictEqual(U.parseMoney('1,234.50'), 1234.5); assert(isNaN(U.parseMoney('abc'))); assert.strictEqual(U.parseMoney('0.1') + U.parseMoney('0.2'), 0.30000000000000004); assert.strictEqual(U.sum([0.1, 0.2]), 0.3); });
test('dateFromDOY', () => { assert.strictEqual(U.dateFromDOY(2026, 273), '2026-09-30'); assert.strictEqual(U.dateFromDOY(2026, 400), null); });
test('esc', () => assert.strictEqual(U.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'));
test('fmt / fmtShort', () => { assert.strictEqual(U.fmt(1234.5), '฿1,234.50'); assert.strictEqual(U.fmt(10), '฿10'); assert.strictEqual(U.fmtShort(1500000), '฿1.5M'); assert.strictEqual(U.fmtShort(-2500), '−฿2.5k'); });

console.log('calc');
const A = [{ id: 'main', opening: 100 }, { id: 'bank', opening: 0 }];
const T = (o) => ({ id: U.uid(), name: 'x', cat: 'Food', emoji: 'x', time: null, note: null, ...o });
test('balances: income/expense/transfer between accounts', () => {
  const txs = [T({ type: 'income', amount: 1000, date: '2026-01-01' }), T({ type: 'expense', amount: 250.5, date: '2026-01-02' }), T({ type: 'transfer', amount: 300, date: '2026-01-03', acct: 'main', toAcct: 'bank' })];
  const b = C.balances(txs, A); assert.strictEqual(b.byAcct.main, 549.5); assert.strictEqual(b.byAcct.bank, 300); assert.strictEqual(b.total, 849.5);
});
test('transfer to an untracked account leaves the tracked total', () => assert.strictEqual(C.balances([T({ type: 'transfer', amount: 40, date: '2026-01-01', acct: 'main' })], A).total, 60));
test('transfers never count as income or spending', () => { const t = C.totals([T({ type: 'transfer', amount: 99, date: '2026-01-01' }), T({ type: 'expense', amount: 1, date: '2026-01-01' })]); assert.strictEqual(t.expense, 1); assert.strictEqual(t.income, 0); assert.strictEqual(t.transfer, 99); });
test('recurring: day 31 -> last day of short months, back-fills, never twice', () => {
  const rule = { id: 1, type: 'expense', amount: 5, name: 'r', cat: 'Bills', emoji: 'b', day: 31, start: '2026-01-15' };
  let n = 0; const r1 = C.dueRecurring([rule], {}, '2026-03-10', () => ++n);
  assert.deepStrictEqual(r1.txs.map(t => t.date), ['2026-01-31', '2026-02-28']);                        // March 31 is still in the future
  const r2 = C.dueRecurring([rule], r1.done, '2026-03-10', () => ++n); assert.strictEqual(r2.txs.length, 0);
});
test('recurring: a month the user deleted is not regenerated', () => { const r = C.dueRecurring([{ id: 2, type: 'income', amount: 1, name: 'n', cat: 'Salary', emoji: 'x', day: 1, start: '2026-05-01' }], { '2': ['2026-05'] }, '2026-05-20', () => 1); assert.strictEqual(r.txs.length, 0); });
test('duplicate detection by slip reference and by amount/date/time', () => {
  const ex = [T({ type: 'expense', amount: 50, date: '2026-01-01', time: '10:00', slipRef: 'ABC' })];
  assert(C.findDuplicate(ex, { id: 0, slipRef: 'ABC', amount: 1, date: 'x', type: 'expense' }).certain);
  assert(!C.findDuplicate(ex, { id: 0, amount: 50, date: '2026-01-01', time: '10:00', type: 'expense' }).certain);
  assert.strictEqual(C.findDuplicate(ex, { id: 0, amount: 51, date: '2026-01-01', time: '10:00', type: 'expense' }), null);
});
test('budget status per category', () => { const st = C.budgetStatus([T({ type: 'expense', amount: 90, date: '2026-02-03', cat: 'Food' })], 2026, 1, 100, { Food: 100 }); assert.strictEqual(st.pct, 90); assert.strictEqual(st.cats[0].pct, 90); assert(!st.over); });

console.log('store');
test('parseBackup sanitises and drops invalid records', () => {
  const r = S.parseBackup({ transactions: [{ type: 'expense', amount: '12.5', date: '2026-01-01', name: '<x>', id: 1 }, { type: 'x', amount: 1, date: '2026-01-01' }, { type: 'income', amount: -1, date: '2026-01-01' }, { type: 'expense', amount: 5, date: '2026-13-45' }, { type: 'expense', amount: 5, date: '2026-01-01', id: 1 }] });
  assert.strictEqual(r.data.tx.length, 2); assert.strictEqual(r.dropped, 3); assert.notStrictEqual(r.data.tx[0].id, r.data.tx[1].id);
});
test('parseBackup rejects non-backups', () => { assert.throws(() => S.parseBackup({})); assert.throws(() => S.parseBackup(null)); });
test('v3 data migrates (notes, recurring start, schema stamp)', () => {
  localStorage.setItem('ff_tx', JSON.stringify([{ id: 5, type: 'expense', amount: 10, name: 'n', cat: 'Food', emoji: 'f', date: '2026-02-02', time: '09:00', note: '' }]));
  localStorage.setItem('ff_recurring', JSON.stringify([{ id: 7, type: 'income', amount: 9, name: 's', cat: 'Salary', emoji: 'x', day: 3 }]));
  S.migrate(); assert.strictEqual(S.txs()[0].note, null); assert(S.recurring()[0].start); assert.strictEqual(S.rawGet('ff_schema'), '2');
});
test('corrupted storage never throws', () => { localStorage.setItem('ff_tx', '{not json'); assert.deepStrictEqual(S.txs(), []); localStorage.setItem('ff_tx', '[]'); });

console.log('slip');
test('amount: two agreeing reads win over a noisy third', () => { const r = SL.pickAmount(reads('140.00', '140.00 บาท', '140,000.00')); assert.strictEqual(r.value, 140); assert(r.ok); });
test('amount: disagreement is flagged, never silent', () => { const r = SL.pickAmount(reads('140.00', '1,040.00')); assert(!r.ok); assert.strictEqual(r.flag, 'f_amount_disagree'); });
test('amount: thousands separators and spaces', () => assert.strictEqual(SL.amountFromText('1,023.00 บาท'), 1023));
test('despaceThai removes OCR letter-spacing', () => assert.strictEqual(SL.despaceThai('ก ุ ย .'), 'กุย.'));
test('month tokens survive OCR garbling', () => { assert.deepStrictEqual(SL.monthCandidates('ก.ุย.'), [9]); assert.deepStrictEqual(SL.monthCandidates('ต๓ต.ค.'), [10]); assert.deepStrictEqual(SL.monthCandidates('Sep'), [9]); assert.deepStrictEqual(SL.monthCandidates('มี.ค.'), [3]); });
test('slip QR payload -> bank + transaction reference', () => { const q = SL.parseSlipQR('00410006000001010300402200462735o97e74nld2oM85102TH9104369A'); assert.strictEqual(q.bank, '004'); assert.strictEqual(q.ref, '0462735o97e74nld2oM8'); });
test('date: QR reference decides when the printed day is misread', () => {
  const r = SL.pickDate(reads({ t: '09 .9. 2569 17:32', k: 'num' }, { t: '27 กุย. 2569 17:32', k: 'th' }), [], '2026-10-07', '0462705o9751tdkbcTT5');
  assert.strictEqual(r.value, '2026-09-27'); assert(r.ok); assert.strictEqual(r.time, '17:32');
});
test('date: text only (no QR) with agreeing reads', () => { const r = SL.pickDate(reads('01 ต.ค. 2569 07:57', '01 ต๓ต.ค. 2569 07:57', '01 .. 2569 07:57'), [], '2026-10-07'); assert.strictEqual(r.value, '2026-10-01'); assert(r.ok); });
test('date: unreadable month without QR is flagged', () => { const r = SL.pickDate(reads('01 xx 2569 07:57'), [], '2026-10-07'); assert(!r.ok); assert(r.flags.length > 0); });
test('date in the future is flagged', () => { const r = SL.pickDate(reads('30 ธ.ค. 2569 10:00', '30 ธ.ค. 2569 10:00'), [], '2026-10-07'); assert(r.flags.includes('f_date_future')); });
test('note: English model wins for Latin notes, Thai model for Thai', () => {
  assert.strictEqual(SL.pickNote([{ t: 'รอหอท', c: 95, v: 'G' }, { t: 'seven', c: 91, v: 'eG' }]).text, 'seven');
  assert.strictEqual(SL.pickNote([{ t: 'ซักผ้า', c: 95, v: 'G' }, { t: 'n9 ib', c: 50, v: 'eG' }]).text, 'ซักผ้า');
});
test('note: Thai digits inside a note are treated as OCR noise (low confidence)', () => assert(SL.pickNote([{ t: 'ค่านำค่าไฟเดือน0๐1๐0๕ห', c: 87, v: 'G' }]).conf <= 40));
test('names: agreeing clean reads beat confident garbage', () => assert.strictEqual(SL.pickName([{ t: 'ร0บ8คพผล', c: 68 }, { t: 'SODA CO.,LTD', c: 90 }, { t: 'SODA CO.,LTD', c: 91 }]).text, 'SODA CO.,LTD'));
test('own-transfer hint compares first names only (relative with same surname is not "me")', () => { assert(SL.looksSameOwner('สมชาย ศ', 'สมชาย ศรีสุข')); assert(!SL.looksSameOwner('สมชาย ศ', 'สมศรี ศรีสุข')); });
test('layout: finds amount by the big gap, handles 2-line merchant names', () => {
  const rows = [[68, 113], [134, 154], [252, 285], [307, 327], [417, 454], [469, 505], [522, 542], [697, 740], [791, 814], [843, 859], [913, 940]].map(([y0, y1]) => ({ y0, y1, ink: 999 }));
  const L = SL.layout(rows, 988, 1205, { y0: 1085, y1: 1164 });
  assert(L.ok); assert.strictEqual(L.recip.length, 2); assert.strictEqual(L.amount.y0, 697); assert.strictEqual(L.recipAcct.y0, 522);
});

console.log('learn');
test('learned payee is reused; same last-4 with a different name is not trusted', () => {
  S.setCats('expense', [{ emoji: '🍜', name: 'Food' }, { emoji: '🧾', name: 'Bills' }, { emoji: '📦', name: 'Other' }]);
  LRN.remember({ key: '6007', recipient: 'Somchai Jaidee', name: 'Water bill', cat: 'Bills', emoji: '🧾', type: 'expense' });
  const a = LRN.suggest({ recipient: 'Somchai Jaldee', recipientKey: '6007', note: '', ownHint: false }, []); assert(a.learned && a.cat === 'Bills' && a.name === 'Water bill');
  const b = LRN.suggest({ recipient: 'Totally Different Shop', recipientKey: '6007', note: '', ownHint: false }, []); assert(!b.learned);
});
test('category from keywords when there is no history', () => { S.setCats('expense', [{ emoji: '🚗', name: 'Transport' }, { emoji: '📦', name: 'Other' }]); assert.strictEqual(LRN.suggest({ recipient: 'BTS TIM TVM', recipientKey: '', note: '', ownHint: false }, []).cat, 'Transport'); });

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

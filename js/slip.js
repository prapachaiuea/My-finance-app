/* FinFlow — slip interpretation. PURE functions: take raw OCR reads (several independent reads per field) and decide the value,
   how sure we are, and which fields a human must double-check. No DOM, no OCR engine here, so it is unit-tested in Node. */
(function (root) {
  'use strict';
  const U = root.U || require('./util.js');

  /* ---------- text normalisation ---------- */
  const TH_DIG = '๐๑๒๓๔๕๖๗๘๙';
  const toArabic = s => String(s || '').replace(/[๐-๙]/g, c => TH_DIG.indexOf(c));
  function normText(s) {
    return String(s || '').normalize('NFC')
      .replace(/ํา/g, 'ำ')                 // decomposed sara-am (Tesseract emits this)
      .replace(/[​-‍﻿]/g, '')
      .replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ').trim();
  }
  /** Tesseract's Thai model puts spaces between characters ("ก ุ ย ."). Remove spaces that cannot be real word breaks. */
  function despaceThai(s) {
    s = normText(s);
    s = s.replace(/ +([ัิ-ฺ็-๎])/g, '$1');      // before combining marks
    s = s.replace(/([เแโใไ]) +/g, '$1');         // after leading vowels
    s = s.replace(/([ก-๛]) +([.,])/g, '$1$2');    // before a dot/comma that follows Thai ("ก.ย ." -> "ก.ย.")
    s = s.replace(/([฀-๿]) (?=[฀-๿])/g, (m, a, off, str) => {
      // keep a single space only between two clearly separate words (both sides >=2 Thai letters)
      const before = str.slice(0, off + 1).match(/[฀-๿]+$/), after = str.slice(off + 2).match(/^[฀-๿]+/);
      return before && after && before[0].length >= 3 && after[0].length >= 3 ? a + ' ' : a;
    });
    return s;
  }
  const THAI_RE = /[ก-ฮ]/g;
  const skeleton = s => (String(s).match(THAI_RE) || []).join('');
  /** ratio of "normal" characters; slips never contain |, ~, #, @, etc. in names */
  function cleanliness(s) {
    s = String(s || ''); if (!s) return 0;
    const ok = (s.match(/[฀-๿ A-Za-z0-9.,()&\-'/]/g) || []).length;
    return ok / s.length;
  }

  /* ---------- header: what kind of slip ---------- */
  function slipKind(reads) {
    const s = (reads || []).map(r => normText(r.t)).join(' ');
    if (/เติม|top\s*-?\s*up/i.test(s)) return 'topup';
    if (/ชำระ|payment|bill/i.test(s)) return 'pay';
    if (/รับเงิน|received/i.test(s)) return 'receive';
    if (/โอน|transfer/i.test(s)) return 'transfer';
    return null;
  }

  /* ---------- amount ---------- */
  function amountFromText(t) {
    const s = toArabic(normText(t)).replace(/[Oo]/g, '0');
    const m = s.replace(/(\d)[ ,](?=\d{3}\b)/g, '$1').match(/(\d{1,9})\.(\d{2})(?!\d)/);   // "1 023.00" / "1,023.00"
    if (!m) return null;
    const v = parseFloat(m[1] + '.' + m[2]);
    return v > 0 && v < 1e8 ? U.round2(v) : null;
  }
  function pickAmount(reads) {
    const vals = (reads || []).map(r => amountFromText(r.t)).filter(v => v !== null);
    if (!vals.length) return { value: null, ok: false, flag: 'f_amount_missing' };
    const cnt = {}; vals.forEach(v => { cnt[v] = (cnt[v] || 0) + 1; });
    const ranked = Object.entries(cnt).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
    const top = +ranked[0][0], agree = ranked[0][1];
    const ok = agree >= 2 && (ranked.length === 1 || agree > ranked[1][1]);
    return { value: top, ok, flag: ok ? null : 'f_amount_disagree', reads: vals };
  }

  /* ---------- date / time ---------- */
  const MONTH_SK = { 'กพ': [2], 'พค': [5], 'กค': [7], 'สค': [8], 'กย': [9], 'ตค': [10], 'พย': [11], 'ธค': [12], 'มค': [1, 3], 'มย': [4, 6] };
  const MONTH_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  /** candidate month numbers for an OCR'd month token ("ก.ุย.", "ต๓ต.ค.", "Sep") */
  function monthCandidates(tok) {
    tok = normText(tok).toLowerCase();
    if (!tok) return [];
    const en = MONTH_EN.findIndex(m => tok.includes(m)); if (en >= 0) return [en + 1];
    const sk = skeleton(tok);
    let found = [];
    for (const k in MONTH_SK) if (sk.includes(k)) found = found.concat(MONTH_SK[k]);
    found = [...new Set(found)];
    if (found.includes(1) && found.includes(3)) found = tok.includes('ี') ? [3] : [1];
    if (found.includes(4) && found.includes(6)) found = tok.includes('เ') ? [4] : tok.includes('ิ') ? [6] : [4, 6];
    return found;
  }
  // anchor on "YEAR HH:MM" (digits, reliable) then take the day from the start of the line; whatever sits between is the month token
  const YT_RE = /(25\d{2}|20\d{2})\s*[ ,]?\s*(\d{1,2})\s*[:.]\s*(\d{2})/;
  function parseDateRead(t) {
    const s = toArabic(normText(t));
    const m = YT_RE.exec(s); if (!m) return null;
    let year = +m[1]; if (year >= 2400) year -= 543;
    if (!(year >= 1990 && year <= 2100)) return null;
    const before = s.slice(0, m.index), dm = /^\D{0,3}(\d{1,2})(?!\d)/.exec(before);
    const hh = +m[2], mm = +m[3];
    return { day: dm ? +dm[1] : null, tok: dm ? before.slice(dm[0].length) : before, year, hh, mm, timeOk: hh <= 23 && mm <= 59 };
  }
  const mode = arr => { const c = {}; let best = null, bn = 0; for (const x of arr) { c[x] = (c[x] || 0) + 1; if (c[x] > bn) { bn = c[x]; best = x; } } return best === null ? null : { v: best, n: bn }; };

  /** The transaction number printed on KBank slips encodes the date: digit 3 = year digit, digits 4-6 = day of year. */
  /** Thai bank slip-verification QR (EMV TLV): 00{len}[ 00 api, 01 sending bank, 02 transaction ref ] 51 country, 91 crc. Returns {bank, ref}. */
  function parseSlipQR(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const tlv = (s) => { const o = []; let i = 0; while (i + 4 <= s.length) { const id = s.slice(i, i + 2), len = parseInt(s.slice(i + 2, i + 4), 10); if (!(len >= 0) || i + 4 + len > s.length) break; o.push([id, s.slice(i + 4, i + 4 + len)]); i += 4 + len; } return o; };
    const top = tlv(payload); const f = top.find(x => x[0] === '00'); if (!f) return null;
    const sub = tlv(f[1]); const bank = (sub.find(x => x[0] === '01') || [])[1], ref = (sub.find(x => x[0] === '02') || [])[1];
    return ref && /^[A-Za-z0-9]{10,30}$/.test(ref) ? { bank: bank || null, ref } : null;
  }
  function parseRef(reads) {
    for (const r of (reads || [])) {
      const s = normText(r.t);
      const m = /[:：]\s*([A-Za-z0-9๐-๙]{12,26})/.exec(s) || /\b([0-9๐-๙OoอD]{7}[A-Za-z0-9๐-๙]{6,20})\b/.exec(s);
      if (!m) continue;
      let v = m[1];
      const head = toArabic(v.slice(0, 7)).replace(/[Oo]/g, '0').replace(/[lI|]/g, '1');
      v = head + v.slice(7);
      if (/^\d{7}/.test(head)) return { value: v, head };
    }
    return null;
  }
  function refDate(ref, year) {
    if (!ref || !year) return null;
    const yd = +ref.head[2], doy = +ref.head.slice(3, 6);
    if (yd !== year % 10) return null;
    return U.dateFromDOY(year, doy);
  }
  /** date encoded in a transaction number, without needing the OCR'd year: KBank "04"+yearDigit+DOY; others may start with yyyymmdd */
  function refDateAny(refValue, yearHint) {
    if (!refValue) return null;
    const head = toArabic(refValue.slice(0, 8)).replace(/[Oo]/g, '0');
    const ymd = /^(20\d{2})(\d{2})(\d{2})/.exec(head);
    if (ymd && U.validDate(+ymd[1], +ymd[2], +ymd[3])) return ymd[1] + '-' + ymd[2] + '-' + ymd[3];
    if (/^\d{7}/.test(head) && yearHint) return refDate({ head: head.slice(0, 7) }, yearHint);
    return null;
  }

  function pickDate(reads, refReads, today, qrRef) {
    const parsed = (reads || []).map(r => parseDateRead(r.t)).filter(Boolean);
    const out = { value: null, time: null, ok: false, timeOk: false, flags: [], refValue: null };
    const ocrRef = parseRef(refReads);
    out.refValue = qrRef || (ocrRef ? ocrRef.value : null);
    const todayD = today || U.dateStr();
    if (!parsed.length) {
      out.flags.push('f_time_missing');
      const dOnly = refDateAny(out.refValue, +todayD.slice(0, 4)) || refDateAny(out.refValue, +todayD.slice(0, 4) - 1);
      if (dOnly) { out.value = dOnly; out.how = qrRef ? 'qr' : 'ref'; out.ok = !!qrRef; if (!out.ok) out.flags.push('f_date_disagree'); } else out.flags.push('f_date_missing');
      return out;
    }
    const year = (mode(parsed.map(p => p.year)) || {}).v;
    const dayM = mode(parsed.filter(p => p.day >= 1 && p.day <= 31).map(p => p.day));
    const timeM = mode(parsed.filter(p => p.timeOk).map(p => U.p2(p.hh) + ':' + U.p2(p.mm)));
    if (timeM) { out.time = timeM.v; out.timeOk = timeM.n >= 2; } else out.flags.push('f_time_missing');

    // month: vote across the Thai reads (Tesseract garbles the Thai month abbreviation about half the time; the digits are reliable)
    const monthVotes = {}; let voters = 0;
    parsed.forEach(p => { const c = monthCandidates(p.tok); if (c.length) { voters++; c.forEach(mn => { monthVotes[mn] = (monthVotes[mn] || 0) + 1 / c.length; }); } });
    const monthRank = Object.entries(monthVotes).sort((a, b) => b[1] - a[1]);
    const month = monthRank.length && (monthRank.length === 1 || monthRank[0][1] > monthRank[1][1]) ? +monthRank[0][0] : null;

    let dText = null;
    if (dayM && month && U.validDate(year, month, dayM.v)) dText = year + '-' + U.p2(month) + '-' + U.p2(dayM.v);
    if (!dText && dayM && monthRank.length > 1) {                       // Apr/Jun style ambiguity -> the one that is not in the future
      const c = monthRank.map(x => +x[0]).filter(mn => U.validDate(year, mn, dayM.v)).map(mn => year + '-' + U.p2(mn) + '-' + U.p2(dayM.v)).filter(d => d <= todayD);
      if (c.length === 1) dText = c[0];
    }
    // date hidden in the transaction number (QR = exact characters, OCR = two noisy reads)
    const dQR = qrRef ? refDateAny(qrRef, year) : null;
    const dOCR = !dQR && ocrRef ? refDate(ocrRef, year) : null;
    const dRef = dQR || dOCR;
    const dayAgrees = dRef && dayM && +dRef.slice(8) === dayM.v;

    if (dRef && dText) {
      if (dRef === dText) { out.value = dText; out.ok = true; out.how = dQR ? 'qr+text' : 'ref+text'; }
      else if (dQR || dayAgrees) { out.value = dRef; out.ok = true; out.how = dQR ? 'qr' : 'ref+day'; }   // exact QR wins; or day digit + ref agree
      else { out.value = dRef; out.ok = false; out.how = 'ref'; out.flags.push('f_date_disagree'); }
    } else if (dRef) {
      out.value = dRef; out.how = dQR ? 'qr' : 'ref'; out.ok = !!(dQR || dayAgrees);
      if (!out.ok) out.flags.push('f_date_disagree');
    } else if (dText) {
      out.value = dText; out.how = 'text';
      out.ok = voters >= 2 && parsed.filter(p => p.day === dayM.v).length >= 2;
      if (!out.ok) out.flags.push('f_date_disagree');
    } else out.flags.push('f_date_missing');
    if (out.value && out.value > U.addDays(todayD, 1)) { out.ok = false; out.flags.push('f_date_future'); }
    return out;
  }

  /* ---------- accounts / names ---------- */
  function acctKey(reads) {
    const keys = (reads || []).map(r => toArabic(normText(r.t)).replace(/[^0-9]/g, '')).filter(k => k.length >= 3);
    if (!keys.length) return null;
    const m = mode(keys); return m.v.slice(-10);
  }
  const TITLE_RE = /^(นาย|นางสาว|น\.ส\.|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|ms\.?|miss)\s*/i;
  function cleanName(s) {
    s = despaceThai(s);
    s = s.replace(/^[^ก-๛A-Za-z0-9(]+/, '').replace(/[|~_*#@^<>{}\[\]\\]+/g, '').replace(/ {2,}/g, ' ').trim();
    return s;
  }
  const stripTitle = s => s.replace(TITLE_RE, '').trim();
  function scoreName(r) { const s = cleanName(r.t); return (r.c || 0) * cleanliness(s) - (s.length < 2 ? 40 : 0); }
  /** several reads of the same line: reads that agree support each other; reads full of odd symbols are penalised */
  function pickName(variants) {
    const vs = (variants || []).filter(v => v && normText(v.t));
    if (!vs.length) return { text: '', conf: 0 };
    const groups = {};
    vs.forEach(v => { const k = cleanName(v.t); const g = groups[k] = groups[k] || { text: k, n: 0, best: 0 }; g.n++; g.best = Math.max(g.best, scoreName(v)); });
    const ranked = Object.values(groups).map(g => ({ ...g, s: g.best + 7 * (g.n - 1) })).sort((a, b) => b.s - a.s);
    const b = ranked[0];
    return { text: b.text, conf: Math.round(Math.min(b.best, 99)) };
  }
  /** Is the receiving account probably one of the user's own? Sender is printed as "FirstName I" (truncated surname) and
   *  the receiver as the full name: compare the FIRST names only (a relative with the same surname must not match). */
  function looksSameOwner(senderName, recipName) {
    const sn = stripTitle(despaceThai(senderName)).split(' ').filter(Boolean), rn = stripTitle(despaceThai(recipName)).split(' ').filter(Boolean);
    if (!sn.length || rn.length < 2) return false;
    const a = skeleton(sn[0]), b = skeleton(rn[0]);
    if (a.length < 4 || b.length < 4) return false;
    return U.similarity(a, b) >= 0.7;
  }

  /* ---------- note (text the user typed in the white box: Thai, English or mixed) ---------- */
  const LATIN_OK = t => /^[A-Za-z0-9 .,&'()\-\/+!?:@#]{2,}$/.test(t) && (t.match(/[A-Za-z]/g) || []).length >= 2;
  function pickNote(variants) {
    const vs = (variants || []).map(v => ({ t: normText(v.t).replace(/^[|\[\]\s]+|[|\[\]\s]+$/g, ''), c: v.c || 0, v: v.v || '' }))
      .filter(v => v.t && /[\u0E01-\u0E5BA-Za-z0-9]/.test(v.t));
    if (!vs.length) return { text: '', conf: 0 };
    const isEn = v => v.v[0] === 'e';
    // the Thai model "hallucinates" Thai letters (with high confidence!) for English notes like "seven"; the English model only wins when it reads clean Latin text
    const en = vs.filter(v => isEn(v) && LATIN_OK(v.t) && v.c >= 78).sort((a, b) => b.c - a.c)[0];
    const th = vs.filter(v => !isEn(v)).map(v => ({ ...v, s: v.c * cleanliness(v.t) - (v.t.length < 2 ? 25 : 0) - (/(\|\s*){2,}/.test(v.t) ? 40 : 0) - (/[๐-๙]/.test(v.t) ? 45 : 0) })).sort((a, b) => b.s - a.s)[0];
    const pick = en && !(th && LATIN_OK(despaceThai(th.t)) && th.c >= en.c) ? en : (th || en);
    const t = despaceThai(pick.t).replace(/^[^\u0E01-\u0E5BA-Za-z0-9(]+/, '').replace(/[|~_*#@^<>{}\[\]\\]+/g, '').trim();
    let conf = Math.round(pick.c * cleanliness(t));
    if (/[๐-๙]/.test(t)) conf = Math.min(conf, 40);
    return { text: t, conf };
  }

  /* ---------- geometry: which text row is what (KBank Make style: name, acct, name(s), acct, AMOUNT, fee, refs) ---------- */
  function layout(rows, w, h, noteBox) {
    let R = rows.map(r => ({ y0: r.y0, y1: r.y1, ink: r.ink, h: r.y1 - r.y0 + 1 }));
    if (noteBox) R = R.filter(r => r.y1 < noteBox.y0 - 3);   // keep only rows above the note box
    const L = { ok: false, recip: [], refs: [] };
    if (!R.length) return L;
    let i = 0;
    if (R[i].y0 < h * 0.14) L.header = R[i++];
    if (R[i] && R[i].h <= 40 && R[i].y0 < h * 0.24) L.date = R[i++];
    if (R[i] && R[i].h >= 28 && R[i].y0 < h * 0.35) L.sender = R[i++];
    if (R[i] && R[i].h <= 29) L.senderAcct = R[i++];
    // AMOUNT = first tall row preceded by a big vertical gap (the "จำนวน" label sits in that gap, left of our scan band)
    let k = -1;
    for (let j = i + 1; j < R.length; j++) if (R[j].h >= 38 && R[j].y0 - R[j - 1].y1 >= 80) { k = j; break; }
    if (k < 0) {                                         // fallback: tallest row in the middle band
      const c = R.filter((r, j) => j > i && r.y0 > h * 0.3 && r.y0 < h * 0.8 && r.h >= 38).sort((a, b) => b.h - a.h)[0];
      if (c) k = R.indexOf(c);
    }
    if (k > i) {
      const between = R.slice(i, k);                     // recipient name row(s) ... recipient account row
      if (between.length >= 2) { L.recipAcct = between[between.length - 1]; L.recip = between.slice(0, -1).slice(0, 3); }
      else if (between.length === 1) L.recip = between;
      L.amount = R[k]; i = k + 1;
    }
    if (R[i] && R[i].h <= 29) L.feeLabel = R[i++];
    if (R[i] && R[i].h <= 29) L.fee = R[i++];
    L.refs = R.slice(i);
    L.ok = !!(L.date && L.sender && L.recip.length && L.recipAcct && L.amount);
    return L;
  }

  /* ---------- put it together ---------- */
  function interpret(raw, ctx) {
    ctx = ctx || {};
    const flags = [];
    const kind = slipKind(raw.header);
    const amount = pickAmount(raw.amount);
    if (amount.flag) flags.push({ code: amount.flag, field: 'amount' });
    const qr = parseSlipQR(raw.qr);
    const date = pickDate(raw.date, raw.ref, ctx.today, qr && qr.ref);
    date.flags.forEach(c => flags.push({ code: c, field: c === 'f_time_missing' ? 'time' : 'date' }));

    const sender = pickName(raw.senderName);
    const recipParts = (raw.recipRows || []).map(pickName).filter(p => p.text);
    const recipient = { text: recipParts.map(p => p.text).join(' ').replace(/ {2,}/g, ' ').trim(), conf: recipParts.length ? Math.min(...recipParts.map(p => p.conf)) : 0 };
    if (!recipient.text || recipient.conf < 62) flags.push({ code: 'f_name_low', field: 'to' });
    const note = pickNote(raw.note);
    // an empty note box is normal (the user typed nothing); only warn when something was read but looks like noise
    if (note.text && note.conf < 60) flags.push({ code: 'f_note_low', field: 'note' });

    const recvKey = acctKey(raw.recipAcct), sendKey = acctKey(raw.senderAcct);
    if (!raw.structureOk) flags.push({ code: 'f_layout', field: 'all' });

    return {
      kind, amount, date: date.value, dateOk: date.ok, dateHow: date.how, time: date.time, timeOk: date.timeOk,
      ref: date.refValue, sender: sender.text, senderKey: sendKey,
      recipient: recipient.text, recipientConf: recipient.conf, recipientKey: recvKey,
      note: note.text, noteConf: note.conf,
      ownHint: !!(sender.text && recipient.text && looksSameOwner(sender.text, recipient.text)),
      slipRef: qr ? qr.ref : null, bankCode: qr ? qr.bank : null, flags
    };
  }

  const SL = { toArabic, normText, despaceThai, skeleton, cleanliness, slipKind, amountFromText, pickAmount, monthCandidates, parseDateRead, parseRef, parseSlipQR, refDate, refDateAny, pickDate, acctKey, cleanName, stripTitle, pickName, pickNote, looksSameOwner, layout, interpret };
  if (typeof module !== 'undefined' && module.exports) module.exports = SL;
  root.SLIP = SL;
})(typeof window !== 'undefined' ? window : globalThis);

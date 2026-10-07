/* FinFlow — the app learns from your corrections so slips become hands-free over time:
   payee/account -> description + category, "my own accounts" (to detect transfers between them), keyword + history based category guesses. */
(function (root) {
  'use strict';
  const U = root.U, S = root.S, SL = root.SLIP;

  const KEYWORDS = [
    ['Transport', /\b(bts|mrt|bolt|grab|taxi|ptt|shell|bangchak|caltex|esso)\b|yellow ?line|pink ?line|สายเหลือง|สายสีชมพู|รถไฟ|ทางด่วน|วินมอเตอร์|มอเตอร์ไซค์|แท็กซี่|น้ำมัน|นำมัน|จอดรถ|parking|easy ?pass|บางจาก|ปตท|รถเมล์|เรือ|tim tvm|bem/i],
    ['Food', /seven|7-?eleven|เซเว่น|lawson|ลอว์สัน|family ?mart|cafe|café|coffee|กาแฟ|ข้าว|ก๋วยเตี๋ยว|เตี๋ยว|ชาบู|ซูชิ|sushi|ramen|ราเมน|kfc|mcdonald|burger|pizza|suki|สุกี้|ชานม|ชาไทย|ไอติม|ice ?cream|dairy ?queen|\bdq\b|line ?man|lineman|grab ?food|foodpanda|เบเกอรี่|bakery|yogurt|โยเกิร์ต|jolly|จอลลี่|popcorn|ป๊อปคอร์น|อาหาร|หมูกระทะ|ส้มตำ|ขนม|เครื่องดื่ม|trueMoney|ทรูมันนี่|soda|น้ำ|starbucks|amazon|after ?you|mk|bonchon|tacobell|taco ?bell|cj ?more|big ?c|lotus|tops|makro|ร้านอาหาร|food/i],
    ['Shopping', /shopee|lazada|uniqlo|watsons|boots|central|robinson|ikea|homepro|index|powerbuy|jib|banana|apple|นายอินทร์|se-?ed|b2s|daiso|miniso|ซักผ้า|ร้านค้า/i],
    ['Bills', /\btrue\b|\bais\b|dtac|ค่าไฟ|ค่าน้ำ|ค่าโทรศัพท์|ค่ามือถือ|การไฟฟ้า|การประปา|\bbill|บิล|internet|อินเทอร์เน็ต|3bb|\bnt\b|ประกัน|insurance|ภาษี/i],
    ['Entertainment', /netflix|youtube|spotify|disney|major|เมเจอร์|sf ?cinema|egv|cinema|ภาพยนตร์|หนัง|ตั๋ว|ticket|game|เกม|karaoke|คาราโอเกะ|\brv\b|concert/i],
    ['Health', /โรงพยาบาล|hospital|\bยา\b|ร้านยา|pharmacy|clinic|คลินิก|หมอ|ทันต|dental|fitness|ฟิตเนส/i],
    ['Rent', /ค่าเช่า|\brent\b|คอนโด|condo|หอพัก|ค่าห้อง/i],
    ['Travel', /airasia|agoda|booking\.com|hotel|โรงแรม|flight|ตั๋วเครื่องบิน|nok ?air|lion ?air|resort|รีสอร์ท/i],
    ['Investment', /s&p|กองทุน|หุ้น|\bfund\b|dime|bitkub|ลงทุน|etf|binance/i]
  ];
  const INCOME_KEYWORDS = [
    ['Salary', /เงินเดือน|salary/i],
    ['Bonus', /โบนัส|bonus/i],
    ['Freelance', /freelance|ฟรีแลนซ์|ค่าจ้าง/i]
  ];

  const nrm = s => String(s || '').toLowerCase().normalize('NFC').replace(/[็-๎]/g, '').replace(/[^a-z0-9ก-๛]/g, '');

  /* ---------- history index (rebuilt only when the transaction list changes) ---------- */
  let _idxFor = null, _idx = null;
  function index(txs) {
    if (_idxFor === txs && _idx) return _idx;
    const byText = {}, notes = {}, names = {};
    for (const t of txs) {
      if (t.type === 'transfer') continue;
      for (const raw of [t.name, t.note]) {
        const k = nrm(raw); if (k.length < 2) continue;
        const o = byText[k] = byText[k] || { n: 0, cats: {} };
        o.n++; const ck = t.type + '|' + t.cat; o.cats[ck] = (o.cats[ck] || 0) + 1;
      }
      if (t.note) { const k = nrm(t.note); if (k.length >= 2) { const o = notes[k] = notes[k] || { text: t.note, n: 0 }; o.n++; } }
      if (t.name) { const k = nrm(t.name); if (k.length >= 2) { const o = names[k] = names[k] || { text: t.name, n: 0 }; o.n++; } }
    }
    _idxFor = txs; _idx = { byText, notes, names };
    return _idx;
  }
  function bestCat(o) { return Object.entries(o.cats).sort((a, b) => b[1] - a[1])[0][0].split('|'); }

  /** snap an OCR'd phrase onto a phrase the user has typed before (>=85% similar) */
  function snap(text, table, minSim) {
    const k = nrm(text); if (k.length < 2) return null;
    if (table[k]) return table[k].text;
    let best = null, bs = minSim || 0.85;
    for (const key in table) { if (Math.abs(key.length - k.length) > 3) continue; const s = U.similarity(k, key); if (s >= bs && (!best || s > bs || table[key].n > best.n)) { bs = s; best = table[key]; } }
    return best ? best.text : null;
  }

  function keywordCat(text, type, cats) {
    const rules = type === 'income' ? INCOME_KEYWORDS : KEYWORDS;
    for (const [cat, re] of rules) if (re.test(text) && cats.some(c => c.name === cat)) return cat;
    return null;
  }

  /* ---------- learned payees ---------- */
  function lookupPayee(key, recipient) {
    const L = S.learn(), sk = nrm(SL.stripTitle(recipient || '')).slice(0, 16);
    if (key && L.byAcct && L.byAcct[key]) {
      const e = L.byAcct[key];
      // short account suffixes (4 digits) collide across banks: also require the printed name to look alike. Long keys (phone numbers) are unique enough.
      if (key.length >= 8 || !e.skel || !sk || U.similarity(e.skel.slice(0, 10), sk.slice(0, 10)) >= 0.45) return e;
    }
    if (sk.length >= 4 && L.byName) {
      let best = null, bs = 0.8;
      for (const k in L.byName) { const e = L.byName[k]; const s = U.similarity(k.slice(0, 12), sk.slice(0, 12)); if (s >= bs) { bs = s; best = e; } }
      if (best) return best;
    }
    return null;
  }
  function remember(o) {      // o: {key, recipient, name, cat, emoji, type, note}
    const L = S.learn(); L.byAcct = L.byAcct || {}; L.byName = L.byName || {}; L.mine = L.mine || [];
    const sk = nrm(SL.stripTitle(o.recipient || ''));
    const entry = { name: o.name || '', cat: o.cat, emoji: o.emoji, type: o.type, skel: sk.slice(0, 16), n: 1, at: Date.now() };
    if (o.key) { const old = L.byAcct[o.key]; if (old && old.cat === entry.cat && old.name === entry.name) entry.n = (old.n || 1) + 1; L.byAcct[o.key] = entry; }
    if (sk.length >= 4) L.byName[sk.slice(0, 12)] = entry;
    const keys = Object.keys(L.byName); if (keys.length > 400) delete L.byName[keys.sort((a, b) => (L.byName[a].at || 0) - (L.byName[b].at || 0))[0]];
    S.setLearn(L);
  }
  function addMine(key) { if (!key || key.length < 3) return; const L = S.learn(); L.mine = L.mine || []; if (!L.mine.includes(key)) { L.mine.push(key); S.setLearn(L); } }
  function isMine(key) { return !!key && (S.learn().mine || []).includes(key); }

  /** Fill defaults for a scanned slip. Returns {name, note, cat, emoji, type, learned:bool, own:bool} */
  function suggest(r, txs) {
    const idx = index(txs);
    const L = S.learn();
    const out = { name: r.recipient || '', note: r.note || '', type: 'expense', cat: null, emoji: null, learned: false, own: false };
    // own accounts: receiving account is one the user marked / sender and receiver look like the same person
    if (isMine(r.recipientKey) || (r.ownHint && !r.recipientKey) || (r.ownHint && !(L.byAcct && L.byAcct[r.recipientKey]))) out.own = true;
    if (isMine(r.recipientKey)) out.own = true;
    const noteSnap = r.note ? snap(r.note, idx.notes, 0.84) : null; if (noteSnap) out.note = noteSnap;
    const learned = lookupPayee(r.recipientKey, r.recipient);
    if (learned) {
      out.learned = true; if (learned.name) out.name = learned.name;
      out.type = learned.type || 'expense'; out.cat = learned.cat; out.emoji = learned.emoji;
      if (learned.type === 'transfer') out.own = true;
    } else {
      const nameSnap = out.name ? snap(out.name, idx.names, 0.86) : null; if (nameSnap) out.name = nameSnap;
    }
    if (!out.cat) {
      const cats = S.cats('expense'), text = [out.note, out.name, r.recipient].join(' ');
      // 1) the user's own history for the same words (their note is the strongest hint) 2) keywords 3) fall back to Other
      for (const s of [out.note, out.name]) { const k = nrm(s); if (k.length >= 2 && idx.byText[k]) { const [ty, c] = bestCat(idx.byText[k]); if (ty === 'expense' && cats.some(x => x.name === c)) { out.cat = c; break; } } }
      if (!out.cat) out.cat = keywordCat(text, 'expense', cats);
      if (!out.cat) out.cat = (cats.find(c => c.name === 'Other') || cats[cats.length - 1] || { name: 'Other' }).name;
      const c = cats.find(x => x.name === out.cat); out.emoji = c ? c.emoji : '📦';
    }
    return out;
  }

  const LRN = { suggest, remember, addMine, isMine, lookupPayee, snap, index, keywordCat, nrm };
  if (typeof module !== 'undefined' && module.exports) module.exports = LRN;
  root.LRN = LRN;
})(typeof window !== 'undefined' ? window : globalThis);

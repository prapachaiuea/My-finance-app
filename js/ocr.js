/* FinFlow — slip reader (browser). Pipeline:
   normalise image -> adaptive black/white -> find text rows -> classify rows by layout -> read each field with several
   independent passes (different preprocessing / digit-only engine) -> hand the raw reads to SLIP.interpret() which cross-checks them.
   Tesseract.js is loaded on demand (first scan) so the app itself starts instantly and works offline for everything else. */
(function (root) {
  'use strict';
  const IMG = root.IMG, SL = root.SLIP;

  const TESS_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/4.1.1/tesseract.min.js', 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js'];
  const JSQR_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js', 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'];
  const NORM_W = 1000;
  /* tessdata_best (7 MB, downloaded once and cached by the browser) reads small Thai text noticeably better than the 0.9 MB default. */
  const LANG_BEST = 'https://tessdata.projectnaptha.com/4.0.0_best';
  let langPath = LANG_BEST;
  const NUM_WL = '0123456789.,:-xX /';

  function loadScript(urls, test) {
    return new Promise((res, rej) => {
      if (test()) return res();
      let i = 0;
      const next = () => {
        if (i >= urls.length) return rej(new Error('script load failed'));
        const s = document.createElement('script'); s.src = urls[i++]; s.async = true;
        s.onload = () => (test() ? res() : next()); s.onerror = () => { s.remove(); next(); };
        document.head.appendChild(s);
      };
      next();
    });
  }

  /* ---------- workers ---------- */
  let W = null, initP = null;
  function ensure() {
    if (W) return Promise.resolve(W);
    if (initP) return initP;
    initP = (async () => {
      await loadScript(TESS_URLS, () => !!root.Tesseract);
      const build = async lp => {
        const mk = async (lang, params) => {
          const w = await root.Tesseract.createWorker(lp ? { logger: () => { }, langPath: lp } : { logger: () => { } });
          await w.loadLanguage(lang); await w.initialize(lang); await w.setParameters(params);
          return w;
        };
        const [th, num] = await Promise.all([
          mk('tha+eng', { tessedit_pageseg_mode: '7', preserve_interword_spaces: '1' }),
          mk('eng', { tessedit_pageseg_mode: '7', tessedit_char_whitelist: NUM_WL })
        ]);
        return { th, num };
      };
      try { W = await build(langPath); }
      catch (e) { if (!langPath) throw e; langPath = null; W = await build(null); }      // best model unreachable -> default model
      return W;
    })();
    initP.catch(() => { initP = null; });
    return initP;
  }
  async function terminate() { const w = W; W = null; initP = null; if (w) { try { await w.th.terminate(); await w.num.terminate(); } catch (_) { } } }

  /* ---------- image helpers ---------- */
  function loadImage(blob) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(blob), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image decode failed')); };
      img.src = url;
    });
  }
  function toCanvas(c, scale) {
    const t = document.createElement('canvas'); t.width = c.w; t.height = c.h;
    const x = t.getContext('2d'), id = x.createImageData(c.w, c.h);
    for (let i = 0; i < c.data.length; i++) { const v = c.data[i]; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    x.putImageData(id, 0, 0);
    if (!scale || scale === 1) return t;
    const o = document.createElement('canvas'); o.width = Math.round(c.w * scale); o.height = Math.round(c.h * scale);
    const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(t, 0, 0, o.width, o.height);
    return o;
  }
  const scaleFor = h => Math.min(3.5, Math.max(1.6, 84 / Math.max(10, h)));

  async function readCanvas(worker, canvas) {
    try { const r = (await worker.recognize(canvas)).data; return { t: (r.text || '').replace(/\s+/g, ' ').trim(), c: Math.round(r.confidence || 0) }; }
    catch (_) { return { t: '', c: 0 }; }
  }

  /* ---------- QR (Thai slip verification QR carries the unique transaction reference) ---------- */
  async function decodeQR(canvas) {
    try {
      if ('BarcodeDetector' in root) {
        const d = new root.BarcodeDetector({ formats: ['qr_code'] });
        const r = await d.detect(canvas); if (r && r[0] && r[0].rawValue) return r[0].rawValue;
      }
    } catch (_) { }
    try {
      await loadScript(JSQR_URLS, () => typeof root.jsQR === 'function');
      const id = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const r = root.jsQR(id.data, id.width, id.height, { inversionAttempts: 'dontInvert' });
      return r && r.data ? r.data : null;
    } catch (_) { return null; }
  }

  function makeThumb(canvas, maxW) {
    return new Promise(res => {
      const s = Math.min(1, (maxW || 480) / canvas.width), o = document.createElement('canvas');
      o.width = Math.round(canvas.width * s); o.height = Math.round(canvas.height * s);
      o.getContext('2d').drawImage(canvas, 0, 0, o.width, o.height);
      o.toBlob(b => res(b), 'image/jpeg', 0.62);
    });
  }

  /* ---------- the pipeline ---------- */
  /** @returns {raw, rows, layout, thumbBlob}  raw -> SLIP.interpret(raw) */
  async function scan(blob, opt) {
    opt = opt || {}; const step = opt.onStep || (() => { });
    const wk = await ensure();
    step('s_prepare');
    const img = await loadImage(blob);
    const k = NORM_W / img.naturalWidth, w = NORM_W, h = Math.round(img.naturalHeight * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.imageSmoothingQuality = 'high'; cx.drawImage(img, 0, 0, w, h);
    const g = IMG.grayFromRGBA(cx.getImageData(0, 0, w, h).data, w, h);
    const b = IMG.binarize(g, w, h, 31, 10);

    step('s_layout');
    const xa = Math.round(w * 0.14), xb = Math.round(w * 0.70);
    const rows = IMG.segRows(b, w, h, xa, xb);
    const nb = IMG.findNoteBox(g, w, h, Math.round(h * 0.55));
    const L = SL.layout(rows, w, h, nb);
    const raw = { w, h, structureOk: L.ok, header: [], date: [], senderName: [], senderAcct: [], recipRows: [], recipAcct: [], amount: [], ref: [], note: [], qr: null };

    const jobs = [];                                     // {w:'th'|'num', canvas, push:(r)=>void}
    const addJob = (wname, c, scale, push, params) => jobs.push({ w: wname, canvas: toCanvas(c, scale), push, params });
    const pad = 8, X2 = Math.round(w * 0.02);

    if (L.ok) {
      const bandG = (r, x0, x1) => IMG.cropGray(g, w, x0, r.y0 - 5, x1, r.y1 + 5, pad);
      const bandB = (r, x0, x1) => IMG.cropBin(b, w, x0, r.y0 - 5, x1, r.y1 + 5, pad);
      const ext = (r, x0, x1) => { const e = IMG.inkExtent(b, w, r.y0, r.y1, x0, x1); return e ? [Math.max(0, e[0] - 6), Math.min(w - 1, e[1] + 6)] : [x0, x1]; };

      // header (what kind of slip)
      { const [a, z] = ext(L.header, X2, Math.round(w * 0.6)); addJob('th', bandG(L.header, a, z), scaleFor(L.header.y1 - L.header.y0), r => raw.header.push(r)); }
      // date + time: binarised crops were 20/20 vs 12/20 for plain grey in testing
      { const [a, z] = [X2, Math.round(w * 0.42)], sc = L.date;
        addJob('num', bandB(sc, a, z), 2.5, r => raw.date.push({ ...r, k: 'num' }));
        addJob('th', bandB(sc, a, z), 3.5, r => raw.date.push({ ...r, k: 'th' }));
        addJob('th', bandB(sc, a, z), 2.5, r => raw.date.push({ ...r, k: 'th' })); }
      // names
      { const [a, z] = ext(L.sender, xa, xb); addJob('th', bandG(L.sender, a, z), 2, r => raw.senderName.push(r)); }
      L.recip.forEach((rr, i) => {
        raw.recipRows[i] = [];
        const [a, z] = ext(rr, xa, xb);      // three differently-prepared reads; SLIP.pickName keeps the cleanest / most agreed one (a single read sometimes returns confident garbage)
        addJob('th', bandG(rr, a, z), 2, r => raw.recipRows[i].push({ ...r, v: 'G2' }));
        addJob('th', bandG(rr, a, z), 2.5, r => raw.recipRows[i].push({ ...r, v: 'G25' }));
        addJob('th', bandB(rr, a, z), 2.5, r => raw.recipRows[i].push({ ...r, v: 'B25' }));
      });
      // accounts (digits only engine)
      { const [a, z] = ext(L.senderAcct, xa, xb); addJob('num', bandB(L.senderAcct, a, z), 3, r => raw.senderAcct.push({ ...r, k: 'num' })); }
      { const [a, z] = ext(L.recipAcct, xa, xb); addJob('num', bandB(L.recipAcct, a, z), 3, r => raw.recipAcct.push({ ...r, k: 'num' })); }
      // amount: three independent reads
      { const [a, z] = ext(L.amount, X2, Math.round(w * 0.62)), am = L.amount;
        addJob('num', bandB(am, a, z), 2, r => raw.amount.push({ ...r, k: 'numB' }));
        addJob('num', bandG(am, a, z), 2, r => raw.amount.push({ ...r, k: 'numG' }));
        addJob('th', bandB(am, a, z), 2, r => raw.amount.push({ ...r, k: 'thB' })); }
      // transaction number (first ref row) — also a date cross-check
      if (L.refs[0]) { const rr = L.refs[0], [a, z] = ext(rr, X2, xb);
        addJob('th', bandB(rr, a, z), 2.5, r => raw.ref.push({ ...r, k: 'th' })); }
    } else {
      // unfamiliar layout: read every text row; interpret() searches all reads for date / amount
      rows.slice(0, 18).forEach(rr => {
        const [a, z] = [Math.max(0, Math.round(w * 0.02)), xb]; const sc = scaleFor(rr.y1 - rr.y0);
        const push = r => { const row = { ...r, h: rr.y1 - rr.y0 + 1 }; raw.date.push(row); raw.amount.push(row); raw.ref.push(row); raw.header.push(row); raw.recipRows[0] = raw.recipRows[0] || []; raw.recipRows[0].push(row); };
        addJob('th', IMG.cropBin(b, w, a, rr.y0 - 5, z, rr.y1 + 5, pad), sc, push);
        addJob('num', IMG.cropBin(b, w, a, rr.y0 - 5, z, rr.y1 + 5, pad), sc, push);
      });
    }
    // note (the white box)
    if (nb) {
      const ix0 = nb.x0 + 14, ix1 = Math.min(nb.x1 - 8, Math.round(w * 0.86)), iy0 = nb.y0 + 4, iy1 = nb.y1 - 4;
      if (ix1 - ix0 > 40 && iy1 - iy0 > 10) {
        const bb = IMG.binarize(g, w, h, 41, 12);
        addJob('th', IMG.cropGray(g, w, ix0, iy0, ix1, iy1, 10), 2.4, r => raw.note.push({ ...r, v: 'G' }));
        addJob('th', IMG.cropBin(bb, w, ix0, iy0, ix1, iy1, 10), 2.4, r => raw.note.push({ ...r, v: 'B' }));
        addJob('num', IMG.cropGray(g, w, ix0, iy0, ix1, iy1, 10), 2.4, r => raw.note.push({ ...r, v: 'eG' }), { tessedit_char_whitelist: '' });
        addJob('num', IMG.cropBin(bb, w, ix0, iy0, ix1, iy1, 10), 2.4, r => raw.note.push({ ...r, v: 'eB' }), { tessedit_char_whitelist: '' });
      }
    }

    // run the two workers in parallel (each worker processes its own queue sequentially)
    const total = jobs.length; let done = 0;
    step('s_date');
    const run = async name => {
      for (const j of jobs.filter(x => x.w === name)) {
        if (j.params) await wk[name].setParameters(j.params);
        j.push(await readCanvas(wk[name], j.canvas));
        if (j.params) await wk[name].setParameters({ tessedit_char_whitelist: name === 'num' ? NUM_WL : '' });
        done++; if (opt.onProgress) opt.onProgress(done / total);
      }
    };
    await Promise.all([run('th'), run('num')]);
    step('s_verify');
    try { raw.qr = await decodeQR(cv); } catch (_) { raw.qr = null; }
    const thumb = opt.thumb === false ? null : await makeThumb(cv, 480);
    return { raw, rows, layout: L, noteBox: nb, thumb };
  }

  const OCR = { ensure, terminate, scan, decodeQR, makeThumb, loadImage, setLangPath: p => { langPath = p; } };
  root.OCR = OCR;
})(typeof window !== 'undefined' ? window : globalThis);

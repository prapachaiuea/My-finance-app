/* FinFlow — pixel-level image helpers for slip reading. Pure functions on typed arrays (work in the browser and in Node tests). */
(function (root) {
  'use strict';

  function grayFromRGBA(d, w, h) {
    const g = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    return g;
  }

  /** Adaptive (local-mean) threshold. 1 = ink. Handles the colourful gradient backgrounds of bank slips,
   *  where a single global threshold loses the light-grey text. */
  function binarize(g, w, h, win, c) {
    const W1 = w + 1, I = new Float64Array(W1 * (h + 1));
    for (let y = 0; y < h; y++) { let s = 0; const row = (y + 1) * W1, prev = y * W1; for (let x = 0; x < w; x++) { s += g[y * w + x]; I[row + x + 1] = I[prev + x + 1] + s; } }
    const r = win >> 1, b = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
        const n = (x1 - x0 + 1) * (y1 - y0 + 1);
        const s = I[(y1 + 1) * W1 + x1 + 1] - I[y0 * W1 + x1 + 1] - I[(y1 + 1) * W1 + x0] + I[y0 * W1 + x0];
        b[y * w + x] = g[y * w + x] < s / n - c ? 1 : 0;
      }
    }
    return b;
  }

  /** Row segmentation by horizontal ink projection within [xa,xb). Splits rows that are really two stacked lines. */
  function segRows(b, w, h, xa, xb, opt) {
    opt = opt || {};
    const gapMax = opt.gap || 5, minH = opt.minH || 9, minInk = opt.minInk || 50;
    const cnt = new Int32Array(h);
    for (let y = 0; y < h; y++) { let s = 0; const o = y * w; for (let x = xa; x < xb; x++) s += b[o + x]; cnt[y] = s; }
    const rows = [];
    let y = 0;
    while (y < h) {
      if (cnt[y] >= 2) {
        const y0 = y; let ink = 0, gap = 0, yy = y;
        while (yy < h && gap <= gapMax) { if (cnt[yy] >= 2) { gap = 0; ink += cnt[yy]; } else gap++; yy++; }
        const y1 = yy - gap - 1;
        if (y1 - y0 + 1 >= minH && ink >= minInk) rows.push({ y0, y1, ink });
        y = yy;
      } else y++;
    }
    return rows;
  }

  /** x-extent of ink inside a y-band (tight crop). */
  function inkExtent(b, w, y0, y1, xa, xb) {
    let lo = xb, hi = xa;
    for (let y = y0; y <= y1; y++) { const o = y * w; for (let x = xa; x < xb; x++) if (b[o + x]) { if (x < lo) lo = x; if (x > hi) hi = x; } }
    return hi >= lo ? [lo, hi] : null;
  }

  /** Split a band into horizontal tokens separated by >= gap blank columns. */
  function colTokens(b, w, y0, y1, xa, xb, gap, minW) {
    const toks = []; let start = -1, blank = 0;
    for (let x = xa; x < xb; x++) {
      let any = 0; for (let y = y0; y <= y1; y++) if (b[y * w + x]) { any = 1; break; }
      if (any) { if (start < 0) start = x; blank = 0; }
      else if (start >= 0) { blank++; if (blank >= gap) { toks.push([start, x - blank]); start = -1; blank = 0; } }
    }
    if (start >= 0) toks.push([start, xb - 1 - blank]);
    return toks.filter(t => t[1] - t[0] + 1 >= (minW || 3));
  }

  /** Find the white "note" text box near the bottom of a KBank Make style slip.
   *  Returns {x0,y0,x1,y1} or null. Pure-white (>=252) rows covering at least half of the width. */
  function findNoteBox(g, w, h, yMin) {
    const xa = Math.round(w * 0.06), xb = Math.round(w * 0.94), need = (xb - xa) * 0.5;
    const isWhite = new Uint8Array(h);
    for (let y = Math.max(0, yMin || 0); y < h; y++) { let c = 0; const o = y * w; for (let x = xa; x < xb; x++) if (g[o + x] >= 252) c++; isWhite[y] = c >= need ? 1 : 0; }
    // longest-bottom run of white rows with a plausible height
    let best = null, y = h - 1;
    while (y >= 0) {
      if (isWhite[y]) { let y1 = y; while (y >= 0 && isWhite[y]) y--; const y0 = y + 1; const hh = y1 - y0 + 1; if (hh >= Math.round(w * 0.045) && hh <= Math.round(w * 0.14)) { best = { y0, y1 }; break; } }
      else y--;
    }
    if (!best) return null;
    // box edges: walk outwards along a line near the TOP of the box (text-free), not the middle line
    const o = (best.y0 + Math.max(3, Math.round((best.y1 - best.y0) * 0.12))) * w;
    let x = Math.round(w / 2); while (x > 0 && g[o + x] >= 240) x--; const x0 = x + 1;
    x = Math.round(w / 2); while (x < w - 1 && g[o + x] >= 240) x++; const x1 = x - 1;
    return { x0: Math.max(0, x0), y0: best.y0, x1: Math.min(w - 1, x1), y1: best.y1 };
  }

  /** Robust black-on-white crop (percentile stretch) returned as {data,w,h} grayscale, with `pad` px of white border. */
  function cropGray(g, w, x0, y0, x1, y1, pad) {
    pad = pad || 0;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, hist = new Int32Array(256);
    for (let y = 0; y < ch; y++) { const o = (y0 + y) * w + x0; for (let x = 0; x < cw; x++) hist[g[o + x]]++; }
    const tot = cw * ch; let a = 0, lo = 0, hi = 255, gotLo = false;
    for (let i = 0; i < 256; i++) { a += hist[i]; if (!gotLo && a >= tot * 0.01) { lo = i; gotLo = true; } if (a >= tot * 0.995) { hi = i; break; } }
    const span = Math.max(24, hi - lo), W = cw + pad * 2, H = ch + pad * 2, out = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < ch; y++) { const o = (y0 + y) * w + x0, p = (y + pad) * W + pad; for (let x = 0; x < cw; x++) { let v = (g[o + x] - lo) / span; v = v < 0 ? 0 : v > 1 ? 1 : v; out[p + x] = v * 255; } }
    return { data: out, w: W, h: H };
  }
  /** Crop of a binary ink mask, rendered black-on-white. */
  function cropBin(b, w, x0, y0, x1, y1, pad) {
    pad = pad || 0;
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1, W = cw + pad * 2, H = ch + pad * 2, out = new Uint8Array(W * H).fill(255);
    for (let y = 0; y < ch; y++) { const o = (y0 + y) * w + x0, p = (y + pad) * W + pad; for (let x = 0; x < cw; x++) if (b[o + x]) out[p + x] = 0; }
    return { data: out, w: W, h: H };
  }

  const P = { grayFromRGBA, binarize, segRows, inkExtent, colTokens, findNoteBox, cropGray, cropBin };
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  root.IMG = P;
})(typeof window !== 'undefined' ? window : globalThis);

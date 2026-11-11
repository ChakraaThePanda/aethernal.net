// Finds where the character stands inside a Blizzard render, so the WoW page can size and place every
// race the same way (a Tauren fills far more of its picture than a Gnome). The picture itself is never
// cropped; the card only uses these numbers to scale and position it.
//
// Renders ("main-raw") are 8-bit RGBA PNGs with a transparent background. This decodes one with plain
// Node (no image library) and returns fractions of the image size:
//   top, height  the figure's top edge and height
//   bodyW        width of its upper body (top 30%), so a weapon held out to the side doesn't count
//   centerX      middle of that upper body
//   headL/headR  left and right edges of the head (top 14%, horns and hair included)
//   headB        bottom of that head band
// Returns null for anything it can't read, and the card falls back to typical values.

import { inflateSync } from 'node:zlib';

const SOLID = 24; // alpha above this counts as part of the character (skips faint glow and shadow)

export function figureBox(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  let p = 8, w, h, bitDepth, colorType, interlace;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    }
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) return null;

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride);
  const rows = []; // per row: [first, last] solid x, or [-1, -1]
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 255;
    }
    let rx0 = -1, rx1 = -1;
    for (let x = 0; x < w; x++) {
      if (cur[x * 4 + 3] > SOLID) {
        if (rx0 < 0) rx0 = x;
        rx1 = x;
      }
    }
    if (rx0 >= 0) {
      x0 = Math.min(x0, rx0); x1 = Math.max(x1, rx1);
      if (y < y0) y0 = y;
      y1 = y;
    }
    rows.push([rx0, rx1]);
    cur.copy(prev);
  }
  if (x1 < 0) return null;

  const band = (share) => {
    let l = w, r = -1;
    for (let y = y0; y <= y0 + (y1 - y0) * share; y++) {
      const [a, b] = rows[y];
      if (a >= 0) { l = Math.min(l, a); r = Math.max(r, b); }
    }
    return [l, r + 1];
  };
  const [bodyL, bodyR] = band(0.3);
  const [headL, headR] = band(0.14);
  const r = (n) => Math.round(n * 10000) / 10000;
  return {
    top: r(y0 / h),
    height: r((y1 + 1 - y0) / h),
    bodyW: r((bodyR - bodyL) / w),
    centerX: r((bodyL + bodyR) / 2 / w),
    headL: r(headL / w),
    headR: r(headR / w),
    headB: r((y0 + (y1 - y0) * 0.14) / h),
  };
}

export async function measureRender(url) {
  if (!url?.endsWith('.png')) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) }); // a stalled download mustn't hang the deploy
  if (!res.ok) return null;
  return figureBox(Buffer.from(await res.arrayBuffer()));
}

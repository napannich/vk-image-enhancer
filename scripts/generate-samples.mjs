#!/usr/bin/env node
/**
 * Synthetic test image generator.
 *
 * Produces three 512x384 PNG samples in docs/samples/ with known, verifiable
 * characteristics, so the ML regressor behaviour is reproducible offline:
 *
 *   1. underexposed.png  — histogram compressed to [0, 120]   → needs +brightness, stretch
 *   2. low-contrast.png  — histogram compressed to [80, 180]  → needs auto-levels
 *   3. desaturated.png   — grayscale-ish gradient             → needs +saturation
 *
 * Only Node built-ins + zlib used; no external deps.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'docs', 'samples');
mkdirSync(OUT_DIR, { recursive: true });

const W = 512, H = 384;

function crc32(buf) {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(path, rgba, w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // no filter
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4;
      raw[p++] = rgba[si];
      raw[p++] = rgba[si + 1];
      raw[p++] = rgba[si + 2];
      raw[p++] = rgba[si + 3];
    }
  }
  const idat = deflateSync(raw);
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(path, png);
}

function makeBuffer() {
  return new Uint8ClampedArray(W * H * 4);
}

/** Simple checkerboard of soft gradient circles to make a realistic-ish scene. */
function basePattern(mult = 1, bias = 0, satMult = 1) {
  const buf = makeBuffer();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x / W, fy = y / H;
      const r = 0.5 + 0.4 * Math.sin(fx * 8 + fy * 3);
      const g = 0.5 + 0.4 * Math.sin(fx * 5 + fy * 6 + 1.5);
      const b = 0.5 + 0.4 * Math.sin(fx * 3 + fy * 9 + 3.0);
      // Colour gradient overlay
      const tint = [0.8 - 0.3 * fy, 0.5 + 0.2 * fx, 0.4 + 0.3 * fy];
      let R = (r * 0.6 + tint[0] * 0.4);
      let G = (g * 0.6 + tint[1] * 0.4);
      let B = (b * 0.6 + tint[2] * 0.4);
      // Desaturate to given multiplier
      const gray = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      R = gray + (R - gray) * satMult;
      G = gray + (G - gray) * satMult;
      B = gray + (B - gray) * satMult;
      // Apply brightness/contrast mult+bias
      R = R * mult + bias;
      G = G * mult + bias;
      B = B * mult + bias;
      const i = (y * W + x) * 4;
      buf[i]     = Math.max(0, Math.min(255, Math.round(R * 255)));
      buf[i + 1] = Math.max(0, Math.min(255, Math.round(G * 255)));
      buf[i + 2] = Math.max(0, Math.min(255, Math.round(B * 255)));
      buf[i + 3] = 255;
    }
  }
  return buf;
}

// 1. Underexposed: overall dark, narrow dynamic range around 0..0.47
writePng(resolve(OUT_DIR, 'underexposed.png'), basePattern(0.47, 0, 1.0), W, H);

// 2. Low-contrast: compressed into middle band 0.31..0.71
writePng(resolve(OUT_DIR, 'low-contrast.png'), basePattern(0.40, 0.31, 1.0), W, H);

// 3. Desaturated: near-greyscale
writePng(resolve(OUT_DIR, 'desaturated.png'), basePattern(1.0, 0, 0.18), W, H);

console.log('Generated 3 samples in', OUT_DIR);

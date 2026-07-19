/**
 * dither.js
 * Grayscale -> 1-bit dithering algorithms.
 * Each function takes a Float32Array `gray` (w*h, values 0-255) and returns
 * a new Uint8ClampedArray (w*h, values are only 0 or 255).
 */

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function ditherThreshold(gray, w, h, bias = 0) {
  const out = new Uint8ClampedArray(w * h);
  const t = 127.5 - bias * 60;
  for (let i = 0; i < gray.length; i++) out[i] = gray[i] < t ? 0 : 255;
  return out;
}

function ditherFloydSteinberg(gray, w, h, bias = 0) {
  const buf = Float32Array.from(gray);
  const out = new Uint8ClampedArray(w * h);
  const t = 127.5 - bias * 60;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = buf[i];
      const nw = old < t ? 0 : 255;
      out[i] = nw;
      const err = old - nw;
      if (x + 1 < w) buf[i + 1] += err * (7 / 16);
      if (y + 1 < h) {
        if (x > 0) buf[i + w - 1] += err * (3 / 16);
        buf[i + w] += err * (5 / 16);
        if (x + 1 < w) buf[i + w + 1] += err * (1 / 16);
      }
    }
  }
  return out;
}

function ditherAtkinson(gray, w, h, bias = 0) {
  const buf = Float32Array.from(gray);
  const out = new Uint8ClampedArray(w * h);
  const t = 127.5 - bias * 60;
  const push = (arr, x, y, amt) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    arr[y * w + x] += amt;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = buf[i];
      const nw = old < t ? 0 : 255;
      out[i] = nw;
      const err = (old - nw) / 8;
      push(buf, x + 1, y, err);
      push(buf, x + 2, y, err);
      push(buf, x - 1, y + 1, err);
      push(buf, x, y + 1, err);
      push(buf, x + 1, y + 1, err);
      push(buf, x, y + 2, err);
    }
  }
  return out;
}

// 8x8 Bayer ordered-dither matrix, normalized 0-63.
const BAYER_8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

function ditherOrdered(gray, w, h, bias = 0) {
  const out = new Uint8ClampedArray(w * h);
  const biasOffset = bias * 60;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = (BAYER_8[(y % 8) * 8 + (x % 8)] / 64) * 255 - 127.5;
      const v = clamp255(gray[i] + biasOffset);
      out[i] = v + m * 0.5 < 127.5 ? 0 : 255;
    }
  }
  return out;
}

const DITHER_ALGORITHMS = {
  none: { name: "Disabled (threshold)", fn: ditherThreshold },
  floyd: { name: "Floyd–Steinberg", fn: ditherFloydSteinberg },
  atkinson: { name: "Atkinson", fn: ditherAtkinson },
  ordered: { name: "Ordered (Bayer 8×8)", fn: ditherOrdered },
};

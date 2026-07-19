/**
 * imaging.js
 * Core pipeline: source image -> resized canvas -> tone-adjusted grayscale
 * -> dithered 1-bit result. Pure canvas/JS, no external dependencies.
 */

const UNIT_TO_INCH = { in: 1, mm: 1 / 25.4 };

/** Compute target pixel dimensions from physical size + DPI. */
function computePixelSize(widthVal, heightVal, unit, dpi) {
  const inchPerUnit = UNIT_TO_INCH[unit] || 1;
  const wIn = widthVal * inchPerUnit;
  const hIn = heightVal * inchPerUnit;
  return {
    w: Math.max(1, Math.round(wIn * dpi)),
    h: Math.max(1, Math.round(hIn * dpi)),
  };
}

/** Scale a source pixel size so its longer side equals targetLongSide px, keeping aspect ratio. */
function computeBatchPixelSize(srcW, srcH, targetLongSide) {
  if (srcW >= srcH) {
    const w = targetLongSide;
    const h = Math.max(1, Math.round((srcH / srcW) * targetLongSide));
    return { w, h };
  } else {
    const h = targetLongSide;
    const w = Math.max(1, Math.round((srcW / srcH) * targetLongSide));
    return { w, h };
  }
}

/** Draw `img` scaled into a new canvas of w x h. */
function resizeToCanvas(img, w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** Convert canvas RGBA -> Float32Array grayscale (0-255), applying material tone curve. */
function toToneAdjustedGray(canvas, material) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);

  const brightness = material.brightness * 255;
  const contrast = material.contrast; // -1..1
  const contrastFactor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  const gamma = material.gamma || 1;

  for (let p = 0, i = 0; p < data.length; p += 4, i++) {
    // Perceptual luminance
    let v = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    // Brightness
    v += brightness;
    // Contrast (around midpoint)
    v = contrastFactor * (v - 127.5) + 127.5;
    // Gamma (normalize to 0-1, apply, back to 0-255)
    let n = clampUnit(v / 255);
    n = Math.pow(n, 1 / gamma);
    v = n * 255;
    if (material.invert) v = 255 - v;
    gray[i] = clampUnit255(v);
  }
  return gray;
}

function clampUnit(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function clampUnit255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Full pipeline for one image: returns { width, height, grayCanvas, ditheredCanvas }
 * grayCanvas = continuous-tone preview (what "no dithering" mode ships)
 * ditheredCanvas = 1-bit black/white result
 */
function processImage(img, opts) {
  const { pixelW, pixelH, materialKey, ditherKey, ditherEnabled } = opts;
  const material = MATERIALS[materialKey];
  const resized = resizeToCanvas(img, pixelW, pixelH);
  const gray = toToneAdjustedGray(resized, material);

  // Continuous-tone grayscale canvas (used when dithering is disabled, and for preview blending)
  const grayCanvas = document.createElement("canvas");
  grayCanvas.width = pixelW;
  grayCanvas.height = pixelH;
  {
    const gctx = grayCanvas.getContext("2d");
    const imgData = gctx.createImageData(pixelW, pixelH);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      const v = gray[i];
      imgData.data[p] = v;
      imgData.data[p + 1] = v;
      imgData.data[p + 2] = v;
      imgData.data[p + 3] = 255;
    }
    gctx.putImageData(imgData, 0, 0);
  }

  let finalCanvas = grayCanvas;
  if (ditherEnabled) {
    const algo = DITHER_ALGORITHMS[ditherKey] || DITHER_ALGORITHMS.floyd;
    const bits = algo.fn(gray, pixelW, pixelH, material.ditherBias);
    const ditherCanvas = document.createElement("canvas");
    ditherCanvas.width = pixelW;
    ditherCanvas.height = pixelH;
    const dctx = ditherCanvas.getContext("2d");
    const imgData = dctx.createImageData(pixelW, pixelH);
    for (let i = 0, p = 0; i < bits.length; i++, p += 4) {
      const v = bits[i];
      imgData.data[p] = v;
      imgData.data[p + 1] = v;
      imgData.data[p + 2] = v;
      imgData.data[p + 3] = 255;
    }
    dctx.putImageData(imgData, 0, 0);
    finalCanvas = ditherCanvas;
  }

  return { width: pixelW, height: pixelH, grayCanvas, finalCanvas };
}

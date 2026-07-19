/**
 * export.js
 * Encoders for the four download formats offered by the app.
 * PNG uses the browser's native encoder; BMP is hand-rolled (browsers don't
 * expose a BMP encoder); LightBurn .lbrn2 is a best-effort minimal project
 * file — LightBurn's schema isn't fully published, so treat this as a
 * starting point and confirm it imports cleanly on your LightBurn version.
 */

function canvasToPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Encode a canvas as a 24-bit uncompressed BMP. Returns a Blob. */
function canvasToBmp24Blob(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, w, h);

  const rowSize = Math.floor((24 * w + 31) / 32) * 4; // padded to 4 bytes
  const pixelArraySize = rowSize * h;
  const fileSize = 14 + 40 + pixelArraySize;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  let o = 0;

  // BITMAPFILEHEADER
  view.setUint8(o++, 0x42); // 'B'
  view.setUint8(o++, 0x4d); // 'M'
  view.setUint32(o, fileSize, true); o += 4;
  view.setUint32(o, 0, true); o += 4; // reserved
  view.setUint32(o, 14 + 40, true); o += 4; // pixel data offset

  // BITMAPINFOHEADER
  view.setUint32(o, 40, true); o += 4; // header size
  view.setInt32(o, w, true); o += 4;
  view.setInt32(o, h, true); o += 4; // positive = bottom-up
  view.setUint16(o, 1, true); o += 2; // planes
  view.setUint16(o, 24, true); o += 2; // bit count
  view.setUint32(o, 0, true); o += 4; // BI_RGB, no compression
  view.setUint32(o, pixelArraySize, true); o += 4;
  view.setInt32(o, 2835, true); o += 4; // ~72 DPI in px/m (informational)
  view.setInt32(o, 2835, true); o += 4;
  view.setUint32(o, 0, true); o += 4; // colors used
  view.setUint32(o, 0, true); o += 4; // important colors

  // Pixel data: bottom-up rows, BGR, row-padded to 4 bytes
  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y; // flip vertically
    const rowStart = 14 + 40 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const sp = (srcY * w + x) * 4;
      const dp = rowStart + x * 3;
      view.setUint8(dp, data[sp + 2]);     // B
      view.setUint8(dp + 1, data[sp + 1]); // G
      view.setUint8(dp + 2, data[sp]);     // R
    }
    // remaining bytes in row are already zero (ArrayBuffer is zero-initialized)
  }

  return new Blob([buf], { type: "image/bmp" });
}

/** Encode a canvas as a 1-bit (black/white) BMP using a 50% threshold on R channel. Returns a Blob. */
function canvasToBmp1Blob(canvas) {
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, w, h);

  const rowSize = Math.floor((1 * w + 31) / 32) * 4; // bytes per row, padded to 4
  const paletteSize = 2 * 4; // 2 colors x 4 bytes (BGRA)
  const pixelArraySize = rowSize * h;
  const dataOffset = 14 + 40 + paletteSize;
  const fileSize = dataOffset + pixelArraySize;

  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  let o = 0;

  view.setUint8(o++, 0x42);
  view.setUint8(o++, 0x4d);
  view.setUint32(o, fileSize, true); o += 4;
  view.setUint32(o, 0, true); o += 4;
  view.setUint32(o, dataOffset, true); o += 4;

  view.setUint32(o, 40, true); o += 4;
  view.setInt32(o, w, true); o += 4;
  view.setInt32(o, h, true); o += 4;
  view.setUint16(o, 1, true); o += 2;
  view.setUint16(o, 1, true); o += 2; // 1 bit per pixel
  view.setUint32(o, 0, true); o += 4;
  view.setUint32(o, pixelArraySize, true); o += 4;
  view.setInt32(o, 2835, true); o += 4;
  view.setInt32(o, 2835, true); o += 4;
  view.setUint32(o, 2, true); o += 4; // colors used
  view.setUint32(o, 2, true); o += 4; // important colors

  // Palette: index 0 = black, index 1 = white
  view.setUint8(o++, 0); view.setUint8(o++, 0); view.setUint8(o++, 0); view.setUint8(o++, 0);
  view.setUint8(o++, 255); view.setUint8(o++, 255); view.setUint8(o++, 255); view.setUint8(o++, 0);

  for (let y = 0; y < h; y++) {
    const srcY = h - 1 - y;
    const rowStart = dataOffset + y * rowSize;
    for (let x = 0; x < w; x++) {
      const sp = (srcY * w + x) * 4;
      const bit = data[sp] >= 128 ? 1 : 0; // image is already 1-bit black/white from dithering
      if (bit) {
        const byteIndex = rowStart + (x >> 3);
        const bitIndex = 7 - (x & 7);
        view.setUint8(byteIndex, view.getUint8(byteIndex) | (1 << bitIndex));
      }
    }
  }

  return new Blob([buf], { type: "image/bmp" });
}

/** Build a minimal LightBurn .lbrn2 project embedding the image as a bitmap shape. */
async function canvasToLbrn2Blob(canvas, opts) {
  const { widthMm, heightMm, laser } = opts;
  const pngBlob = await canvasToPngBlob(canvas);
  const b64 = await blobToBase64(pngBlob);

  const speed = laser.speed;
  const minPower = laser.powerMin;
  const maxPower = laser.powerMax;
  const freqAttr = laser.hasFrequency && laser.frequency ? ` Frequency="${laser.frequency}"` : "";
  const qAttr = laser.hasQPulse && laser.qPulse ? ` QPulseWidth="${laser.qPulse}"` : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<LightBurnProject AppVersion="1.2.00" FormatVersion="1" MaterialHeight="0" MirrorX="False" MirrorY="False">
  <VariableText>
    <Start Value="1"/>
    <End Value="1"/>
    <Current Value="1"/>
  </VariableText>
  <CutSetting type="Image">
    <index Value="0"/>
    <name Value="imagR-OSS Engrave"/>
    <minPower Value="${minPower}"/>
    <maxPower Value="${maxPower}"/>
    <speed Value="${speed}"/>
    <priority Value="0"/>
    <numPasses Value="1"/>${freqAttr ? `\n    <frequency Value="${laser.frequency}"/>` : ""}${qAttr ? `\n    <qPulseWidth Value="${laser.qPulse}"/>` : ""}
  </CutSetting>
  <Shape Type="Bitmap" CutIndex="0" W="${widthMm}" H="${heightMm}">
    <XForm>1 0 0 1 0 0</XForm>
    <Bitmap Source="Data" Data="${b64}"/>
  </Shape>
</LightBurnProject>
`;
  return new Blob([xml], { type: "application/xml" });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

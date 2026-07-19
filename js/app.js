/**
 * app.js — UI glue. Everything here runs client-side; no image data is
 * ever sent anywhere.
 */
(function () {
  "use strict";

  const state = {
    mode: "single",
    materialKey: "wood",
    singleFile: null,
    singleImg: null,
    batchFiles: [], // { file, img, name }
    lastResult: null, // { canvas, pixelW, pixelH, widthMm, heightMm }
    batchResults: [], // per-file results after processing
  };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const dropzone = $("dropzone");
  const fileInput = $("fileInput");
  const fileInputBatch = $("fileInputBatch");
  const batchList = $("batchList");
  const materialShelf = $("materialShelf");
  const materialNote = $("materialNote");
  const dimsRow = $("dimsRow");
  const batchDimsRow = $("batchDimsRow");
  const widthIn = $("widthIn");
  const heightIn = $("heightIn");
  const unitSel = $("unitSel");
  const longSideIn = $("longSideIn");
  const unitSelBatch = $("unitSelBatch");
  const dpiIn = $("dpiIn");
  const ditherSel = $("ditherSel");
  const ditherDisable = $("ditherDisable");
  const laserSel = $("laserSel");
  const speedIn = $("speedIn");
  const powerMinIn = $("powerMinIn");
  const powerMaxIn = $("powerMaxIn");
  const freqIn = $("freqIn");
  const qIn = $("qIn");
  const freqField = $("freqField");
  const qField = $("qField");
  const processBtn = $("processBtn");
  const previewStage = $("previewStage");
  const compareWrap = $("compareWrap");
  const beforeImg = $("beforeImg");
  const afterImg = $("afterImg");
  const beforeClip = $("beforeClip");
  const compareHandle = $("compareHandle");
  const laserHead = $("laserHead");
  const exportPanel = $("exportPanel");
  const downloadAllBtn = $("downloadAllBtn");

  // ---------- Material shelf ----------
  function renderMaterialShelf() {
    materialShelf.innerHTML = "";
    MATERIAL_ORDER.forEach((key) => {
      const m = MATERIALS[key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "material-chip" + (key === state.materialKey ? " selected" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", key === state.materialKey);
      btn.innerHTML = `<div class="swatch" style="background:${m.swatch}"></div><div class="label">${m.name}</div>`;
      btn.addEventListener("click", () => {
        state.materialKey = key;
        renderMaterialShelf();
        materialNote.textContent = m.note;
        syncLaserDefaults();
      });
      materialShelf.appendChild(btn);
    });
    materialNote.textContent = MATERIALS[state.materialKey].note;
  }
  renderMaterialShelf();

  // ---------- Mode toggle ----------
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mode-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      state.mode = btn.dataset.mode;
      const isBatch = state.mode === "batch";
      dimsRow.hidden = isBatch;
      batchDimsRow.hidden = !isBatch;
      batchList.hidden = !isBatch;
      dropzone.querySelector(".dz-text").innerHTML = isBatch
        ? "<strong>Drop your images here</strong><br/>or click to browse"
        : "<strong>Drop your image here</strong><br/>or click to browse";
      updateProcessEnabled();
    });
  });

  // ---------- Dropzone / file handling ----------
  dropzone.addEventListener("click", () => {
    (state.mode === "batch" ? fileInputBatch : fileInput).click();
  });
  dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dropzone.click(); }
  });
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("drag-over"); })
  );
  dropzone.addEventListener("drop", (e) => {
    const files = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    if (state.mode === "batch") handleBatchFiles(files);
    else handleSingleFile(files[0]);
  });
  fileInput.addEventListener("change", (e) => {
    if (e.target.files[0]) handleSingleFile(e.target.files[0]);
  });
  fileInputBatch.addEventListener("change", (e) => {
    if (e.target.files.length) handleBatchFiles(Array.from(e.target.files));
  });

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleSingleFile(file) {
    state.singleFile = file;
    state.singleImg = await loadImage(file);
    updateProcessEnabled();
  }

  async function handleBatchFiles(files) {
    state.batchFiles = [];
    batchList.innerHTML = "";
    for (const file of files) {
      const img = await loadImage(file);
      state.batchFiles.push({ file, img, name: file.name });
      const li = document.createElement("li");
      li.textContent = file.name;
      batchList.appendChild(li);
    }
    updateProcessEnabled();
  }

  function updateProcessEnabled() {
    if (state.mode === "single") {
      processBtn.disabled = !state.singleImg;
    } else {
      processBtn.disabled = state.batchFiles.length === 0;
    }
  }

  // ---------- Laser preset sync ----------
  function syncLaserDefaults() {
    const d = getLaserDefaults(laserSel.value, state.materialKey);
    speedIn.value = d.speed;
    powerMinIn.value = d.powerMin;
    powerMaxIn.value = d.powerMax;
    freqField.style.display = d.hasFrequency ? "" : "none";
    qField.style.display = d.hasQPulse ? "" : "none";
    if (d.hasFrequency) freqIn.value = d.frequency;
    if (d.hasQPulse) qIn.value = d.qPulse;
  }
  laserSel.addEventListener("change", syncLaserDefaults);
  syncLaserDefaults();

  ditherDisable.addEventListener("change", () => {
    ditherSel.disabled = ditherDisable.checked;
  });

  // ---------- Processing ----------
  processBtn.addEventListener("click", async () => {
    if (state.mode === "single") await processSingle();
    else await processBatch();
  });

  function currentLaserOpts() {
    return {
      speed: Number(speedIn.value) || 0,
      powerMin: Number(powerMinIn.value) || 0,
      powerMax: Number(powerMaxIn.value) || 0,
      frequency: freqField.style.display !== "none" ? Number(freqIn.value) || null : null,
      qPulse: qField.style.display !== "none" ? Number(qIn.value) || null : null,
      hasFrequency: freqField.style.display !== "none",
      hasQPulse: qField.style.display !== "none",
    };
  }

  function setBusy(isBusy) {
    processBtn.disabled = isBusy;
    processBtn.querySelector(".btn-label").textContent = isBusy ? "Processing…" : "Prepare image";
    processBtn.querySelector(".btn-spinner").hidden = !isBusy;
  }

  async function processSingle() {
    setBusy(true);
    await nextFrame();
    try {
      const img = state.singleImg;
      const dpi = Number(dpiIn.value) || 254;
      const { w, h } = computePixelSize(Number(widthIn.value), Number(heightIn.value), unitSel.value, dpi);
      const result = processImage(img, {
        pixelW: w,
        pixelH: h,
        materialKey: state.materialKey,
        ditherKey: ditherSel.value,
        ditherEnabled: !ditherDisable.checked,
      });

      const widthMm = unitSel.value === "mm" ? Number(widthIn.value) : Number(widthIn.value) * 25.4;
      const heightMm = unitSel.value === "mm" ? Number(heightIn.value) : Number(heightIn.value) * 25.4;

      state.lastResult = { canvas: result.finalCanvas, widthMm, heightMm };

      beforeImg.src = img.src;
      afterImg.src = result.finalCanvas.toDataURL("image/png");
      compareWrap.hidden = false;
      previewStage.querySelector(".preview-empty").style.display = "none";
      exportPanel.hidden = false;
      downloadAllBtn.hidden = true;

      laserHead.classList.remove("sweeping");
      void laserHead.offsetWidth; // restart animation
      laserHead.classList.add("sweeping");
    } finally {
      setBusy(false);
    }
  }

  async function processBatch() {
    setBusy(true);
    await nextFrame();
    try {
      const dpi = Number(dpiIn.value) || 254;
      const longSidePx = (() => {
        const inchPerUnit = unitSelBatch.value === "mm" ? 1 / 25.4 : 1;
        return Math.round(Number(longSideIn.value) * inchPerUnit * dpi);
      })();

      state.batchResults = [];
      const items = batchList.querySelectorAll("li");
      for (let i = 0; i < state.batchFiles.length; i++) {
        const { img, name } = state.batchFiles[i];
        const { w, h } = computeBatchPixelSize(img.naturalWidth, img.naturalHeight, longSidePx);
        const result = processImage(img, {
          pixelW: w,
          pixelH: h,
          materialKey: state.materialKey,
          ditherKey: ditherSel.value,
          ditherEnabled: !ditherDisable.checked,
        });
        state.batchResults.push({ name, canvas: result.finalCanvas });
        if (items[i]) items[i].classList.add("done");
        await nextFrame();
      }

      // Show the last processed image in the preview area.
      const last = state.batchResults[state.batchResults.length - 1];
      if (last) {
        beforeImg.src = state.batchFiles[state.batchFiles.length - 1].img.src;
        afterImg.src = last.canvas.toDataURL("image/png");
        compareWrap.hidden = false;
        previewStage.querySelector(".preview-empty").style.display = "none";
      }
      exportPanel.hidden = false;
      downloadAllBtn.hidden = false;
    } finally {
      setBusy(false);
    }
  }

  function nextFrame() {
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  // ---------- Compare slider ----------
  let dragging = false;
  compareWrap.addEventListener("pointerdown", (e) => { dragging = true; moveHandle(e); });
  window.addEventListener("pointermove", (e) => { if (dragging) moveHandle(e); });
  window.addEventListener("pointerup", () => (dragging = false));
  function moveHandle(e) {
    const rect = compareWrap.getBoundingClientRect();
    let pct = ((e.clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    beforeClip.style.width = pct + "%";
    compareHandle.style.left = pct + "%";
  }

  // ---------- Export ----------
  document.querySelectorAll(".export-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!state.lastResult) return;
      const fmt = btn.dataset.fmt;
      const { canvas, widthMm, heightMm } = state.lastResult;
      const base = (state.singleFile ? state.singleFile.name.replace(/\.[^.]+$/, "") : "engraving") + "-" + state.materialKey;

      if (fmt === "png") {
        const blob = await canvasToPngBlob(canvas);
        downloadBlob(blob, `${base}.png`);
      } else if (fmt === "bmp24") {
        downloadBlob(canvasToBmp24Blob(canvas), `${base}-24bit.bmp`);
      } else if (fmt === "bmp1") {
        downloadBlob(canvasToBmp1Blob(canvas), `${base}-1bit.bmp`);
      } else if (fmt === "lbrn2") {
        const laser = currentLaserOpts();
        const blob = await canvasToLbrn2Blob(canvas, { widthMm, heightMm, laser });
        downloadBlob(blob, `${base}.lbrn2`);
      }
    });
  });

  downloadAllBtn.addEventListener("click", async () => {
    for (const { name, canvas } of state.batchResults) {
      const blob = await canvasToPngBlob(canvas);
      const base = name.replace(/\.[^.]+$/, "");
      downloadBlob(blob, `${base}-${state.materialKey}.png`);
      await new Promise((r) => setTimeout(r, 250)); // avoid browser download throttling
    }
  });
})();

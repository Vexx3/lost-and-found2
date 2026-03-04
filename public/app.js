"use strict";

/*
==========================================================================
  App Data & Logic Controller (Client-side)
  Architecture Pattern: Modular / Functional
  Dependencies: utils.js, localdb.js
  
  Modules breakdown:
  1. UI Utilities (Toasts, Routing)
  2. Registration Module
  3. Scanner / Reporting Module
  4. User Dashboard (My Items)
  5. Lost List & Claim Flow
==========================================================================
*/

// ==========================================
// 1. UI UTILITIES
// ==========================================

// Toast notification helper (replaces intrusive alert() calls)
function showToast(message, type = "info") {
  // type: "success" | "error" | "info"
  const existing = document.querySelectorAll(".toast-notification");
  existing.forEach((t) => t.remove());
  const toast = document.createElement("div");
  toast.className = "toast-notification toast-" + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  // Trigger animation
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// Simple router to set active panel by hash
function setActivePanel() {
  const hash = window.location.hash || "#home";
  document
    .querySelectorAll(".panel")
    .forEach((el) => el.classList.remove("active"));
  try {
    const target = document.querySelector(hash);
    if (target) {
      target.classList.add("active");
    } else {
      document.querySelector("#home").classList.add("active");
    }
  } catch (e) {
    document.querySelector("#home").classList.add("active");
  }
  if (hash === "#lost") loadLostItems();
  if (hash !== "#scan" && typeof window.stopScanCamera === "function") {
    try { window.stopScanCamera(); } catch { }
  }
  if (hash !== "#scan" && typeof window.stopFoundCamera === "function") {
    try { window.stopFoundCamera(); } catch { }
  }
  if (hash !== "#register" && typeof window.stopRegCamera === "function") {
    try { window.stopRegCamera(); } catch { }
  }
  // Highlight active nav link
  document.querySelectorAll(".topbar nav a").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href === hash || (href.includes("#") && href.endsWith(hash))) {
      a.classList.add("active-link");
    } else {
      a.classList.remove("active-link");
    }
  });
  // Close mobile nav on navigation
  const nav = document.getElementById("mainNav");
  if (nav) nav.classList.remove("open");
}
window.addEventListener("hashchange", setActivePanel);
document.addEventListener("DOMContentLoaded", async () => {
  setActivePanel();
  hideFoundForm(); // hidden until QR is scanned
  bindRegister();
  bindMyItems();
  bindScan();
  // Hamburger menu toggle
  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("mainNav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }
});

// ==========================================
// 2. REGISTRATION MODULE
// ==========================================

// Register & Generate QR
function bindRegister() {
  const form = document.getElementById("registerForm");
  if (!form) return;
  const fileInput = document.getElementById("itemPhoto");
  const previewImg = document.getElementById("regPreview");
  const openCamBtn = document.getElementById("regOpenCam");
  const camPanel = document.getElementById("regCamPanel");
  const stopCamBtn = document.getElementById("regStopCam");
  const captureBtn = document.getElementById("regCapture");
  const clearBtn = document.getElementById("regClearPhoto");
  const videoWrap = document.getElementById("regVideoWrap");
  const quickActions = document.getElementById("regQuickActions");
  const catSelect = document.getElementById("itemCategory");

  let regMediaStream = null;
  let regCapturedDataUrl = null;

  function showPreview(src) {
    if (!previewImg) return;
    if (src) {
      previewImg.src = src;
      previewImg.style.display = "block";
    } else {
      previewImg.removeAttribute("src");
      previewImg.style.display = "none";
    }
  }

  // Start camera for Register capture (mirrored preview)
  async function startRegCamera() {
    try {
      if (regMediaStream) return; // already started
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.style.width = "320px";
      video.style.height = "240px";
      video.style.transform = "scaleX(-1)";
      videoWrap.innerHTML = "";
      videoWrap.appendChild(video);
      regMediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = regMediaStream;
      await video.play();
    } catch (e) {
      console.error("Register camera error", e);
      showToast(
        "Unable to access camera. Please allow permission or use file upload.",
        "error"
      );
    }
  }

  // Stop Register camera stream and clear preview
  function stopRegCamera() {
    if (regMediaStream) {
      regMediaStream.getTracks().forEach((t) => t.stop());
      regMediaStream = null;
    }
    if (videoWrap) videoWrap.innerHTML = "";
  }

  window.stopRegCamera = stopRegCamera;

  // Toggle Register camera panel visibility
  function toggleCamPanel(show) {
    if (!camPanel) return;
    camPanel.style.display = show ? "block" : "none";
    if (quickActions) quickActions.style.display = show ? "none" : "flex";
    if (show) startRegCamera();
    else stopRegCamera();
  }

  if (fileInput)
    fileInput.addEventListener("change", async (e) => {
      regCapturedDataUrl = null; // prioritize new file
      const f = e.target.files && e.target.files[0];
      if (!f) {
        showPreview(null);
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(f, 800);
        showPreview(dataUrl);
      } catch (err) {
        console.error("Preview failed", err);
        showPreview(null);
      }
    });

  if (openCamBtn)
    openCamBtn.addEventListener("click", () => {
      toggleCamPanel(true);
    });
  if (stopCamBtn)
    stopCamBtn.addEventListener("click", () => toggleCamPanel(false));
  if (clearBtn)
    clearBtn.addEventListener("click", () => {
      if (fileInput) fileInput.value = "";
      regCapturedDataUrl = null;
      showPreview(null);
    });
  if (captureBtn)
    captureBtn.addEventListener("click", () => {
      // Capture current video frame to data URL
      try {
        const video = videoWrap && videoWrap.querySelector("video");
        if (!video) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        // Draw mirrored to match preview orientation
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        regCapturedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
        showPreview(regCapturedDataUrl);
        toggleCamPanel(false);
      } catch (e) {
        console.error("Capture failed", e);
        showToast("Failed to capture photo.", "error");
      }
    });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("fullName").value.trim();
    const strand = document.getElementById("strand").value.trim();
    const email = document.getElementById("email").value.trim();
    const contact = document.getElementById("contact").value.trim();
    const studentId = document.getElementById("studentId").value.trim();
    const itemName = document.getElementById("itemName").value.trim();
    const category = (catSelect && catSelect.value) || "";
    if (!category) {
      showToast("Please select a category.", "error");
      return;
    }
    const photo = fileInput && fileInput.files[0];
    // Validate unique item name per student
    const existing = (ifoundDB.listItemsByStudent(studentId) || []).some(
      (x) => (x.itemName || "").trim().toLowerCase() === itemName.toLowerCase()
    );
    if (existing) {
      showToast(
        "You already registered an item with this name. Please use a different name.",
        "error"
      );
      return;
    }

    try {
      // Read and downscale image to data URL for storage
      let photoDataUrl = null;
      if (regCapturedDataUrl) {
        photoDataUrl = regCapturedDataUrl;
      } else if (photo) {
        photoDataUrl = await fileToDataUrl(photo, 800);
      }
      if (!photoDataUrl) {
        showToast("Please add a photo via upload or camera.", "error");
        return;
      }
      const item = ifoundDB.addItem({
        itemName,
        studentId,
        ownerName: fullName,
        strand,
        email,
        contact,
        photoDataUrl,
        category,
      });
      // Reset form and photo state
      form.reset();
      showPreview(null);
      regCapturedDataUrl = null;
      if (fileInput) fileInput.value = "";
      const sidInput = document.getElementById("myStudentId");
      if (sidInput) sidInput.value = item.studentId;
      window.location.hash = "#myitems";
      const showBtn = document.getElementById("myItemsBtn");
      if (showBtn) showBtn.click();
      showToast("Registered! Your QR is available under My Registered Items.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to register. Please try again.", "error");
    }
  });
}

// ==========================================
// 3. SCANNER / REPORTING MODULE
// ==========================================

// Scan QR (camera) using native BarcodeDetector
let scannedItemId = null;
let mediaStream = null;
let scanning = false;
function bindScan() {
  const startBtn = document.getElementById("start-camera");
  const stopBtn = document.getElementById("stop-camera");
  const videoWrap = document.querySelector(".video-wrap");
  const resultCard = document.getElementById("scan-result");
  const foundForm = document.getElementById("foundForm");
  const imgFile = document.getElementById("img-file");
  const foundPhotoInput = document.getElementById("foundPhoto");
  const foundPreview = document.getElementById("foundPreview");

  // Found-form camera refs
  const foundOpenCamBtn = document.getElementById("foundOpenCam");
  const foundStopCamBtn = document.getElementById("foundStopCam");
  const foundCaptureBtn = document.getElementById("foundCapture");
  const foundClearBtn = document.getElementById("foundClearPhoto");
  const foundVideoWrap = document.getElementById("foundVideoWrap");
  const foundCamPanel = document.getElementById("foundCamPanel");
  const foundQuickActions = document.getElementById("foundQuickActions");

  let foundMediaStream = null;
  let foundCapturedDataUrl = null;

  // Show/hide the photo preview for the found form
  function showFoundPhotoPreview(src) {
    if (!foundPreview) return;
    if (src) {
      foundPreview.src = src;
      foundPreview.style.display = "block";
    } else {
      foundPreview.removeAttribute("src");
      foundPreview.style.display = "none";
    }
  }

  // Start the found-item camera
  async function startFoundCamera() {
    try {
      if (foundMediaStream) return;
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      video.style.transform = "scaleX(-1)";
      foundVideoWrap.innerHTML = "";
      foundVideoWrap.appendChild(video);
      foundMediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = foundMediaStream;
      await video.play();
    } catch (e) {
      console.error("Found-form camera error", e);
      showToast("Unable to access camera. Please allow permission or use file upload.", "error");
    }
  }

  // Stop the found-item camera stream
  function stopFoundCamera() {
    if (foundMediaStream) {
      foundMediaStream.getTracks().forEach((t) => t.stop());
      foundMediaStream = null;
    }
    if (foundVideoWrap) foundVideoWrap.innerHTML = "";
  }

  // Expose so the router can stop it when navigating away
  window.stopFoundCamera = stopFoundCamera;

  // Toggle the found-form camera panel
  function toggleFoundCamPanel(show) {
    if (!foundCamPanel) return;
    foundCamPanel.style.display = show ? "block" : "none";
    if (foundQuickActions) foundQuickActions.style.display = show ? "none" : "flex";
    if (show) startFoundCamera();
    else stopFoundCamera();
  }

  if (foundOpenCamBtn) {
    foundOpenCamBtn.addEventListener("click", () => toggleFoundCamPanel(true));
  }
  if (foundStopCamBtn) {
    foundStopCamBtn.addEventListener("click", () => toggleFoundCamPanel(false));
  }
  if (foundClearBtn) {
    foundClearBtn.addEventListener("click", () => {
      if (foundPhotoInput) foundPhotoInput.value = "";
      foundCapturedDataUrl = null;
      showFoundPhotoPreview(null);
    });
  }
  if (foundCaptureBtn) {
    foundCaptureBtn.addEventListener("click", () => {
      try {
        const video = foundVideoWrap && foundVideoWrap.querySelector("video");
        if (!video) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        // Flip to correct the mirrored preview
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        foundCapturedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        showFoundPhotoPreview(foundCapturedDataUrl);
        toggleFoundCamPanel(false);
      } catch (e) {
        console.error("Found-form capture failed", e);
        showToast("Failed to capture photo.", "error");
      }
    });
  }
  if (foundPhotoInput) {
    foundPhotoInput.addEventListener("change", async (e) => {
      foundCapturedDataUrl = null; // file takes priority over any old capture
      const f = e.target.files && e.target.files[0];
      if (!f) { showFoundPhotoPreview(null); return; }
      try {
        const dataUrl = await fileToDataUrl(f, 800);
        showFoundPhotoPreview(dataUrl);
      } catch (err) {
        console.error("Found preview failed", err);
        showFoundPhotoPreview(null);
      }
    });
  }

  // Helper to load jsQR preferring a local copy then falling back to CDN
  async function ensureJsQR() {
    if (typeof jsQR !== "undefined") return;
    // Try local vendor first
    const localPath = "public/libs/jsQR.js";
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = localPath;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("local jsQR not found"));
        document.head.appendChild(s);
      });
      if (typeof jsQR !== "undefined") return;
    } catch (e) {
      // fall through to CDN
    }
    // CDN fallback
    const cdn = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = cdn;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load jsQR from CDN"));
      document.head.appendChild(s);
    });
  }

  if (resultCard)
    resultCard.innerHTML = "<div><em>Waiting for scan...</em></div>";

  // Start live camera QR scanning. Uses BarcodeDetector when available,
  // otherwise falls back to jsQR by reading video frames into a canvas.
  let scanRaf = null;
  let scanVideoEl = null;
  async function startCameraScan() {
    try {
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.style.width = "360px";
      video.style.height = "270px";
      // Mirror preview so movement looks natural
      video.style.transform = "scaleX(-1)";
      videoWrap.innerHTML = "";
      videoWrap.appendChild(video);

      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      video.srcObject = mediaStream;
      await video.play();

      scanVideoEl = video;
      scanning = true;

      // If native BarcodeDetector exists, prefer it
      let useBarcodeDetector = false;
      if ("BarcodeDetector" in window) {
        try {
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          useBarcodeDetector = true;
          const tick = async () => {
            if (!scanning) return;
            try {
              const codes = await detector.detect(video);
              if (codes && codes.length) {
                scannedItemId = (codes[0].rawValue || "").trim();
                await stopCamera();
                showFoundForm();
                loadScannedItem(scannedItemId, resultCard);
                return;
              }
            } catch (e) {
              // BarcodeDetector failed mid-scan — fall through to jsQR below
              console.warn("BarcodeDetector error, switching to jsQR", e);
              useBarcodeDetector = false;
              startJsQRLoop(video, canvas, ctx, resultCard);
              return;
            }
            scanRaf = requestAnimationFrame(tick);
          };
          scanRaf = requestAnimationFrame(tick);
          return;
        } catch (e) {
          console.warn("BarcodeDetector init failed, falling back:", e);
        }
      }

      // Ensure jsQR is available for fallback
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      try {
        await ensureJsQR();
      } catch (e) {
        console.error("Failed to load jsQR fallback", e);
        showToast(
          "QR scanning is not supported in this browser and the fallback failed. Use the image upload or try another browser.",
          "error"
        );
        return;
      }
      startJsQRLoop(video, canvas, ctx, resultCard);
    } catch (e) {
      console.error(e);
      showToast(
        "Camera access failed. Please allow permission or use the image upload.",
        "error"
      );
    }
  }

  // Stop Scan camera stream and clear preview
  async function stopCamera() {
    scanning = false;
    if (scanRaf) {
      cancelAnimationFrame(scanRaf);
      scanRaf = null;
    }
    if (scanVideoEl) {
      try {
        scanVideoEl.pause();
        scanVideoEl.srcObject = null;
      } catch (e) { }
      scanVideoEl = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    if (videoWrap) videoWrap.innerHTML = "";
  }
  // expose globally so router can stop when leaving panel
  window.stopScanCamera = stopCamera;

  // jsQR video frame scanning loop — extracted so BarcodeDetector can hand off
  function startJsQRLoop(video, canvas, ctx, resultCard) {
    const tickFallback = () => {
      if (!scanning || !scanVideoEl) return;
      try {
        const w = scanVideoEl.videoWidth || 320;
        const hh = scanVideoEl.videoHeight || 240;
        if (w && hh) {
          canvas.width = w;
          canvas.height = hh;
          // Draw UN-MIRRORED frame for accurate QR decoding
          ctx.drawImage(scanVideoEl, 0, 0, w, hh);
          try {
            const imageData = ctx.getImageData(0, 0, w, hh);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              scannedItemId = (code.data || "").trim();
              stopCamera();
              showFoundForm();
              loadScannedItem(scannedItemId, resultCard);
              return;
            }
          } catch (err) {
            console.warn("Frame decode failed:", err);
          }
        }
      } catch (err) {
        console.error("Scan loop error", err);
      }
      scanRaf = requestAnimationFrame(tickFallback);
    };
    scanRaf = requestAnimationFrame(tickFallback);
  }

  // Decode QR from an uploaded image (fallback)
  async function decodeFromImage(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        // Prefer native BarcodeDetector when available
        if ("BarcodeDetector" in window) {
          try {
            const detector = new BarcodeDetector({ formats: ["qr_code"] });
            const codes = await detector.detect(canvas);
            if (codes && codes.length) {
              scannedItemId = (codes[0].rawValue || "").trim();
              showFoundForm();
              loadScannedItem(scannedItemId, resultCard);
              return;
            }
          } catch (e) {
            console.warn("BarcodeDetector failed on canvas, falling back:", e);
            // fall through to JS fallback
          }
        }

        // Fallback: load jsQR (prefers local vendor, then CDN)
        try {
          await ensureJsQR();
        } catch (e) {
          console.error("Failed to load jsQR fallback", e);
          showToast(
            "QR decoding is not supported in this browser. Try Chrome/Edge or use the camera.",
            "error"
          );
          return;
        }

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            scannedItemId = (code.data || "").trim();
            showFoundForm();
            loadScannedItem(scannedItemId, resultCard);
          } else {
            showToast("No QR found in the image. Please try again.", "error");
          }
        } catch (e) {
          console.error(e);
          showToast("Failed to decode the image.", "error");
        }
      } catch (e) {
        console.error(e);
        showToast("Failed to decode the image.", "error");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("Failed to load the image.", "error");
    };
    img.src = url;
  }

  if (startBtn && videoWrap)
    startBtn.addEventListener("click", startCameraScan);
  if (stopBtn) stopBtn.addEventListener("click", stopCamera);
  if (imgFile)
    imgFile.addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) decodeFromImage(f);
    });

  if (foundForm) {
    foundForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!scannedItemId) {
        showToast("Scan an item QR first.", "error");
        return;
      }
      const finderName = document.getElementById("finderName").value.trim();
      const location = document.getElementById("foundLocation").value.trim();
      const photoFile = document.getElementById("foundPhoto").files[0];
      // Accept either a camera capture OR an uploaded file
      const hasPhoto = foundCapturedDataUrl || photoFile;
      if (!hasPhoto) {
        showToast("Please take or upload a photo of the item.", "error");
        return;
      }
      try {
        let photoDataUrl = null;
        if (foundCapturedDataUrl) {
          photoDataUrl = foundCapturedDataUrl;
        } else if (photoFile) {
          photoDataUrl = await fileToDataUrl(photoFile, 800);
        }
        const r = ifoundDB.addFoundReport({
          itemId: scannedItemId,
          finderName,
          location,
          photoDataUrl,
        });
        if (!r) throw new Error("Submit failed");
        showToast("Report submitted. Thank you!", "success");
        foundForm.reset();
        hideFoundForm();
        // Reset found-form photo and camera state
        foundCapturedDataUrl = null;
        showFoundPhotoPreview(null);
        stopFoundCamera();
        toggleFoundCamPanel(false);
        const foundPhotoEl = document.getElementById("foundPhoto");
        if (foundPhotoEl) foundPhotoEl.value = "";
        // Reset scan state
        if (resultCard)
          resultCard.innerHTML = "<em style='color:#6b7280'>Waiting for QR scan&hellip;</em>";
        const qrImgFile = document.getElementById("img-file");
        if (qrImgFile) qrImgFile.value = "";
        scannedItemId = null;
      } catch (err) {
        console.error(err);
        showToast("Failed to submit report.", "error");
      }
    });
  }
}

// Show/hide found form based on scan state
function showFoundForm() {
  const ff = document.getElementById("found-form");
  if (ff) ff.style.display = "block";
}
function hideFoundForm() {
  const ff = document.getElementById("found-form");
  if (ff) ff.style.display = "none";
}

// Render scanned item card in Scan panel (safe — no innerHTML from user data)
async function loadScannedItem(itemId, container) {
  try {
    const item = ifoundDB.getItem(itemId);
    if (!item) throw new Error("Item not found");
    const wrap = h("div", {}, [
      h("div", { style: "display:flex; gap:12px; align-items:flex-start" }, [
        item.photoPath
          ? h("img", {
            src: assetUrl(item.photoPath),
            style: "max-width:160px;border-radius:6px",
          })
          : null,
        h("div", {}, [
          h("strong", {}, item.itemName),
          h("div", {}, `Owner: ${item.ownerName} (${item.contact || "n/a"})`),
          h("div", {}, `Status: ${item.status}`),
          item.lastClaimedAt
            ? h(
              "div",
              { style: "font-size:12px;color:#6b7280" },
              `Last claimed: ${new Date(item.lastClaimedAt).toLocaleString()}`
            )
            : null,
        ]),
      ]),
    ]);
    container.innerHTML = "";
    container.appendChild(wrap);
  } catch (e) {
    container.innerHTML = "";
    container.appendChild(
      h("div", { class: "toast-error" }, "Item not found in the database. It may not be registered yet.")
    );
  }
}

// ==========================================
// 4. USER DASHBOARD (MY ITEMS)
// ==========================================

// My Registered Items
function bindMyItems() {
  const btn = document.getElementById("myItemsBtn");
  const list = document.getElementById("myItemsList");
  if (!btn || !list) return;

  list.innerHTML = "";
  btn.addEventListener("click", async () => {
    const sid = document.getElementById("myStudentId").value.trim();
    if (!sid) return showToast("Please enter your Student ID.", "error");
    try {
      const items = ifoundDB.listItemsByStudent(sid);
      list.innerHTML = "";
      if (!items.length) {
        list.appendChild(h("div", {}, "No items found."));
        return;
      }
      items.forEach((item) => {
        // Create card and async-generate QR to keep UI responsive
        const qrImg = h("img", {
          alt: "QR",
          style:
            "width:120px;height:120px;background:#fff;padding:6px;border-radius:8px",
        });
        const card = h("div", { class: "card", style: "margin-bottom:8px" }, [
          h("div", { style: "display:flex;gap:8px;align-items:center" }, [
            h("strong", {}, item.itemName),
            h("span", { class: "status-" + item.status }, item.status),
          ]),
          item.photoPath
            ? h("img", {
              src: assetUrl(item.photoPath),
              style: "max-width:200px;margin-top:8px",
            })
            : null,
          h(
            "div",
            { style: "margin-top:6px;font-size:12px;color:#6b7280" },
            `Category: ${categoryLabel(
              item.category || inferCategoryFromName(item.itemName)
            )}`
          ),
          h(
            "div",
            {
              style: "margin-top:8px;display:flex;gap:8px;align-items:center",
            },
            [
              qrImg,
              h(
                "a",
                {
                  href: "#",
                  class: "btn secondary",
                  style: "text-align:center; flex:1",
                  onclick: (e) => {
                    e.preventDefault();
                    downloadQr(item.id);
                  },
                },
                "Download QR"
              ),
            ]
          ),
        ]);
        list.appendChild(card);
        // Generate QR offline and set image src
        generateQrDataUrl(String(item.id), 200)
          .then((url) => {
            qrImg.setAttribute("src", url);
          })
          .catch(() => {
            qrImg.setAttribute("alt", "QR generation failed");
          });
      });
    } catch (err) {
      console.error(err);
      showToast("Failed to fetch items.", "error");
    }
  });
}

// ==========================================
// 5. LOST LIST & CLAIM FLOW
// ==========================================

// Lost Items list and Claim
async function loadLostItems() {
  const list = document.getElementById("itemsList");
  if (!list) return;
  try {
    const items = ifoundDB.listLostItems();
    list.innerHTML = "";
    const search = document
      .getElementById("searchBar")
      .value.trim()
      .toLowerCase();
    const cat = (
      document.getElementById("categoryFilter").value || "all"
    ).toLowerCase();
    items
      .filter((item) => {
        const hit = `${item.itemName} ${item.ownerName}`
          .toLowerCase()
          .includes(search);
        const itemCat = item.category || inferCategoryFromName(item.itemName);
        const inCat = cat === "all" || itemCat === cat;
        return hit && inCat;
      })
      .forEach((item) => {
        const primaryPhoto = item.foundPhotoPath || item.photoPath;
        const secondaryPhoto =
          item.foundPhotoPath && item.photoPath ? item.photoPath : null;
        const card = h("div", { class: "item card" }, [
          primaryPhoto
            ? h("img", { src: assetUrl(primaryPhoto), alt: item.itemName })
            : null,
          h("div", { class: "meta" }, [
            h("strong", {}, item.itemName),
            h("div", {}, `Owner: ${item.ownerName}`),
            h(
              "div",
              { style: "margin-top:4px;color:#6b7280;font-size:12px" },
              `Category: ${categoryLabel(
                item.category || inferCategoryFromName(item.itemName)
              )}`
            ),
            item.lastClaimedAt
              ? h(
                "div",
                { style: "margin-top:4px;color:#6b7280;font-size:12px" },
                `Last claimed: ${new Date(
                  item.lastClaimedAt
                ).toLocaleString()}`
              )
              : null,
            secondaryPhoto
              ? h("div", { style: "margin-top:8px" }, [
                h("img", {
                  src: assetUrl(secondaryPhoto),
                  alt: "Owner Photo",
                  style: "max-width:140px;border-radius:6px;opacity:0.9",
                }),
              ])
              : null,
            h("div", { style: "margin-top:12px" }, [
              h(
                "button",
                {
                  class: "btn primary",
                  style: "width:100%",
                  onclick: async () => {
                    // Show the claim modal and populate with item info
                    showClaimModal(item);
                  },
                },
                "Claim Item"
              ),
            ]),
          ]),
        ]);
        list.appendChild(card);
      });
  } catch (err) {
    console.error(err);
    list.innerHTML = '<div class="card">Failed to load lost items.</div>';
  }
}

// Filters reload
document.addEventListener("DOMContentLoaded", () => {
  const search = document.getElementById("searchBar");
  const cat = document.getElementById("categoryFilter");
  if (search) search.addEventListener("input", loadLostItems);
  if (cat) cat.addEventListener("change", loadLostItems);
  // Claim modal handlers
  const claimModal = document.getElementById("claimModal");
  const claimForm = document.getElementById("claimForm");
  const claimCancel = document.getElementById("claimCancel");
  const claimCancelSecondary = document.getElementById("claimCancelSecondary");
  if (claimCancel) claimCancel.addEventListener("click", closeClaimModal);
  if (claimCancelSecondary) claimCancelSecondary.addEventListener("click", closeClaimModal);
  if (claimForm)
    claimForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const itemId = document.getElementById("claimItemId").value;
      const email = document.getElementById("claimEmail").value.trim().toLowerCase();
      if (!itemId) return closeClaimModal();
      const item = ifoundDB.getItem(itemId);
      if (!item) return showToast("Item not found.", "error");
      if ((item.email || "").trim().toLowerCase() !== email) {
        return showToast("Email does not match the registered owner. Cannot claim.", "error");
      }
      try {
        const r = ifoundDB.addClaim({
          itemId: item.id,
          claimantName: item.ownerName || "Owner",
        });
        if (r) {
          showToast("Claim submitted successfully!", "success");
          closeClaimModal();
          loadLostItems();
        } else showToast("Failed to submit claim.", "error");
      } catch (err) {
        console.error(err);
        showToast("Failed to submit claim.", "error");
      }
    });
});

// Claim modal helpers (global functions used by UI)
function showClaimModal(item) {
  const modal = document.getElementById("claimModal");
  if (!modal) return;
  document.getElementById("claimItemId").value = item.id || "";
  // Do NOT prefill the owner's email; claimant must enter owner's email to verify.
  document.getElementById("claimEmail").value = "";
  modal.style.display = "flex";
}
function closeClaimModal() {
  const modal = document.getElementById("claimModal");
  if (!modal) return;
  modal.style.display = "none";
}

/*
  App logic (client-only, localStorage-backed)
  - Router: show one panel per hash, stop cameras when leaving
  - Register: upload/capture photo, validate, save, and show QR in My Items
  - Scan: camera or image upload QR scanning, submit found reports
  - My Items: list user's items with QR download
  - Lost Items: searchable/filterable list with claim action

  Depends on utils.js (h, assetUrl, categoryLabel, inferCategoryFromName, fileToDataUrl, downloadQr)
  and localdb.js (ifoundDB).
*/

// Simple router to set active panel by hash
function setActivePanel() {
  const hash = window.location.hash || "#home";
  document
    .querySelectorAll(".panel")
    .forEach((el) => el.classList.remove("active"));
  const target = document.querySelector(hash);
  if (target) target.classList.add("active");
  if (hash === "#lost") loadLostItems();
  if (hash !== "#scan" && typeof window.stopScanCamera === "function") {
    try {
      window.stopScanCamera();
    } catch {}
  }
  if (hash !== "#register" && typeof window.stopRegCamera === "function") {
    try {
      window.stopRegCamera();
    } catch {}
  }
}
window.addEventListener("hashchange", setActivePanel);
document.addEventListener("DOMContentLoaded", async () => {
  setActivePanel();
  bindRegister();
  bindMyItems();
  bindScan();
});

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
      alert(
        "Unable to access camera. Please allow permission or use file upload."
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
        alert("Failed to capture photo.");
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
      alert("Please select a category.");
      return;
    }
    const photo = fileInput && fileInput.files[0];
    // Validate unique item name per student
    const existing = (ifoundDB.listItemsByStudent(studentId) || []).some(
      (x) => (x.itemName || "").trim().toLowerCase() === itemName.toLowerCase()
    );
    if (existing) {
      alert(
        "You already registered an item with this name. Please use a different name."
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
        alert("Please add a photo via upload or camera.");
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
      const sidInput = document.getElementById("myStudentId");
      if (sidInput) sidInput.value = item.studentId;
      window.location.hash = "#myitems";
      const showBtn = document.getElementById("myItemsBtn");
      if (showBtn) showBtn.click();
      alert("Registered! Your QR is available under My Registered Items.");
    } catch (err) {
      console.error(err);
      alert("Failed to register. Please try again.");
    }
  });
}

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
      if ("BarcodeDetector" in window) {
        try {
          const detector = new BarcodeDetector({ formats: ["qr_code"] });
          const tick = async () => {
            if (!scanning) return;
            try {
              const codes = await detector.detect(video);
              if (codes && codes.length) {
                scannedItemId = (codes[0].rawValue || "").trim();
                await stopCamera();
                loadScannedItem(scannedItemId, resultCard);
                return;
              }
            } catch (e) {
              // fallthrough to jsQR fallback below
              console.warn("BarcodeDetector error, falling back to jsQR", e);
              // Stop using detector path
              // start jsQR loop by calling its tick once
              return startCameraScan();
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
      try {
        await ensureJsQR();
      } catch (e) {
        console.error("Failed to load jsQR fallback", e);
        alert(
          "QR scanning is not supported in this browser and the fallback failed. Use the image upload or try another browser."
        );
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const tickFallback = () => {
        if (!scanning || !scanVideoEl) return;
        try {
          const w = scanVideoEl.videoWidth || 320;
          const h = scanVideoEl.videoHeight || 240;
          if (w && h) {
            canvas.width = w;
            canvas.height = h;
            // draw mirrored frame to match preview
            ctx.save();
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(scanVideoEl, 0, 0, w, h);
            ctx.restore();
            try {
              const imageData = ctx.getImageData(0, 0, w, h);
              const code = jsQR(imageData.data, imageData.width, imageData.height);
              if (code && code.data) {
                scannedItemId = (code.data || "").trim();
                stopCamera();
                loadScannedItem(scannedItemId, resultCard);
                return;
              }
            } catch (err) {
              // getImageData may throw on some cross-origin contexts; ignore
              console.warn("Frame decode failed:", err);
            }
          }
        } catch (err) {
          console.error("Scan loop error", err);
        }
        scanRaf = requestAnimationFrame(tickFallback);
      };
      scanRaf = requestAnimationFrame(tickFallback);
    } catch (e) {
      console.error(e);
      alert(
        "Camera access failed. Please allow permission or use the image upload."
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
      } catch (e) {}
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
              loadScannedItem(scannedItemId, resultCard);
              return;
            }
            alert("No QR found in the image.");
            return;
          } catch (e) {
            console.warn("BarcodeDetector failed on canvas, falling back:", e);
            // fall through to JS fallback
          }
        }

        // Fallback: try to load jsQR if available (dynamic load from CDN)
        if (typeof jsQR === "undefined") {
          try {
            await new Promise((resolve, reject) => {
              const s = document.createElement("script");
              s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
              s.onload = () => resolve();
              s.onerror = () => reject(new Error("Failed to load jsQR"));
              document.head.appendChild(s);
            });
          } catch (e) {
            console.error("Failed to load jsQR fallback", e);
            alert(
              "QR decoding from image is not supported in this browser and the fallback failed. Try Chrome/Edge or use the camera."
            );
            return;
          }
        }

        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            scannedItemId = (code.data || "").trim();
            loadScannedItem(scannedItemId, resultCard);
          } else {
            alert("No QR found in the image.");
          }
        } catch (e) {
          console.error(e);
          alert("Failed to decode the image.");
        }
      } catch (e) {
        console.error(e);
        alert("Failed to decode the image.");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      alert("Failed to load the image.");
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

  if (foundPhotoInput && foundPreview) {
    foundPhotoInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) {
        foundPreview.style.display = "none";
        foundPreview.removeAttribute("src");
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(f, 800);
        foundPreview.src = dataUrl;
        foundPreview.style.display = "block";
      } catch (err) {
        console.error("Found preview failed", err);
        foundPreview.style.display = "none";
        foundPreview.removeAttribute("src");
      }
    });
  }

  if (foundForm) {
    foundForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!scannedItemId) {
        alert("Scan an item QR first.");
        return;
      }
      const finderName = document.getElementById("finderName").value.trim();
      const location = document.getElementById("foundLocation").value.trim();
      const photo = document.getElementById("foundPhoto").files[0];
      try {
        let photoDataUrl = null;
        if (photo) photoDataUrl = await fileToDataUrl(photo, 800);
        const r = ifoundDB.addFoundReport({
          itemId: scannedItemId,
          finderName,
          location,
          photoDataUrl,
        });
        if (!r) throw new Error("Submit failed");
        alert("Report submitted. Thank you!");
        foundForm.reset();
        // Clear found photo preview and input
        const foundPreviewEl = document.getElementById("foundPreview");
        const foundPhotoEl = document.getElementById("foundPhoto");
        if (foundPreviewEl) {
          foundPreviewEl.style.display = "none";
          foundPreviewEl.removeAttribute("src");
        }
        if (foundPhotoEl) foundPhotoEl.value = "";
        // Reset scan state: clear result card and image QR file input
        const resultCard = document.getElementById("scan-result");
        if (resultCard)
          resultCard.innerHTML = "<div><em>Waiting for scan...</em></div>";
        const qrImgFile = document.getElementById("img-file");
        if (qrImgFile) qrImgFile.value = "";
        scannedItemId = null;
      } catch (err) {
        console.error(err);
        alert("Failed to submit report.");
      }
    });
  }
}

// Render scanned item card in Scan panel
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
          h("div", { html: `<strong>${item.itemName}</strong>` }),
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
    container.innerHTML = "<div><strong>Item not found</strong></div>";
  }
}

// My Registered Items
function bindMyItems() {
  const btn = document.getElementById("myItemsBtn");
  const list = document.getElementById("myItemsList");
  if (!btn || !list) return;

  list.innerHTML = "";
  btn.addEventListener("click", async () => {
    const sid = document.getElementById("myStudentId").value.trim();
    if (!sid) return alert("Enter Student ID");
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
          h("div", {
            html: `<strong>${item.itemName}</strong> <span class=\"status-${item.status}\">${item.status}</span>`,
          }),
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
                  class: "btn",
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
      alert("Failed to fetch items");
    }
  });
}

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
            h("div", { style: "margin-top:8px" }, [
              h(
                  "button",
                  {
                    class: "btn",
                    onclick: async () => {
                      // Show the claim modal and populate with item info
                      showClaimModal(item);
                    },
                  },
                  "Claim"
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
      const photoFile = document.getElementById("claimIdPhoto").files[0];
      if (!itemId) return closeClaimModal();
      const item = ifoundDB.getItem(itemId);
      if (!item) return alert("Item not found");
      if ((item.email || "").trim().toLowerCase() !== email) {
        return alert("Email does not match the registered owner. Cannot claim.");
      }
      try {
        let proofDataUrl = null;
        if (photoFile) proofDataUrl = await fileToDataUrl(photoFile, 800);
        const r = ifoundDB.addClaim({
          itemId: item.id,
          claimantName: item.ownerName || "Owner",
          proofPhoto: proofDataUrl,
        });
        if (r) {
          alert("Claim submitted.");
          closeClaimModal();
          loadLostItems();
        } else alert("Failed to claim");
      } catch (err) {
        console.error(err);
        alert("Failed to submit claim.");
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
  document.getElementById("claimIdPhoto").value = "";
  modal.style.display = "flex";
}
function closeClaimModal() {
  const modal = document.getElementById("claimModal");
  if (!modal) return;
  modal.style.display = "none";
}

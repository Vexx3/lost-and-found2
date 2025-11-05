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

  if (resultCard)
    resultCard.innerHTML = "<div><em>Waiting for scan...</em></div>";

  // Start live camera QR scanning
  async function startCameraScan() {
    if (!("BarcodeDetector" in window)) {
      alert(
        "QR scanning is not supported in this browser. Try Chrome/Edge or use the image upload."
      );
      return;
    }
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

      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      scanning = true;
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
        } catch (e) {}
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
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
    if (!("BarcodeDetector" in window)) {
      alert("QR decoding from image is not supported in this browser.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const codes = await detector.detect(canvas);
        if (codes && codes.length) {
          scannedItemId = (codes[0].rawValue || "").trim();
          loadScannedItem(scannedItemId, resultCard);
        } else {
          alert("No QR found in the image.");
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
        list.appendChild(
          h("div", { class: "card", style: "margin-bottom:8px" }, [
            h("div", {
              html: `<strong>${item.itemName}</strong> <span class="status-${item.status}">${item.status}</span>`,
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
                h("img", {
                  src: ifoundDB.qrUrlFor(item.id),
                  alt: "QR",
                  style:
                    "width:120px;height:120px;background:#fff;padding:6px;border-radius:8px",
                }),
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
          ])
        );
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
                    const sid = prompt("Enter owner's Student ID to claim:");
                    if (!sid) return;
                    const sameId =
                      (sid || "").trim() === (item.studentId || "").trim();
                    if (!sameId) {
                      alert(
                        "Student ID does not match the registered owner. Cannot claim."
                      );
                      return;
                    }
                    const r = ifoundDB.addClaim({
                      itemId: item.id,
                      claimantName: item.ownerName || "Owner",
                    });
                    if (r) {
                      alert("Claim submitted.");
                      loadLostItems();
                    } else alert("Failed to claim");
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
});

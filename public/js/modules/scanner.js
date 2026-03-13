import { showToast, h } from "./ui.js";
import { api } from "../api.js";
import { fileToDataUrl, assetUrl, maskName } from "./utils.js";
let scannedItemId = null;
let scanning = false;
let mediaStream = null;
function showFoundForm() {
    const ff = document.getElementById("found-form");
    if (ff)
        ff.style.display = "block";
}
function hideFoundForm() {
    const ff = document.getElementById("found-form");
    if (ff)
        ff.style.display = "none";
}
async function loadScannedItem(itemId, container) {
    try {
        const item = await api.getItem(itemId);
        if (!item)
            throw new Error("Item not found");
        if (item.status === "archived") {
            hideFoundForm();
            container.innerHTML = "";
            container.appendChild(h("div", { style: "color:#991b1b;background:rgba(239,68,68,0.08);padding:12px;border-radius:8px;" }, "This item has been archived (expired). Please contact the admin office directly."));
            return;
        }
        const previouslyClaimed = item.status === "claimed";
        const photo = item.photoPath || item.photoDataUrl;
        const wrap = h("div", {}, [
            previouslyClaimed
                ? h("div", { style: "font-size:13px;color:#7a4a00;background:rgba(255,193,7,0.12);padding:8px 12px;border-radius:6px;margin-bottom:8px;" }, "This item was previously claimed. You can still report it found again.")
                : null,
            h("div", { style: "display:flex; gap:12px; align-items:flex-start" }, [
                photo
                    ? h("img", {
                        src: assetUrl(photo),
                        style: "max-width:160px;border-radius:6px",
                    })
                    : null,
                h("div", {}, [
                    h("strong", {}, item.itemName),
                    h("div", {}, `Owner: ${maskName(item.ownerName)}`),
                    h("span", { class: "status-" + item.status }, item.status),
                ]),
            ]),
        ]);
        container.innerHTML = "";
        container.appendChild(wrap);
    }
    catch (e) {
        hideFoundForm();
        container.innerHTML = "";
        container.appendChild(h("div", { style: "color:#991b1b;background:rgba(239,68,68,0.08);padding:12px;border-radius:8px;" }, "Item not found in the database. Make sure the QR code is registered."));
    }
}
export function bindScan() {
    const startBtn = document.getElementById("start-camera");
    const stopBtn = document.getElementById("stop-camera");
    const videoWrap = document.querySelector(".video-wrap");
    const resultCard = document.getElementById("scan-result");
    const foundForm = document.getElementById("foundForm");
    const imgFile = document.getElementById("img-file");
    const foundPhotoInput = document.getElementById("foundPhoto");
    const foundPreview = document.getElementById("foundPreview");
    const foundOpenCamBtn = document.getElementById("foundOpenCam");
    const foundStopCamBtn = document.getElementById("foundStopCam");
    const foundCaptureBtn = document.getElementById("foundCapture");
    const foundClearBtn = document.getElementById("foundClearPhoto");
    const foundVideoWrap = document.getElementById("foundVideoWrap");
    const foundCamPanel = document.getElementById("foundCamPanel");
    const foundQuickActions = document.getElementById("foundQuickActions");
    let foundMediaStream = null;
    let foundCapturedDataUrl = null;
    function showFoundPhotoPreview(src) {
        if (!foundPreview)
            return;
        if (src) {
            foundPreview.src = src;
            foundPreview.style.display = "block";
        }
        else {
            foundPreview.removeAttribute("src");
            foundPreview.style.display = "none";
        }
    }
    async function startFoundCamera() {
        try {
            if (foundMediaStream)
                return;
            const video = document.createElement("video");
            video.setAttribute("playsinline", "");
            video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)";
            if (foundVideoWrap) {
                foundVideoWrap.innerHTML = "";
                foundVideoWrap.appendChild(video);
            }
            try {
                foundMediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
                });
            }
            catch {
                foundMediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            video.srcObject = foundMediaStream;
            await video.play();
        }
        catch (e) {
            console.error("Found-form camera error", e);
            showToast("Unable to access camera. Please allow permission or use file upload.", "error");
        }
    }
    function stopFoundCamera() {
        if (foundMediaStream) {
            foundMediaStream.getTracks().forEach((t) => t.stop());
            foundMediaStream = null;
        }
        if (foundVideoWrap)
            foundVideoWrap.innerHTML = "";
    }
    window.stopFoundCamera = stopFoundCamera;
    function toggleFoundCamPanel(show) {
        if (!foundCamPanel)
            return;
        foundCamPanel.style.display = show ? "block" : "none";
        if (foundQuickActions)
            foundQuickActions.style.display = show ? "none" : "flex";
        if (show)
            startFoundCamera();
        else
            stopFoundCamera();
    }
    foundOpenCamBtn?.addEventListener("click", () => toggleFoundCamPanel(true));
    foundStopCamBtn?.addEventListener("click", () => toggleFoundCamPanel(false));
    foundClearBtn?.addEventListener("click", () => {
        if (foundPhotoInput)
            foundPhotoInput.value = "";
        foundCapturedDataUrl = null;
        showFoundPhotoPreview(null);
    });
    foundCaptureBtn?.addEventListener("click", () => {
        try {
            const video = foundVideoWrap?.querySelector("video");
            if (!video)
                return;
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                ctx.restore();
                foundCapturedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
                showFoundPhotoPreview(foundCapturedDataUrl);
                toggleFoundCamPanel(false);
            }
        }
        catch (e) {
            showToast("Failed to capture photo.", "error");
        }
    });
    if (foundPhotoInput) {
        foundPhotoInput.addEventListener("change", async (e) => {
            foundCapturedDataUrl = null;
            const f = e.target.files?.[0];
            if (!f) {
                showFoundPhotoPreview(null);
                return;
            }
            try {
                const dataUrl = await fileToDataUrl(f, 800);
                showFoundPhotoPreview(dataUrl);
            }
            catch (err) {
                showFoundPhotoPreview(null);
            }
        });
    }
    async function ensureJsQR() {
        if (typeof jsQR !== "undefined")
            return;
        const cdn = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
        await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = cdn;
            s.onload = () => resolve(null);
            s.onerror = () => reject(new Error("Failed to load jsQR from CDN"));
            document.head.appendChild(s);
        });
    }
    if (resultCard)
        resultCard.innerHTML = "<em style='color:#6b7280'>Waiting for QR scan&hellip;</em>";
    let scanRaf = null;
    let scanVideoEl = null;
    async function startCameraScan() {
        try {
            const video = document.createElement("video");
            video.setAttribute("playsinline", "");
            video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)";
            if (videoWrap) {
                videoWrap.innerHTML = "";
                videoWrap.appendChild(video);
            }
            try {
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
                });
            }
            catch {
                mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            video.srcObject = mediaStream;
            await video.play();
            scanVideoEl = video;
            scanning = true;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            try {
                await ensureJsQR();
            }
            catch (e) {
                showToast("QR scanning is not supported.", "error");
                return;
            }
            startJsQRLoop(video, canvas, ctx, resultCard);
        }
        catch (e) {
            showToast("Camera access failed.", "error");
        }
    }
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
            }
            catch (e) { }
            scanVideoEl = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach((t) => t.stop());
            mediaStream = null;
        }
        if (videoWrap)
            videoWrap.innerHTML = "";
    }
    window.stopScanCamera = stopCamera;
    function startJsQRLoop(video, canvas, ctx, resultCard) {
        const tickFallback = () => {
            if (!scanning || !scanVideoEl)
                return;
            try {
                const w = scanVideoEl.videoWidth || 320;
                const hh = scanVideoEl.videoHeight || 240;
                if (w && hh) {
                    canvas.width = w;
                    canvas.height = hh;
                    ctx.drawImage(scanVideoEl, 0, 0, w, hh);
                    try {
                        const imageData = ctx.getImageData(0, 0, w, hh);
                        const code = jsQR(imageData.data, imageData.width, imageData.height);
                        if (code && code.data) {
                            scannedItemId = (code.data || "").trim();
                            stopCamera();
                            showFoundForm();
                            if (scannedItemId && resultCard)
                                loadScannedItem(scannedItemId, resultCard);
                            return;
                        }
                    }
                    catch (err) { }
                }
            }
            catch (err) { }
            scanRaf = requestAnimationFrame(tickFallback);
        };
        scanRaf = requestAnimationFrame(tickFallback);
    }
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
                if (ctx)
                    ctx.drawImage(img, 0, 0);
                try {
                    await ensureJsQR();
                }
                catch (e) {
                    showToast("QR decoding is not supported.", "error");
                    return;
                }
                try {
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height);
                        if (code && code.data) {
                            scannedItemId = (code.data || "").trim();
                            showFoundForm();
                            if (scannedItemId && resultCard)
                                loadScannedItem(scannedItemId, resultCard);
                        }
                        else {
                            showToast("No QR found in the image. Please try again.", "error");
                        }
                    }
                }
                catch (e) {
                    showToast("Failed to decode the image.", "error");
                }
            }
            finally {
                URL.revokeObjectURL(url);
            }
        };
        img.src = url;
    }
    startBtn?.addEventListener("click", startCameraScan);
    stopBtn?.addEventListener("click", stopCamera);
    imgFile?.addEventListener("change", (e) => {
        const f = e.target.files?.[0];
        if (f)
            decodeFromImage(f);
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
            const photoFile = document.getElementById("foundPhoto").files?.[0];
            const hasPhoto = foundCapturedDataUrl || photoFile;
            if (!hasPhoto) {
                showToast("Please take or upload a photo of the item.", "error");
                return;
            }
            try {
                let photoDataUrl = null;
                if (foundCapturedDataUrl) {
                    photoDataUrl = foundCapturedDataUrl;
                }
                else if (photoFile) {
                    photoDataUrl = await fileToDataUrl(photoFile, 800);
                }
                const r = await api.addFoundReport({
                    itemId: scannedItemId,
                    finderName,
                    location,
                    photoDataUrl,
                });
                if (!r)
                    throw new Error("Submit failed");
                showToast("Report submitted. Thank you! Sender will be emailed.", "success");
                foundForm.reset();
                hideFoundForm();
                foundCapturedDataUrl = null;
                showFoundPhotoPreview(null);
                stopFoundCamera();
                toggleFoundCamPanel(false);
                if (foundPhotoInput)
                    foundPhotoInput.value = "";
                if (resultCard)
                    resultCard.innerHTML = "<em style='color:#6b7280'>Waiting for QR scan&hellip;</em>";
                if (imgFile)
                    imgFile.value = "";
                scannedItemId = null;
            }
            catch (err) {
                console.error(err);
                showToast("Failed to submit report.", "error");
            }
        });
    }
}

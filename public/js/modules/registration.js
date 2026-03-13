import { api } from "../api.js";
import { showToast } from "./ui.js";
import { fileToDataUrl } from "./utils.js";
export function bindRegister() {
    const form = document.getElementById("registerForm");
    if (!form)
        return;
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
        if (!previewImg)
            return;
        if (src) {
            previewImg.src = src;
            previewImg.style.display = "block";
        }
        else {
            previewImg.removeAttribute("src");
            previewImg.style.display = "none";
        }
    }
    async function startRegCamera() {
        try {
            if (regMediaStream)
                return;
            const video = document.createElement("video");
            video.setAttribute("playsinline", "");
            video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;transform:scaleX(-1)";
            if (videoWrap) {
                videoWrap.innerHTML = "";
                videoWrap.appendChild(video);
            }
            try {
                regMediaStream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
                });
            }
            catch {
                regMediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            }
            video.srcObject = regMediaStream;
            await video.play();
        }
        catch (e) {
            console.error("Register camera error", e);
            showToast("Unable to access camera. Please allow permission or use file upload.", "error");
        }
    }
    function stopRegCamera() {
        if (regMediaStream) {
            regMediaStream.getTracks().forEach((t) => t.stop());
            regMediaStream = null;
        }
        if (videoWrap)
            videoWrap.innerHTML = "";
    }
    // Bind to global for router cleanup
    window.stopRegCamera = stopRegCamera;
    function toggleCamPanel(show) {
        if (!camPanel)
            return;
        camPanel.style.display = show ? "block" : "none";
        if (quickActions)
            quickActions.style.display = show ? "none" : "flex";
        if (show)
            startRegCamera();
        else
            stopRegCamera();
    }
    if (fileInput) {
        fileInput.addEventListener("change", async (e) => {
            regCapturedDataUrl = null;
            const f = e.target.files?.[0];
            if (!f) {
                showPreview(null);
                return;
            }
            try {
                const dataUrl = await fileToDataUrl(f, 800);
                showPreview(dataUrl);
            }
            catch (err) {
                showPreview(null);
            }
        });
    }
    openCamBtn?.addEventListener("click", () => toggleCamPanel(true));
    stopCamBtn?.addEventListener("click", () => toggleCamPanel(false));
    clearBtn?.addEventListener("click", () => {
        if (fileInput)
            fileInput.value = "";
        regCapturedDataUrl = null;
        showPreview(null);
    });
    captureBtn?.addEventListener("click", () => {
        try {
            const video = videoWrap?.querySelector("video");
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
                regCapturedDataUrl = canvas.toDataURL("image/jpeg", 0.8);
                showPreview(regCapturedDataUrl);
                toggleCamPanel(false);
            }
        }
        catch (e) {
            showToast("Failed to capture photo.", "error");
        }
    });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        // Using explicit casts or checking values to respect strict mode
        const fullName = document.getElementById("fullName").value.trim();
        const strand = document.getElementById("strand").value.trim();
        const email = document.getElementById("email").value.trim();
        const contact = document.getElementById("contact").value.trim();
        const studentId = document.getElementById("studentId").value.trim();
        const itemName = document.getElementById("itemName").value.trim();
        const category = catSelect?.value || "";
        if (!category) {
            showToast("Please select a category.", "error");
            return;
        }
        const photo = fileInput?.files?.[0];
        try {
            let photoDataUrl = null;
            if (regCapturedDataUrl) {
                photoDataUrl = regCapturedDataUrl;
            }
            else if (photo) {
                photoDataUrl = await fileToDataUrl(photo, 800);
            }
            if (!photoDataUrl) {
                showToast("Please add a photo via upload or camera.", "error");
                return;
            }
            // Check uniqueness of item per student
            const userItems = await api.listItemsByStudent(studentId);
            const existing = userItems.some((x) => (x.itemName || "").trim().toLowerCase() === itemName.toLowerCase());
            if (existing) {
                showToast("You already registered an item with this name. Please use a different name.", "error");
                return;
            }
            const item = await api.addItem({
                itemName,
                studentId,
                ownerName: fullName,
                strand,
                email,
                contact,
                photoDataUrl,
                category,
            });
            form.reset();
            showPreview(null);
            regCapturedDataUrl = null;
            if (fileInput)
                fileInput.value = "";
            const sidInput = document.getElementById("myStudentId");
            if (sidInput)
                sidInput.value = item.studentId;
            window.location.hash = "#myitems";
            document.getElementById("myItemsBtn")?.click();
            showToast("Registered! Your QR is available under My Registered Items.", "success");
        }
        catch (err) {
            console.error(err);
            showToast("Failed to register. Please try again.", "error");
        }
    });
}

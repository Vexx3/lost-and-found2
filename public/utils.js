"use strict";

/*
==========================================================================
  Shared Utility Functions
  Architecture: Global Helpers
  
  Exposes functions on the global window scope:
  - h(tag, attrs, children): create a DOM node quickly
  - assetUrl(path): passthrough, kept for future hosting tweaks
  - categoryLabel(key), inferCategoryFromName(name)
  - fileToDataUrl(file, maxWidth): downscale image to JPEG data URL
  - downloadQr(itemId): generate and download a QR image as a file
==========================================================================
*/

// Minimal DOM element helper with safe event binding
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function")
      el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
}

// Pass-through asset URL (kept for future hosting changes)
function assetUrl(p) {
  return p;
}

// Privacy helper — mask a full name to "First L." (e.g. "Juan D.")
// Used on all public-facing pages so full names are not exposed.
function maskName(fullName) {
  if (!fullName || typeof fullName !== "string") return "Unknown";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]; // single name, no masking needed
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${first} ${lastInitial}.`;
}

// Category helpers
function categoryLabel(key) {
  const map = {
    phones: "Phone",
    wallets: "Wallet",
    tumblers: "Tumbler",
    other: "Other",
  };
  return map[key] || "Other";
}
function inferCategoryFromName(name) {
  if (!name) return "other";
  if (/phone|iphone|android|samsung|oppo|vivo/i.test(name)) return "phones";
  if (/wallet/i.test(name)) return "wallets";
  if (/tumbler|bottle|hydro/i.test(name)) return "tumblers";
  return "other";
}

// Image helpers
// Convert a File into a downscaled JPEG data URL
function fileToDataUrl(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.naturalWidth || 1);
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function downloadQr(itemId) {
  try {
    const dataUrl = await generateQrDataUrl(String(itemId), 200);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj;
    a.download = `item-${itemId}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
  } catch (e) {
    if (typeof showToast === "function") showToast("Failed to generate QR for download.", "error");
    else console.error("Failed to generate QR for download.");
  }
}

// Generate a QR code as a Data URL completely offline (requires QRCode from qrcodejs)
function generateQrDataUrl(text, size = 200) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof QRCode === "undefined") {
        reject(new Error("QRCode library not loaded"));
        return;
      }
      const host = document.createElement("div");
      host.style.position = "absolute";
      host.style.left = "-9999px";
      host.style.top = "-9999px";
      document.body.appendChild(host);
      new QRCode(host, {
        text: String(text || ""),
        width: size,
        height: size,
        correctLevel: QRCode.CorrectLevel.M,
      });
      // Allow qrcodejs to render DOM, then extract data URL
      requestAnimationFrame(() => {
        try {
          const canvas = host.querySelector("canvas");
          const img = host.querySelector("img");
          const url = canvas
            ? canvas.toDataURL("image/png")
            : img && img.src
              ? img.src
              : null;
          host.remove();
          if (!url) return reject(new Error("QR render failed"));
          resolve(url);
        } catch (err) {
          host.remove();
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

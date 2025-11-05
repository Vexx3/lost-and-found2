/*
  utils.js
  Small shared helpers used across the app/admin pages.

  Exposes functions on the global window scope:
  - h(tag, attrs, children): create a DOM node quickly
  - assetUrl(path): passthrough, kept for future hosting tweaks
  - categoryLabel(key), inferCategoryFromName(name)
  - fileToDataUrl(file, maxWidth): downscale image to JPEG data URL
  - downloadQr(itemId): fetch and download a QR image as a file
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
    const url = ifoundDB.qrUrlFor(itemId);
    const res = await fetch(url, { mode: "cors" });
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
    window.open(ifoundDB.qrUrlFor(itemId), "_blank");
  }
}

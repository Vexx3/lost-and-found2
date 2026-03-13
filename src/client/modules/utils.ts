import { showToast, h } from "./ui.js";

// @ts-ignore
declare const QRCode: any;

export function assetUrl(p: string): string {
  return p;
}

export function maskName(fullName: string): string {
  if (!fullName || typeof fullName !== "string") return "Unknown";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0].toUpperCase();
  return `${first} ${lastInitial}.`;
}

export function categoryLabel(key: string): string {
  const map: Record<string, string> = {
    phones: "Phone",
    wallets: "Wallet",
    tumblers: "Tumbler",
    other: "Other",
  };
  return map[key] || "Other";
}

export function inferCategoryFromName(name: string): string {
  if (!name) return "other";
  if (/phone|iphone|android|samsung|oppo|vivo/i.test(name)) return "phones";
  if (/wallet/i.test(name)) return "wallets";
  if (/tumbler|bottle|hydro/i.test(name)) return "tumblers";
  return "other";
}

export function fileToDataUrl(file: File, maxWidth: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / (img.naturalWidth || 1));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL("image/jpeg", 0.8));
        } else {
            reject(new Error("No ctx"));
        }
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function downloadQr(itemId: string) {
  try {
    const dataUrl = await generateQrDataUrl(String(itemId), 200);
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj;
    a.download = `QR-${itemId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
  } catch (e) {
    showToast("Failed to generate QR for download.", "error");
  }
}

export function generateQrDataUrl(text: string, size: number = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof QRCode === "undefined") {
        return reject(new Error("QRCode library not loaded"));
      }
      const host = document.createElement("div");
      // @ts-ignore
      new QRCode(host, {
        text: text,
        width: size,
        height: size,
        // @ts-ignore
        correctLevel: QRCode.CorrectLevel.M,
      });
      setTimeout(() => {
        const c = host.querySelector("canvas");
        if (c) {
          resolve(c.toDataURL("image/png"));
        } else {
          const i = host.querySelector("img");
          if (i && i.src) resolve(i.src);
          else reject(new Error("Canvas generation failed"));
        }
      }, 50);
    } catch (err) {
      reject(err);
    }
  });
}
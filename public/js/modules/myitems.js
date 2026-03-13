import { showToast, h } from "./ui.js";
import { api } from "../api.js";
import { assetUrl, categoryLabel, inferCategoryFromName, downloadQr, generateQrDataUrl } from "./utils.js";
export function bindMyItems() {
    const btn = document.getElementById("myItemsBtn");
    const list = document.getElementById("myItemsList");
    if (!btn || !list)
        return;
    list.innerHTML = "";
    btn.addEventListener("click", async () => {
        const sidInput = document.getElementById("myStudentId");
        const sid = sidInput.value.trim();
        if (!sid)
            return showToast("Please enter your Student ID.", "error");
        try {
            const items = await api.listItemsByStudent(sid);
            list.innerHTML = "";
            if (!items.length) {
                list.appendChild(h("div", {}, "No items found."));
                return;
            }
            items.forEach((item) => {
                const qrImg = h("img", {
                    alt: "QR",
                    style: "width:120px;height:120px;background:#fff;padding:6px;border-radius:8px",
                });
                const photo = item.photoPath || item.photoDataUrl;
                const card = h("div", { class: "card", style: "margin-bottom:8px" }, [
                    h("div", { style: "display:flex;gap:8px;align-items:center" }, [
                        h("strong", {}, item.itemName),
                        h("span", { class: "status-" + item.status }, item.status),
                    ]),
                    photo
                        ? h("img", {
                            src: assetUrl(photo),
                            style: "max-width:200px;margin-top:8px;border-radius:8px",
                        })
                        : null,
                    h("div", { style: "margin-top:6px;font-size:12px;color:#6b7280" }, `Category: ${categoryLabel(item.category || inferCategoryFromName(item.itemName))}`),
                    h("div", {
                        style: "margin-top:8px;display:flex;gap:8px;align-items:center",
                    }, [
                        qrImg,
                        h("a", {
                            href: "#",
                            class: "btn secondary",
                            style: "text-align:center; flex:1",
                            onclick: (e) => {
                                e.preventDefault();
                                downloadQr(item.id);
                            },
                        }, "Download QR"),
                    ]),
                ]);
                list.appendChild(card);
                generateQrDataUrl(String(item.id), 200)
                    .then((url) => {
                    qrImg.setAttribute("src", url);
                })
                    .catch(() => {
                    qrImg.setAttribute("alt", "QR generation failed");
                });
            });
        }
        catch (err) {
            console.error(err);
            showToast("Failed to fetch items.", "error");
        }
    });
}

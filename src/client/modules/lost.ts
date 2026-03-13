import { api } from '../api.js';
import { showToast, h } from './ui.js';
import { assetUrl, maskName, categoryLabel, inferCategoryFromName } from './utils.js';

export async function loadLostItems() {
  const list = document.getElementById("itemsList");
  if (!list) return;
  try {
    const items = await api.listLostItems();
    list.innerHTML = "";
    const searchInput = document.getElementById("searchBar") as HTMLInputElement;
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
    const catSelect = document.getElementById("categoryFilter") as HTMLSelectElement;
    const cat = catSelect ? (catSelect.value || "all").toLowerCase() : "all";
    items
      .filter((item: any) => {
        const hit = (item.itemName || "")
          .toLowerCase()
          .includes(search);
        const itemCat = item.category || inferCategoryFromName(item.itemName);  
        const inCat = cat === "all" || itemCat === cat;
        return hit && inCat;
      })
      .forEach((item: any) => {
        const ownerPhoto = item.photoPath || item.photoDataUrl;
        const foundPic = item.foundPhotoPath || item.foundPhotoDataUrl;
        const primaryPhoto = foundPic || ownerPhoto;
        const secondaryPhoto = foundPic && ownerPhoto ? ownerPhoto : null;
        const card = h("div", { class: "item card" }, [
          primaryPhoto
            ? h("img", { src: assetUrl(primaryPhoto), alt: item.itemName })     
            : null,
          h("div", { class: "meta" }, [
            h("strong", {}, item.itemName),
            h("div", {}, `Owner: ${maskName(item.ownerName)}`),
            h(
              "div",
              { style: "margin-top:4px;color:#6b7280;font-size:12px" },
              `Category: ${categoryLabel(
                item.category || inferCategoryFromName(item.itemName)
              )}`
            ),
            secondaryPhoto
              ? h("div", { style: "margin-top:8px" }, [
                h("img", {
                  src: assetUrl(secondaryPhoto),
                  alt: "Owner Photo",
                  style: "max-width:140px;border-radius:6px;opacity:0.9",
                }),
                h("div", { style: "font-size:11px;color:#6b7280" }, "Original Owner Photo")
              ])
              : null,
            h(
              "button",
              {
                class: "btn primary",
                style: "margin-top:12px;width:100%",
                onclick: () => {
                  window.location.hash = `#claim-${item.id}`;
                  openClaimForm(item.id);
                },
              },
              "Claim Item"
            ),
          ]),
        ]);
        list.appendChild(card);
      });
    if (items.length === 0) {
      list.appendChild(
        h(
          "div",
          { style: "color:#6b7280;text-align:center;padding:24px" },
          "No lost items match your search. Keep checking back."
        )
      );
    }
  } catch (err) {
    console.error(err);
    showToast("Failed to fetch lost items.", "error");
  }
}

// Bind search logic globally once
const sb = document.getElementById("searchBar");
const cf = document.getElementById("categoryFilter");
if (sb) sb.addEventListener("input", loadLostItems);
if (cf) cf.addEventListener("change", loadLostItems);

let claimingItemId: string | null = null;
const claimModal = document.getElementById("claimModal");
const claimForm = document.getElementById("claimForm");
const claimCancelBtn = document.getElementById("claimCancel");
const claimCancelSecondaryBtn = document.getElementById("claimCancelSecondary");
const claimItemNameEl = document.getElementById("claimItemName");

async function openClaimForm(itemId: string) {
  try {
    const item = await api.getItem(itemId);
    if (!item) return showToast("Item not found.", "error");
    claimingItemId = item.id;
    if (claimItemNameEl) claimItemNameEl.textContent = item.itemName;
    if (claimForm instanceof HTMLFormElement) claimForm.reset();
    (document.getElementById("claimEmail") as HTMLInputElement).value = "";
    if (claimModal) {
      claimModal.style.display = "flex";
      requestAnimationFrame(() => claimModal.classList.add("show"));
    }
  } catch (e) {
    showToast("Error finding item.", "error");
  }
}

function closeClaimModal() {
  claimingItemId = null;
  if (claimModal) {
    claimModal.classList.remove("show");
    setTimeout(() => {
      claimModal.style.display = "none";
      if (claimForm instanceof HTMLFormElement) claimForm.reset();
      window.location.hash = "#lost";
    }, 300);
  }
}

if (claimCancelBtn) claimCancelBtn.addEventListener("click", closeClaimModal);
if (claimCancelSecondaryBtn) claimCancelSecondaryBtn.addEventListener("click", closeClaimModal);

if (claimForm) {
  claimForm.addEventListener("submit", async (e: Event) => {
    e.preventDefault();
    if (!claimingItemId) return;
    try {
      const email = (document.getElementById("claimEmail") as HTMLInputElement).value.trim().toLowerCase();

      const item = await api.getItem(claimingItemId);
      if (!item) return showToast("Item not found.", "error");

      if ((item.email || "").trim().toLowerCase() !== email) {
        return showToast("Email does not match the registered owner. Cannot claim.", "error");
      }

      // Automatically use the item's registered owner name as the claimant name if verified via email
      const claimantName = item.ownerName || "Owner (Verified by Email)";
      
      const r = await api.request('/claims', 'POST', { itemId: claimingItemId, claimantName });
      if (!r) throw new Error("Claim failed");
      
      showToast("Claim successful! Please proceed to the office for final verification.", "success");
      closeClaimModal();
      loadLostItems();
    } catch (err) {
      console.error(err);
      showToast("Failed to submit claim.", "error");
    }
  });
}

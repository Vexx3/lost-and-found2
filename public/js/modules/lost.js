import { api } from '../api.js';
import { showToast, h } from './ui.js';
import { assetUrl, maskName, categoryLabel, inferCategoryFromName } from './utils.js';

export async function loadLostItems() {
    const list = document.getElementById("itemsList");
    if (!list) return;
    try {
        const items = await api.listLostItems();
        list.innerHTML = "";
        const searchInput = document.getElementById("searchBar");
        const search = searchInput ? searchInput.value.trim().toLowerCase() : "";
        const catSelect = document.getElementById("categoryFilter");
        const cat = catSelect ? (catSelect.value || "all").toLowerCase() : "all";
        const filtered = items.filter((item) => {
            const hit = (item.itemName || "").toLowerCase().includes(search);
            const itemCat = item.category || inferCategoryFromName(item.itemName);
            const inCat = cat === "all" || itemCat === cat;
            return hit && inCat;
        });

        if (filtered.length === 0) {
            list.appendChild(h("div", { class: "empty-state" }, "No lost items match your search. Keep checking back."));
            return;
        }

        filtered.forEach((item) => {
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
                    h("div", { style: "margin-top:4px;color:#6b7280;font-size:13px" }, `Owner: ${maskName(item.ownerName)}`),
                    h("div", { style: "margin-top:4px;color:#6b7280;font-size:12px" },
                        `Category: ${categoryLabel(item.category || inferCategoryFromName(item.itemName))}`),
                    secondaryPhoto
                        ? h("div", { style: "margin-top:8px" }, [
                            h("img", {
                                src: assetUrl(secondaryPhoto),
                                alt: "Owner Photo",
                                style: "max-width:120px;border-radius:8px;opacity:0.85;border:1px solid #e2e8f0",
                            }),
                            h("div", { style: "font-size:11px;color:#6b7280;margin-top:2px" }, "Original Owner Photo")
                        ])
                        : null,
                    h("button", {
                        class: "btn primary",
                        style: "margin-top:14px;width:100%",
                        onclick: () => {
                            window.location.hash = `#claim-${item.id}`;
                            openClaimForm(item.id);
                        },
                    }, "🙋 Claim Item"),
                ]),
            ]);
            list.appendChild(card);
        });
    }
    catch (err) {
        console.error(err);
        showToast("Failed to fetch lost items.", "error");
    }
}

// Bind search logic globally once
const sb = document.getElementById("searchBar");
const cf = document.getElementById("categoryFilter");
if (sb) sb.addEventListener("input", loadLostItems);
if (cf) cf.addEventListener("change", loadLostItems);

let claimingItemId = null;
const claimModal = document.getElementById("claimModal");
const claimForm = document.getElementById("claimForm");
const claimCancelBtn = document.getElementById("claimCancel");
const claimCancelSecondaryBtn = document.getElementById("claimCancelSecondary");
const claimModalBackdrop = document.getElementById("claimModalBackdrop");
const claimItemNameEl = document.getElementById("claimItemName");

async function openClaimForm(itemId) {
    try {
        const item = await api.getItem(itemId);
        if (!item) return showToast("Item not found.", "error");
        claimingItemId = item.id;
        if (claimItemNameEl) claimItemNameEl.textContent = item.itemName;
        if (claimForm instanceof HTMLFormElement) claimForm.reset();
        const claimEmail = document.getElementById("claimEmail");
        if (claimEmail) claimEmail.value = "";
        if (claimModal) {
            claimModal.style.display = "flex";
            requestAnimationFrame(() => claimModal.classList.add("show"));
        }
    }
    catch (e) {
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
// Close modal when clicking the backdrop
if (claimModalBackdrop) claimModalBackdrop.addEventListener("click", closeClaimModal);

if (claimForm) {
    claimForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!claimingItemId) return;

        // Scope submitBtn outside try so finally can access it
        const submitBtn = claimForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing...";
        }

        try {
            const claimEmailInput = document.getElementById("claimEmail");
            const email = claimEmailInput ? claimEmailInput.value.trim().toLowerCase() : "";

            if (!email) {
                showToast("Please enter your email address.", "error");
                return;
            }

            const item = await api.getItem(claimingItemId);
            if (!item) {
                showToast("Item not found.", "error");
                return;
            }

            if ((item.email || "").trim().toLowerCase() !== email) {
                showToast("Email does not match the registered owner. Cannot claim.", "error");
                return;
            }

            // Use the item's registered owner name as the claimant name (verified via email)
            const claimantName = item.ownerName || "Owner (Verified by Email)";

            // Create a claim record
            const db = await api.getDb();
            const newClaim = {
                id: "claim-" + Date.now(),
                itemId: claimingItemId,
                claimantName,
                studentId: item.studentId,
                email: item.email,
                status: "pending_pickup",
                createdAt: Date.now()
            };
            db.claims = db.claims || [];
            db.claims.push(newClaim);

            // Update item status to "claimed" so it's removed from Lost Items
            db.items = db.items.map((i) => {
                if (i.id === claimingItemId) {
                    return { ...i, status: "claimed", claimedAt: new Date().toISOString() };
                }
                return i;
            });

            await api.updateDb(db);

            // Send email notification to the owner about claim success
            try {
                await api.notifyClaimed(item.email, item.itemName, item.ownerName);
            }
            catch (emailErr) {
                console.error("Failed to send claim email:", emailErr);
            }

            showToast("Claim successful! Please visit the Lost & Found office to pick up your item.", "success");
            closeClaimModal();
            loadLostItems();
        }
        catch (err) {
            console.error(err);
            showToast("Failed to submit claim.", "error");
        }
        finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Claim";
            }
        }
    });
}

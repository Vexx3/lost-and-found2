import { showToast, h } from './modules/ui.js';
import { assetUrl } from './modules/utils.js';
import { api } from './api.js';
const ADMIN_PIN = "1234";
const ifoundDB = {
    db: { items: [], found_reports: [], claims: [] },
    async init() {
        this.db = await api.getDb();
    },
    async save() {
        await api.updateDb(this.db);
    },
    listPendingReportsWithItem() {
        return this.db.found_reports.filter((r) => r.status === "pending").map((r) => {
            const item = this.db.items.find((i) => i.id === r.itemId) || {};
            return { ...r, itemName: item.itemName, itemPhoto: item.photoPath || item.photoDataUrl };
        });
    },
    async verifyReportMoveToLost(reportId, facultyNotes = "") {
        const report = this.db.found_reports.find((r) => r.id === reportId);
        if (!report)
            return false;
        const item = this.db.items.find((i) => i.id === report.itemId);
        if (item) {
            item.status = "lost";
            item.lostSince = new Date().toISOString();
            item.foundPhotoDataUrl = report.photoDataUrl || report.photoPath;
        }
        report.status = "verified";
        await this.save();
        // Send email notification to the item owner
        if (item && item.email) {
            try {
                const emailSent = await api.notifyVerified(item.email, item.itemName || "Unknown Item", facultyNotes);
                return emailSent ? "email_sent" : "email_failed";
            }
            catch (e) {
                console.error("Failed to notify verified:", e);
                return "email_failed";
            }
        }
        return true;
    },
    listClaimsWithItem() {
        return this.db.claims.map((c) => {
            const item = this.db.items.find((i) => i.id === c.itemId) || {};
            const report = this.db.found_reports.find((r) => r.itemId === c.itemId && r.status === "verified");
            return {
                ...c,
                itemName: item.itemName,
                ownerEmail: item.email || "N/A",
                studentIdFallback: item.studentId || "N/A",
                finderName: report ? report.finderName : "Unknown",
                locationFound: report ? report.location : "Unknown"
            };
        });
    },
    async releaseClaimedItem(claimId) {
        const claim = this.db.claims.find((c) => c.id === claimId);
        if (!claim)
            return false;
        claim.status = "released";
        claim.releasedAt = new Date().toISOString();
        // Update item status to "returned"
        const item = this.db.items.find((i) => i.id === claim.itemId);
        if (item) {
            item.status = "returned";
            item.returnedAt = new Date().toISOString();
        }
        await this.save();
        return true;
    },
    async rejectClaim(claimId) {
        const claim = this.db.claims.find((c) => c.id === claimId);
        if (!claim)
            return false;
        claim.status = "rejected";
        // Move item back to "lost"
        const item = this.db.items.find((i) => i.id === claim.itemId);
        if (item) {
            item.status = "lost";
        }
        await this.save();
        return true;
    },
    analytics() {
        const total = this.db.items.length;
        const lost = this.db.items.filter((i) => i.status === "lost").length;
        const claimed = this.db.items.filter((i) => i.status === "claimed" || i.status === "returned").length;
        const archived = this.db.items.filter((i) => i.status === "archived").length;
        const pendingReports = this.db.found_reports.filter((r) => r.status === "pending").length;
        const pendingPickups = (this.db.claims || []).filter((c) => c.status === "pending_pickup").length;
        return { total, lost, claimed, archived, pendingReports, pendingPickups, recoveryRate: total ? Math.round((claimed / total) * 100) : 0 };
    },
    listArchivedItems() {
        return this.db.items.filter((i) => i.status === "archived");
    },
    async archiveExpiredItems(days) {
        const now = Date.now();
        const ms = days * 24 * 60 * 60 * 1000;
        let count = 0;
        this.db.items.forEach((item) => {
            if (item.status === 'lost' && item.lostSince) {
                if (now - new Date(item.lostSince).getTime() > ms) {
                    item.status = 'archived';
                    item.archivedAt = new Date().toISOString();
                    count++;
                }
            }
        });
        if (count > 0)
            await this.save();
        return count;
    },
    exportAll() {
        return this.db;
    },
    async importMerge(data) {
        if (!data.items)
            return false;
        this.db = data;
        await this.save();
        return true;
    }
};
document.addEventListener("DOMContentLoaded", () => {
    const gate = document.getElementById("pinGate");
    const pinInput = document.getElementById("pinInput");
    const pinSubmit = document.getElementById("pinSubmit");
    const pinError = document.getElementById("pinError");
    const content = document.getElementById("adminContent");
    if (sessionStorage.getItem("ifound_admin_auth") === "1" && gate) {
        gate.style.display = "none";
        initAdmin();
        return;
    }
    if (content)
        content.style.visibility = "hidden";
    function tryUnlock() {
        if ((pinInput?.value || "") === ADMIN_PIN) {
            sessionStorage.setItem("ifound_admin_auth", "1");
            if (gate)
                gate.style.display = "none";
            if (content)
                content.style.visibility = "visible";
            initAdmin();
        }
        else if (pinError && pinInput) {
            pinError.textContent = "Incorrect PIN. Please try again.";
            pinInput.value = "";
            pinInput.focus();
        }
    }
    if (pinSubmit)
        pinSubmit.addEventListener("click", tryUnlock);
    if (pinInput)
        pinInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter")
                tryUnlock();
        });
});
async function initAdmin() {
    await ifoundDB.init();
    try {
        const n = await ifoundDB.archiveExpiredItems(365);
        if (n > 0)
            console.info(`[ifound] Auto-archived ${n} stale item(s).`);
    }
    catch (e) { }
    loadPending();
    loadClaims();
    loadAnalytics();
    loadRetentionPolicy();
    bindDataControls();
    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState === "visible" && sessionStorage.getItem("ifound_admin_auth") === "1") {
            await ifoundDB.init();
            loadPending();
            loadClaims();
            loadAnalytics();
        }
    });
}
async function loadPending() {
    await ifoundDB.init();
    const container = document.getElementById("reports");
    if (!container)
        return;
    try {
        const reports = ifoundDB.listPendingReportsWithItem();
        container.innerHTML = "";
        if (!reports.length) {
            container.appendChild(h("div", { class: "card" }, "No pending reports."));
            return;
        }
        reports.forEach((report) => {
            const finderPhoto = report.photoDataUrl || report.photoPath;
            const ownerPhoto = report.itemPhotoDataUrl || report.itemPhoto;
            const card = h("div", { class: "card", style: "margin-bottom:8px" }, [
                h("strong", {}, report.itemName),
                h("div", {}, `Finder: ${report.finderName}`),
                h("div", {}, `Location: ${report.location}`),
                h("div", {
                    style: "display:flex; gap:12px; margin-top:8px; align-items:flex-start; flex-wrap:wrap",
                }, [
                    finderPhoto
                        ? h("div", {}, [
                            h("div", { style: "font-size:12px;color:#6b7280" }, "Finder Photo"),
                            h("img", { src: assetUrl(finderPhoto), style: "max-width:200px;border-radius:6px;margin-top:4px" }),
                        ])
                        : null,
                    ownerPhoto
                        ? h("div", {}, [
                            h("div", { style: "font-size:12px;color:#6b7280" }, "Owner Photo"),
                            h("img", { src: assetUrl(ownerPhoto), style: "max-width:200px;border-radius:6px;margin-top:4px" }),
                        ])
                        : null,
                ]),
                h("div", { style: "margin-top:10px;display:flex;gap:8px;flex-wrap:wrap" }, [
                    h("button", {
                        type: "button",
                        class: "btn primary",
                        onclick: async (ev) => {
                            const notes = prompt("Any notes for the student? (e.g. 'Pick it up at Room 301 before 5PM'). Leave blank for no notes.");
                            if (notes === null)
                                return; // User cancelled
                            const btn = ev.currentTarget;
                            btn.disabled = true;
                            btn.textContent = "Verifying...";
                            try {
                                const result = await ifoundDB.verifyReportMoveToLost(report.id, notes);
                                if (result) {
                                    card.innerHTML = "";
                                    if (result === "email_failed") {
                                        card.appendChild(h("div", { class: "status-claimed", style: "padding:12px" }, "✅ Moved to Lost Items (⚠️ Email failed to send — check EmailJS config)"));
                                        showToast("Verified & moved to Lost Items, but email failed. Check EmailJS settings.", "error");
                                    }
                                    else {
                                        card.appendChild(h("div", { class: "status-claimed", style: "padding:12px" }, "✅ Moved to Lost Items & Email Sent"));
                                        showToast("Verified, moved to Lost Items, and emailed student.", "success");
                                    }
                                    loadAnalytics();
                                }
                            }
                            catch (e) {
                                showToast("Error during verification.", "error");
                                btn.disabled = false;
                                btn.textContent = "Verify & Move to Lost Items";
                            }
                        },
                    }, "Verify & Move to Lost Items"),
                    h("button", {
                        type: "button",
                        class: "btn secondary",
                        onclick: async (ev) => {
                            if (!confirm("Reject this found report? The item will remain as registered."))
                                return;
                            const btn = ev.currentTarget;
                            btn.disabled = true;
                            try {
                                const report_obj = ifoundDB.db.found_reports.find((r) => r.id === report.id);
                                if (report_obj) {
                                    report_obj.status = "rejected";
                                    await ifoundDB.save();
                                    card.innerHTML = "";
                                    card.appendChild(h("div", { style: "color:#991b1b;padding:12px" }, "❌ Report rejected"));
                                    showToast("Report rejected.", "info");
                                }
                            }
                            catch (e) {
                                showToast("Error rejecting report.", "error");
                                btn.disabled = false;
                            }
                        },
                    }, "Reject"),
                ]),
            ]);
            container.appendChild(card);
        });
    }
    catch (e) { }
}
async function loadClaims() {
    await ifoundDB.init();
    const container = document.getElementById("claims");
    if (!container)
        return;
    try {
        const claims = ifoundDB.listClaimsWithItem();
        container.innerHTML = "";
        if (!claims.length) {
            container.appendChild(h("div", { class: "card" }, "No claims yet."));
            return;
        }
        // Sort: pending_pickup first, then by date
        claims.sort((a, b) => {
            if (a.status === "pending_pickup" && b.status !== "pending_pickup") return -1;
            if (a.status !== "pending_pickup" && b.status === "pending_pickup") return 1;
            return (b.createdAt || 0) - (a.createdAt || 0);
        });
        claims.forEach((claim) => {
            const isPending = claim.status === "pending_pickup";
            const isReleased = claim.status === "released";
            const isRejected = claim.status === "rejected";

            const statusBadge = isPending
                ? h("span", { class: "status-pending", style: "margin-left:8px" }, "⏳ Pending Pickup")
                : isReleased
                    ? h("span", { class: "status-claimed", style: "margin-left:8px" }, "✅ Released")
                    : isRejected
                        ? h("span", { class: "status-lost", style: "margin-left:8px" }, "❌ Rejected")
                        : h("span", { class: "status-registered", style: "margin-left:8px" }, claim.status);

            const actionButtons = [];
            if (isPending) {
                actionButtons.push(
                    h("button", {
                        type: "button",
                        class: "btn primary",
                        onclick: async (ev) => {
                            if (!confirm("Confirm that the student has picked up the item and verified their identity?"))
                                return;
                            const btn = ev.currentTarget;
                            btn.disabled = true;
                            btn.textContent = "Releasing...";
                            try {
                                const ok = await ifoundDB.releaseClaimedItem(claim.id);
                                if (ok) {
                                    showToast("Item released to owner. Claim complete!", "success");
                                    loadClaims();
                                    loadAnalytics();
                                }
                            }
                            catch (e) {
                                showToast("Error releasing item.", "error");
                                btn.disabled = false;
                                btn.textContent = "Release to Owner";
                            }
                        },
                    }, "✅ Release to Owner"),
                    h("button", {
                        type: "button",
                        class: "btn secondary",
                        style: "background:#fee2e2;color:#991b1b",
                        onclick: async (ev) => {
                            if (!confirm("Reject this claim? The item will be moved back to Lost Items."))
                                return;
                            const btn = ev.currentTarget;
                            btn.disabled = true;
                            try {
                                const ok = await ifoundDB.rejectClaim(claim.id);
                                if (ok) {
                                    showToast("Claim rejected. Item moved back to Lost Items.", "info");
                                    loadClaims();
                                    loadAnalytics();
                                }
                            }
                            catch (e) {
                                showToast("Error rejecting claim.", "error");
                                btn.disabled = false;
                            }
                        },
                    }, "❌ Reject Claim")
                );
            }

            container.appendChild(h("div", { class: "card", style: "margin-bottom:8px" }, [
                h("div", { style: "display:flex;align-items:center;flex-wrap:wrap;gap:4px" }, [
                    h("strong", {}, `Claim: ${claim.itemName}`),
                    statusBadge,
                ]),
                h("div", { style: "margin-top:6px" }, `Claimant: ${claim.claimantName}`),
                h("div", {}, `Student ID: ${claim.studentId || claim.studentIdFallback}`),
                h("div", {}, `Email: ${claim.ownerEmail}`),
                h("div", { style: "margin-top:4px;font-size:13px;color:#10b981" }, `Found by: ${claim.finderName} @ ${claim.locationFound}`),
                h("div", { style: "font-size:12px;color:#6b7280;margin-top:4px" }, `Claimed on: ${new Date(claim.createdAt).toLocaleString()}`),
                isReleased && claim.releasedAt
                    ? h("div", { style: "font-size:12px;color:#059669;margin-top:2px" }, `Released on: ${new Date(claim.releasedAt).toLocaleString()}`)
                    : null,
                actionButtons.length > 0
                    ? h("div", { style: "margin-top:10px;display:flex;gap:8px;flex-wrap:wrap" }, actionButtons)
                    : null,
            ]));
        });
    }
    catch (e) {
        console.error("Error loading claims:", e);
    }
}
async function loadAnalytics() {
    const container = document.getElementById("analytics");
    if (!container)
        return;
    try {
        const a = ifoundDB.analytics();
        container.innerHTML = "";
        const grid = h("div", { style: "display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:8px" }, [
            makeStatCard("Total Items", a.total, "#0950d4"),
            makeStatCard("Lost (Unclaimed)", a.lost, "#dc2626"),
            makeStatCard("Claimed/Returned", a.claimed, "#059669"),
            makeStatCard("Archived", a.archived, "#6b7280"),
            makeStatCard("Pending Reports", a.pendingReports, "#d97706"),
            makeStatCard("Pending Pickups", a.pendingPickups, "#7c3aed"),
        ]);
        container.appendChild(grid);
        const rate = h("div", { style: "margin-top:10px;font-weight:600;font-size:15px" }, `Recovery Rate: ${a.recoveryRate}%`);
        container.appendChild(rate);
    }
    catch (e) { }
}
function makeStatCard(label, value, color) {
    return h("div", {
        style: `background:${color}10;border-left:3px solid ${color};padding:12px;border-radius:8px`
    }, [
        h("div", { style: `font-size:24px;font-weight:700;color:${color}` }, String(value)),
        h("div", { style: "font-size:12px;color:#6b7280;margin-top:2px" }, label),
    ]);
}
function loadRetentionPolicy() {
    const list = document.getElementById("archivedList");
    const btn = document.getElementById("archiveNowBtn");
    const select = document.getElementById("retentionDays");
    if (!list || !btn || !select)
        return;
    function renderArchivedList() {
        list.innerHTML = "";
        const items = ifoundDB.listArchivedItems();
        if (!items.length) {
            list.appendChild(h("p", { style: "color:#6b7280;font-size:14px;margin-top:8px" }, "No archived items yet."));
            return;
        }
        items.forEach((item) => {
            list.appendChild(h("div", { class: "card", style: "margin-top:8px" }, [
                h("strong", {}, item.itemName),
                h("span", { class: "status-archived", style: "margin-left:8px" }, "Archived"),
                h("div", {}, `Owner: ${item.ownerName} (${item.studentId})`),
            ]));
        });
    }
    btn.addEventListener("click", async () => {
        const days = parseInt(select.value, 10);
        const count = await ifoundDB.archiveExpiredItems(days);
        if (count > 0) {
            showToast(`${count} item(s) archived as expired.`, "success");
            loadAnalytics();
        }
        else {
            showToast("No items met the retention threshold.", "info");
        }
        renderArchivedList();
    });
    renderArchivedList();
}
function bindDataControls() {
    const exportBtn = document.getElementById("exportData");
    const importInput = document.getElementById("importFile");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            try {
                const data = ifoundDB.exportAll();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "ifound-export.json";
                a.click();
                URL.revokeObjectURL(url);
            }
            catch (e) {
                showToast("Export failed.", "error");
            }
        });
    }
    if (importInput) {
        importInput.addEventListener("change", async () => {
            const file = importInput.files?.[0];
            if (!file)
                return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                const ok = await ifoundDB.importMerge(data);
                if (ok) {
                    showToast("Import complete! Data has been replaced.", "success");
                    loadAnalytics();
                    loadPending();
                    loadClaims();
                }
                else
                    showToast("Import failed.", "error");
            }
            catch (e) {
                showToast("Invalid JSON file.", "error");
            }
        });
    }
}

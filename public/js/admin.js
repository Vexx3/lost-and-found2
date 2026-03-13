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
    async verifyReportMoveToLost(reportId) {
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
        try {
            await api.request("/notify-verified", "POST", { reportId });
        }
        catch (e) {
            console.error("Failed to notify verified:", e);
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
                studentIdFallback: item.studentId || "N/A",
                finderName: report ? report.finderName : "Unknown",
                locationFound: report ? report.location : "Unknown"
            };
        });
    },
    analytics() {
        const total = this.db.items.length;
        const lost = this.db.items.filter((i) => i.status === "lost").length;
        const claimed = this.db.items.filter((i) => i.status === "claimed").length;
        const archived = this.db.items.filter((i) => i.status === "archived").length;
        const pendingReports = this.db.found_reports.filter((r) => r.status === "pending").length;
        return { total, lost, claimed, archived, pendingReports, recoveryRate: total ? Math.round((claimed / total) * 100) : 0 };
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
}
async function loadPending() {
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
                    style: "display:flex; gap:12px; margin-top:8px; align-items:flex-start",
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
                h("div", { style: "margin-top:10px" }, [
                    h("button", {
                        type: "button",
                        class: "btn primary",
                        onclick: async (ev) => {
                            if (!confirm("Verify and move to Lost Items?"))
                                return;
                            const btn = ev.currentTarget;
                            btn.disabled = true;
                            btn.textContent = "Verifying...";
                            try {
                                const ok = await ifoundDB.verifyReportMoveToLost(report.id);
                                if (ok) {
                                    card.innerHTML = "";
                                    card.appendChild(h("div", { class: "status-claimed" }, "Moved to Lost Items"));
                                    loadAnalytics();
                                    showToast("Verified and moved to Lost Items.", "success");
                                }
                            }
                            catch (e) {
                                showToast("Error during verification.", "error");
                                btn.disabled = false;
                                btn.textContent = "Verify & Move to Lost Items";
                            }
                        },
                    }, "Verify & Move to Lost Items"),
                ]),
            ]);
            container.appendChild(card);
        });
    }
    catch (e) { }
}
async function loadClaims() {
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
        claims.forEach((claim) => {
            container.appendChild(h("div", { class: "card", style: "margin-bottom:8px" }, [
                h("strong", {}, `Claim: ${claim.itemName}`),
                h("div", {}, `Claimant: ${claim.claimantName}`),
                h("div", {}, `Student ID: ${claim.studentId || claim.studentIdFallback}`),
                h("div", { style: "margin-top:4px;font-size:13px;color:#10b981" }, `Found by: ${claim.finderName} @ ${claim.locationFound}`),
                h("div", { style: "font-size:12px;color:#6b7280;margin-top:4px" }, `On: ${new Date(claim.createdAt).toLocaleString()}`),
            ]));
        });
    }
    catch (e) { }
}
async function loadAnalytics() {
    const container = document.getElementById("analytics");
    if (!container)
        return;
    try {
        const a = ifoundDB.analytics();
        container.innerHTML = "";
        container.appendChild(h("div", {}, `Total items: ${a.total}`));
        container.appendChild(h("div", {}, `Lost (unclaimed): ${a.lost}`));
        container.appendChild(h("div", {}, `Claimed: ${a.claimed}`));
        container.appendChild(h("div", {}, `Archived (expired): ${a.archived}`));
        container.appendChild(h("div", {}, `Pending reports: ${a.pendingReports}`));
        container.appendChild(h("div", {}, `Recovery rate: ${a.recoveryRate}%`));
    }
    catch (e) { }
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

"use strict";

/*
==========================================================================
  Admin Dashboard Controller (Client-side)
  Architecture Pattern: Modular / Functional
  Dependencies: utils.js, localdb.js
  
  Modules breakdown:
  1. Initialization
  2. Rendering Pending Found Reports
  3. Rendering Claims
  4. Rendering Analytics
  5. Data Controls (Import/Export)
==========================================================================
*/

// Toast notification helper
function showToast(message, type = "info") {
  const existing = document.querySelectorAll(".toast-notification");
  existing.forEach((t) => t.remove());
  const toast = document.createElement("div");
  toast.className = "toast-notification toast-" + type;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

document.addEventListener("DOMContentLoaded", () => {
  loadPending();
  loadClaims();
  loadAnalytics();
  bindDataControls();
});

// Render the list of pending found reports and wire Verify actions
async function loadPending() {
  const container = document.getElementById("reports");
  if (!container) return;
  try {
    const reports = ifoundDB.listPendingReportsWithItem();
    container.innerHTML = "";
    if (!reports.length) {
      container.appendChild(h("div", { class: "card" }, "No pending reports."));
      return;
    }
    reports.forEach((report) => {
      const card = h("div", { class: "card", style: "margin-bottom:8px" }, [
        h("strong", {}, report.itemName),
        h("div", {}, `Finder: ${report.finderName}`),
        h("div", {}, `Location: ${report.location}`),
        h(
          "div",
          {
            style:
              "display:flex; gap:12px; margin-top:8px; align-items:flex-start",
          },
          [
            report.photoPath
              ? h("div", {}, [
                h(
                  "div",
                  { style: "font-size:12px;color:#6b7280" },
                  "Finder Photo"
                ),
                h("img", {
                  src: assetUrl(report.photoPath),
                  style: "max-width:200px;border-radius:6px;margin-top:4px",
                }),
              ])
              : null,
            report.itemPhoto
              ? h("div", {}, [
                h(
                  "div",
                  { style: "font-size:12px;color:#6b7280" },
                  "Owner Photo"
                ),
                h("img", {
                  src: assetUrl(report.itemPhoto),
                  style: "max-width:200px;border-radius:6px;margin-top:4px",
                }),
              ])
              : null,
          ]
        ),
        h("div", { style: "margin-top:10px" }, [
          h(
            "button",
            {
              type: "button",
              class: "btn primary",
              onclick: async (ev) => {
                const ok = confirm("Verify and move to Lost Items?");
                if (!ok) return;
                const btn = ev.currentTarget;
                btn.disabled = true;
                const prev = btn.textContent;
                btn.textContent = "Verifying...";
                try {
                  const ok2 = ifoundDB.verifyReportMoveToLost(report.id);
                  if (ok2) {
                    // Immediate visual feedback
                    card.innerHTML = "";
                    card.appendChild(
                      h(
                        "div",
                        { class: "status-claimed" },
                        "Moved to Lost Items"
                      )
                    );
                    // Refresh lists/analytics
                    loadPending();
                    loadAnalytics();
                    showToast("Verified and moved to Lost Items.", "success");
                  } else {
                    showToast("Failed to verify.", "error");
                    btn.disabled = false;
                    btn.textContent = prev;
                  }
                } catch (e) {
                  console.error("Verify error", e);
                  showToast("Error during verification.", "error");
                  btn.disabled = false;
                  btn.textContent = prev;
                }
              },
            },
            "Verify & Move to Lost Items"
          ),
        ]),
      ]);
      container.appendChild(card);
    });
  } catch (e) {
    console.error(e);
  }
}

// Render the list of claims with timestamps
async function loadClaims() {
  const container = document.getElementById("claims");
  if (!container) return;
  try {
    const claims = ifoundDB.listClaimsWithItem();
    container.innerHTML = "";
    if (!claims.length) {
      container.appendChild(h("div", { class: "card" }, "No claims yet."));
      return;
    }
    claims.forEach((claim) => {
      container.appendChild(
        h("div", { class: "card", style: "margin-bottom:8px" }, [
          h("strong", {}, `Claim: ${claim.itemName}`),
          h("div", {}, `Claimant: ${claim.claimantName}`),
          h("div", {}, `Student ID: ${claim.studentId}`),
          h(
            "div",
            { style: "font-size:12px;color:#6b7280" },
            `On: ${new Date(claim.createdAt).toLocaleString()}`
          ),
        ])
      );
    });
  } catch (e) {
    console.error(e);
  }
}

// Render a small analytics summary
async function loadAnalytics() {
  const container = document.getElementById("analytics");
  if (!container) return;
  try {
    const a = ifoundDB.analytics();
    container.innerHTML = "";
    container.appendChild(h("div", {}, `Total items: ${a.total}`));
    container.appendChild(h("div", {}, `Lost: ${a.lost}`));
    container.appendChild(h("div", {}, `Claimed: ${a.claimed}`));
    container.appendChild(h("div", {}, `Pending reports: ${a.pendingReports}`));
    container.appendChild(h("div", {}, `Recovery rate: ${a.recoveryRate}%`));
  } catch (e) {
    console.error(e);
  }
}

// Wire export/import buttons for local data management
function bindDataControls() {
  const exportBtn = document.getElementById("exportData");
  const importInput = document.getElementById("importFile");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        const data = ifoundDB.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ifound-export.json";
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        showToast("Export failed.", "error");
      }
    });
  }
  if (importInput) {
    importInput.addEventListener("change", async () => {
      const file = importInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const ok = ifoundDB.importMerge(data);
        if (ok) {
          showToast("Import complete! Data has been merged.", "success");
          loadAnalytics();
          loadPending();
          loadClaims();
        } else showToast("Import failed.", "error");
      } catch (e) {
        showToast("Invalid JSON file.", "error");
      }
    });
  }
}
